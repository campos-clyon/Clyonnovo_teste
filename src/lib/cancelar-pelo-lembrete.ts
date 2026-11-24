/**
 * UM SÓ CAMINHO DE CANCELAR PELO LEMBRETE — d85, fase 0 (22-11-2026).
 *
 * Havia três cópias: a validade dos orçamentos (d62/d2), os lembretes do que
 * falta (d71) e o seguimento do cliente (d83). Agora as três passam por aqui:
 *
 *  - `perguntarSeCancela` — a pergunta «Confirma que quer cancelar o pedido
 *    #N? Responda CANCELAR.», reservada (affectedRows = 1: dois «3» seguidos
 *    não mandam duas perguntas), desfeita se não sair;
 *  - `cancelarPeloLembreteComum` — o cancelamento de sempre: reserva o ciclo,
 *    `cancelarPedido` (encerra as negociações, guarda o estado de antes), o
 *    motivo «Já não precisa», os parceiros avisados, o texto de cancelamento
 *    aprovado ao cliente, e os dados a sair 7 dias depois, pela purga dos
 *    cancelados pelo lembrete (nunca no momento, nunca DELETE);
 *  - `responderAoCancelamento` — o que a conversa chama: com a confirmação
 *    «pergunta», só o CANCELAR cancela; com «logo», a resposta ao lembrete
 *    cancela sem a pergunta.
 *
 * A opção «logo» já não é usada: a d71 passou a pedir o CANCELAR na d5 (CEO e dono,
 * 21-11-2026) — o «2» nunca cancela à primeira.
 */

import type { Pool } from "mysql2/promise";
import {
  appendOrderHistory,
  cancelarPedido,
  gravarMotivoDoFecho,
  negociacoesDoPedido,
  registarSemFalhar,
} from "./db";
import {
  DIAS_ATE_ANONIMIZAR_O_CANCELADO,
  eConfirmacaoDoCancelamento,
  HORAS_PARA_CONFIRMAR_O_CANCELAMENTO,
  textoDaConfirmacaoDoCancelamento,
} from "./validade-do-orcamento";

/** Como o cliente confirma o cancelamento pelo lembrete. */
export type ConfirmacaoDoCancelamento =
  /** d2: o «já não preciso» pergunta, e só o CANCELAR (dentro de 48 h) cancela. */
  | "pergunta"
  /** d71 (dono, 19-11-2026): a resposta ao lembrete cancela logo. */
  | "logo";

export type FonteDoCancelamento = {
  decisao: string;
  // d92: «vitoriaCancelamentos» — a pergunta do CANCELAR feita pela Vitória agente (vitoria-agente/na-base.ts).
  tabela: "validadeDosOrcamentos" | "lembretesDoQueFalta" | "seguimentoDoCliente" | "vitoriaCancelamentos";
  /** O «agora» de cada tabela, como estava (a d62 grava NOW(); as outras UTC_TIMESTAMP()). */
  agoraSql: "NOW()" | "UTC_TIMESTAMP()";
  /** O ciclo ainda aberto (além de `canceladoEm IS NULL`). */
  abertoSql: string;
  confirmacao: ConfirmacaoDoCancelamento;
  /** O que mais muda quando se pergunta: o ciclo pára. Um `?` para o porquê. */
  aoPerguntarSql: string;
  /** Quem cancelou, no registo permanente. */
  autorNome: string;
  /** A nota do histórico quando se pergunta. */
  notaDaPergunta: string;
  /** A linha do histórico e do registo quando cancela. */
  resumo: (encerradas: number) => string;
  /** Num Trabalho CLYON, avisa como nos Trabalhos CLYON (a d71 avisa sempre como na Mesa). */
  avisaComoTrabalhoClyon: boolean;
  /** Pára também a validade do orçamento deste pedido (a d83). */
  paraAValidade: boolean;
  /**
   * d102 (24-11-2026): cancela pelo caminho da d93 — os dados saem NA HORA, o
   * número fica em «não contactar» e a mensagem diz isso (`cancelarEApagarNaHora`).
   * Sem isto, o de sempre: o texto de cancelamento e a purga 7 dias depois.
   */
  anonimizaNaHora?: boolean;
};

const QUANDO_SE_PERGUNTA = "«3» — à espera do CANCELAR";
const MOTIVO = "O cliente já não precisa";

const DEPOIS_DA_PURGA = `Os dados dele saem do pedido daqui a ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} dias, pela purga; reabrir o pedido até lá desfaz.`;

/** As três fontes. A d71 com «logo» (ver o cabeçalho). */
export const FONTES_DO_CANCELAMENTO = {
  validade: {
    decisao: "d62",
    tabela: "validadeDosOrcamentos",
    agoraSql: "NOW()",
    abertoSql: "fechadoEm IS NULL",
    confirmacao: "pergunta",
    aoPerguntarSql: "paradoEm = COALESCE(paradoEm, NOW()), paradoPorque = COALESCE(paradoPorque, ?)",
    autorNome: "WhatsApp (lembrete do orçamento)",
    notaDaPergunta:
      "O cliente respondeu «3» ao lembrete do orçamento: perguntámos se confirma o cancelamento (responde CANCELAR). Nada foi cancelado.",
    resumo: (n) =>
      `O cliente confirmou com CANCELAR, depois do «3» ao lembrete do orçamento: pedido cancelado, ${n} negociação(ões) encerrada(s). ${DEPOIS_DA_PURGA}`,
    avisaComoTrabalhoClyon: true,
    paraAValidade: false,
  },
  queFalta: {
    decisao: "d71",
    tabela: "lembretesDoQueFalta",
    agoraSql: "UTC_TIMESTAMP()",
    abertoSql: "lembrete1Em IS NOT NULL AND arquivadoEm IS NULL",
    confirmacao: "pergunta",
    aoPerguntarSql: "paradoEm = COALESCE(paradoEm, UTC_TIMESTAMP()), paradoPorque = COALESCE(paradoPorque, ?)",
    autorNome: "WhatsApp (lembrete do que falta)",
    notaDaPergunta:
      "O cliente respondeu ao lembrete do que falta: perguntámos se confirma o cancelamento (responde CANCELAR). Nada foi cancelado.",
    resumo: () =>
      `O cliente respondeu «3» ao lembrete do que falta e confirmou com CANCELAR (d71, d5): pedido cancelado, com o texto de cancelamento ao cliente. ${DEPOIS_DA_PURGA}`,
    avisaComoTrabalhoClyon: false,
    paraAValidade: false,
  },
  seguimento: {
    decisao: "d83",
    tabela: "seguimentoDoCliente",
    agoraSql: "UTC_TIMESTAMP()",
    abertoSql: "arquivadoEm IS NULL",
    confirmacao: "pergunta",
    aoPerguntarSql:
      "paradoEm = COALESCE(paradoEm, UTC_TIMESTAMP()), respondeuEm = COALESCE(respondeuEm, UTC_TIMESTAMP()), paradoPorque = COALESCE(paradoPorque, ?)",
    autorNome: "WhatsApp (seguimento do cliente)",
    notaDaPergunta:
      "O cliente respondeu «3» ao seguimento (d83): perguntámos se confirma o cancelamento (responde CANCELAR). Nada foi cancelado.",
    resumo: (n) =>
      `O cliente confirmou com CANCELAR, depois do «3» ao seguimento (d83): pedido cancelado, ${n} negociação(ões) encerrada(s). ${DEPOIS_DA_PURGA}`,
    avisaComoTrabalhoClyon: true,
    paraAValidade: true,
  },
} as const satisfies Record<string, FonteDoCancelamento>;

export type ResultadoDoCancelamentoComum =
  | { ok: true; estado: "pediu_confirmacao" | "a_espera_de_cancelar" | "cancelado"; porque?: string }
  | { ok: false; porque: string };

/* ── A pergunta ──────────────────────────────────────────────────────────── */

/**
 * O «já não preciso» ao lembrete: NÃO cancela. Marca «à espera do CANCELAR»
 * (reservado), pára a contagem e pergunta. Se a pergunta não sair, a marca
 * desfaz-se e devolve ok: false (a conversa passa à equipa).
 */
export async function perguntarSeCancela(
  f: FonteDoCancelamento,
  pool: Pool,
  pedidoId: number,
  telefone: string,
): Promise<ResultadoDoCancelamentoComum> {
  const agora = f.agoraSql;
  const [marca] = (await pool.execute(
    `UPDATE ${f.tabela}
        SET cancelarPedidoEm = ${agora}, porEnviar = NULL, porEnviarDesde = NULL, ${f.aoPerguntarSql}
      WHERE pedidoId = ? AND ${f.abertoSql} AND canceladoEm IS NULL
        AND (cancelarPedidoEm IS NULL OR cancelarPedidoEm <= ${agora} - INTERVAL ${HORAS_PARA_CONFIRMAR_O_CANCELAMENTO} HOUR)`,
    [QUANDO_SE_PERGUNTA, pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(marca.affectedRows) !== 1) {
    const estado = await estadoDaPergunta(f, pool, pedidoId);
    return estado?.aEspera
      ? { ok: true, estado: "a_espera_de_cancelar", porque: "a pergunta já tinha saído" }
      : { ok: false, porque: "o ciclo deste pedido já fechou (ou foi cancelado)" };
  }
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const saiu = await enviarTextoWhatsApp(telefone, textoDaConfirmacaoDoCancelamento(pedidoId)).catch(() => false);
  if (!saiu) {
    await pool.execute(`UPDATE ${f.tabela} SET cancelarPedidoEm = NULL WHERE pedidoId = ? AND canceladoEm IS NULL`, [pedidoId]);
    return { ok: false, porque: "a pergunta do CANCELAR não saiu" };
  }
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: f.notaDaPergunta }).catch(() => {});
  return { ok: true, estado: "pediu_confirmacao" };
}

/** A pergunta do CANCELAR deste pedido ainda vale? null = sem ciclo (ou já cancelado). */
export async function estadoDaPergunta(f: FonteDoCancelamento, pool: Pool, pedidoId: number): Promise<{ aEspera: boolean } | null> {
  const [rows] = (await pool.execute(
    `SELECT (cancelarPedidoEm IS NOT NULL AND cancelarPedidoEm > ${f.agoraSql} - INTERVAL ${HORAS_PARA_CONFIRMAR_O_CANCELAMENTO} HOUR) AS aEspera
       FROM ${f.tabela} WHERE pedidoId = ? AND canceladoEm IS NULL LIMIT 1`,
    [pedidoId],
  )) as [Array<{ aEspera: number }>, unknown];
  const r = rows?.[0];
  return r ? { aEspera: Number(r.aEspera) === 1 } : null;
}

/* ── O cancelamento ──────────────────────────────────────────────────────── */

/** O que cada rotina confere no pedido antes de cancelar: o porquê de não cancelar, ou o que é preciso para avisar. */
export type VerificacaoDoPedido =
  | { porque: string }
  | { porque?: undefined; eClyon: boolean; servico: string | null; localidade: string | null };

/**
 * CANCELA PELO LEMBRETE. Reserva o ciclo (só um cancela; com «pergunta», só
 * com a pergunta ainda a valer), confere o pedido pela regra da rotina, e
 * cancela pelo caminho de sempre. Se algo falhar antes de cancelar, a reserva
 * desfaz-se. Nunca anonimiza no momento: marca para a purga.
 */
export async function cancelarPeloLembreteComum(
  f: FonteDoCancelamento,
  pool: Pool,
  pedidoId: number,
  telefone: string,
  opcoes: {
    verificar: () => Promise<VerificacaoDoPedido>;
    /** O que a rotina faz quando desfaz a reserva (a d71 pára o ciclo). */
    aoDesfazer?: (porque: string) => Promise<void>;
  },
): Promise<{ ok: true; encerradas: number } | { ok: false; porque: string }> {
  const agora = f.agoraSql;
  const comPergunta =
    f.confirmacao === "pergunta"
      ? ` AND cancelarPedidoEm IS NOT NULL AND cancelarPedidoEm > ${agora} - INTERVAL ${HORAS_PARA_CONFIRMAR_O_CANCELAMENTO} HOUR`
      : "";
  const [reserva] = (await pool.execute(
    `UPDATE ${f.tabela} SET canceladoEm = ${agora}, porEnviar = NULL, porEnviarDesde = NULL
      WHERE pedidoId = ? AND canceladoEm IS NULL AND ${f.abertoSql}${comPergunta}`,
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) {
    return {
      ok: false,
      porque: f.confirmacao === "pergunta" ? "não há pergunta do CANCELAR a valer para este pedido" : "não há lembrete em aberto para este pedido",
    };
  }
  const desfazer = async (porque: string) => {
    await pool.execute(`UPDATE ${f.tabela} SET canceladoEm = NULL WHERE pedidoId = ?`, [pedidoId]).catch(() => {});
    if (opcoes.aoDesfazer) await opcoes.aoDesfazer(porque).catch(() => {});
  };

  const v = await opcoes.verificar().catch((e) => ({ porque: e instanceof Error ? e.message : "erro ao ler o pedido" }));
  if (v.porque !== undefined) {
    await desfazer(v.porque);
    return { ok: false, porque: v.porque };
  }
  if (f.anonimizaNaHora) {
    const { cancelarEApagarNaHora } = await import("./cancelar-pelo-cliente-na-base");
    const d = await cancelarEApagarNaHora(pedidoId, { origem: "vitoria", telefone, verificarTelefone: false }).catch((e) => ({
      ok: false as const,
      porque: e instanceof Error ? e.message : "erro ao cancelar",
      daEquipa: false,
    }));
    if (!d.ok) {
      await desfazer(d.porque);
      return { ok: false, porque: d.porque };
    }
    return { ok: true, encerradas: d.encerradas };
  }
  const eClyon = f.avisaComoTrabalhoClyon && v.eClyon;
  const existentes = await negociacoesDoPedido(pedidoId).catch(() => []);
  const doTrabalhoClyon = eClyon ? (await (await import("./db")).quemTemOTrabalhoClyon(pedidoId)).vivos : [];

  const r = await cancelarPedido(pedidoId, { motivo: MOTIVO });
  if (!r) {
    await desfazer("pedido não encontrado");
    return { ok: false, porque: "pedido não encontrado" };
  }
  await gravarMotivoDoFecho(pedidoId, "ja_nao_precisa", null, null).catch(() => {});
  // Para a purga, daqui a 7 dias — nada sai agora.
  await pool.execute(
    `UPDATE ${f.tabela} SET anonimizarAPartirDe = NOW() + INTERVAL ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} DAY WHERE pedidoId = ?`,
    [pedidoId],
  );
  if (eClyon) {
    const { avisarCancelamentoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarCancelamentoDoTrabalhoClyon({
      pedidoId,
      servico: v.servico,
      localidade: v.localidade,
      motivo: MOTIVO,
      quem: doTrabalhoClyon,
    }).catch(() => 0);
  } else {
    const { avisarDoCancelamento } = await import("./avisar-cancelamento");
    await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo: MOTIVO, porQuem: "cliente" }).catch(() => {});
  }
  if (f.paraAValidade) {
    try {
      const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
      await marcarCicloTerminado(pedidoId, `pedido cancelado pelo lembrete (${f.decisao})`);
    } catch {
      /* sem ciclo da validade */
    }
  }
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const { mensagemDeCancelamento } = await import("./mensagens-das-fases");
  await enviarTextoWhatsApp(telefone, mensagemDeCancelamento()).catch(() => false);

  const resumo = f.resumo(r.encerradas);
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId, autorTipo: "cliente", autorNome: f.autorNome, resumo });
  return { ok: true, encerradas: r.encerradas };
}

/* ── O que a conversa chama ──────────────────────────────────────────────── */

/**
 * O CLIENTE DISSE QUE JÁ NÃO PRECISA (ou escreveu o CANCELAR):
 *
 *   · «logo» (d71): cancela;
 *   · «pergunta», sem a pergunta feita: pergunta;
 *   · «pergunta», à espera, com o CANCELAR: cancela; outro texto não cancela
 *     nem pergunta outra vez; sem o texto (a conversa não o passa): ok false,
 *     para a equipa confirmar à mão.
 */
export async function responderAoCancelamento(
  f: FonteDoCancelamento,
  pool: Pool,
  pedidoId: number,
  telefone: string,
  textoDoCliente: string | null | undefined,
  opcoes: Parameters<typeof cancelarPeloLembreteComum>[4],
): Promise<ResultadoDoCancelamentoComum> {
  if (f.confirmacao === "logo") {
    const r = await cancelarPeloLembreteComum(f, pool, pedidoId, telefone, opcoes);
    return r.ok ? { ok: true, estado: "cancelado" } : r;
  }
  const estado = await estadoDaPergunta(f, pool, pedidoId);
  if (!estado) return { ok: false, porque: `sem ciclo a correr para este pedido (${f.decisao})` };
  if (!estado.aEspera) return perguntarSeCancela(f, pool, pedidoId, telefone);
  if (textoDoCliente == null) return { ok: false, porque: "à espera do CANCELAR, sem o texto do cliente — confirmar à mão" };
  if (!eConfirmacaoDoCancelamento(textoDoCliente)) return { ok: true, estado: "a_espera_de_cancelar", porque: "a resposta não é o CANCELAR" };
  const r = await cancelarPeloLembreteComum(f, pool, pedidoId, telefone, opcoes);
  return r.ok ? { ok: true, estado: "cancelado" } : r;
}
