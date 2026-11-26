/**
 * AS ACÇÕES DA VITÓRIA AGENTE NA BASE — d92, fases 4 e 5 (23-11-2026).
 *
 *  - os PENDENTES: o que o agente propôs e fica à espera do cliente (o fecho,
 *    o cancelar) ou do parceiro (a condição). Guardam-se no registo
 *    `vitoriaAccoes` (ferramenta «pendente»; «pendente_fim» quando acabam),
 *    com `ensaio = 1` no ensaio e `ensaio = 0` a sério — nunca se misturam;
 *  - as dependências de verdade das ferramentas novas: as propostas com a
 *    conta e o regime (a mesma conta da mensagem das propostas), o que o fecho
 *    precisa de saber do pedido, e as perguntas frequentes do site;
 *  - o CANCELAR pela pergunta do agente, pelo caminho único
 *    (`cancelar-pelo-lembrete.ts`), com a fonte «d92» e a tabela
 *    `vitoriaCancelamentos` (criada só quando se usa, com o interruptor
 *    «aceitar» ligado).
 *
 * Nada aqui corre com os interruptores desligados, a não ser os pendentes do
 * ensaio (só o registo do agente).
 */

import { garantirTabelas, registarAccao } from "./na-base";
import { lerPendente, type Pendente } from "./pendentes";
import { propostasParaOAgente, type NegociacaoParaOAgente, type PedidoParaOFecho, type PropostaComOValorDoParceiro } from "./propostas-do-agente";
import type { PerguntaDoSite } from "./ferramentas";
import type { FonteDoCancelamento } from "../cancelar-pelo-lembrete";
import { SELO_DO_VERIFICADO } from "../parceiro-verificado";

/* ── Os pendentes ────────────────────────────────────────────────────────── */

/** Grava o que ficou pendente. Nunca lança. */
export async function gravarPendente(telefone: string, p: Pendente, ensaio: boolean, ensaioId: number | null = null): Promise<void> {
  await registarAccao({ ferramenta: "pendente", resultado: p, telefone, pedidoId: p.pedidoId, ensaio, ensaioId });
}

/** Acaba o pendente (confirmado, outra resposta, expirado…). Nunca lança. */
export async function acabarPendente(telefone: string, p: Pendente, como: string, ensaio: boolean, ensaioId: number | null = null): Promise<void> {
  await registarAccao({ ferramenta: "pendente_fim", resultado: { ...p, como }, telefone, pedidoId: p.pedidoId, ensaio, ensaioId });
}

/** O pendente em aberto deste telefone (o último registo, se for um «pendente»), no ensaio ou a sério. */
export async function pendenteDoTelefone(telefone: string, ensaio: boolean): Promise<Pendente | null> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      `SELECT ferramenta, resultadoJson FROM vitoriaAccoes
        WHERE telefone = ? AND ensaio = ? AND ferramenta IN ('pendente', 'pendente_fim')
          AND criadoEm >= UTC_TIMESTAMP() - INTERVAL 49 HOUR
        ORDER BY id DESC LIMIT 1`,
      [String(telefone).replace(/\D/g, "").slice(-20), ensaio ? 1 : 0],
    )) as [Array<{ ferramenta: string; resultadoJson: string | null }>, unknown];
    const l = rows[0];
    if (!l || l.ferramenta !== "pendente") return null;
    return lerPendente(l.resultadoJson);
  } catch {
    return null;
  }
}

/* ── As dependências de verdade das ferramentas novas ────────────────────── */

/** As negociações do pedido que seguem o modelo de 15-11 (a regra do servidor; a data se a leitura falhar). */
async function doNovoModelo(linhas: ReadonlyArray<{ id?: unknown; estado?: unknown; ofertaClyon?: unknown }>): Promise<Set<number>> {
  const { novoModeloEmVigor, eDoNovoModelo } = await import("../novo-modelo");
  const { agoraDoModelo } = await import("../relogio-do-modelo");
  const agora = agoraDoModelo();
  if (!novoModeloEmVigor(agora) || linhas.length === 0) return new Set();
  const { negociacoesNoNovoModelo } = await import("../novo-modelo-no-servidor");
  return negociacoesNoNovoModelo(linhas, agora).catch(
    async () => new Set(linhas.filter((n) => eDoNovoModelo({ ofertaClyon: n.ofertaClyon as string | null | undefined }, agora)).map((n) => Number(n.id))),
  );
}

/** As propostas que o cliente pode escolher, com a conta e o regime. Sem as dos pedidos de valor único (quem escolhe é a equipa). */
export async function propostasParaEscolherDeVerdade(pedidoId: number): Promise<PropostaComOValorDoParceiro[]> {
  const db = await import("../db");
  const { pedidosComValorUnicoPorDecidir } = await import("../valor-unico-no-whatsapp-na-base");
  if ((await pedidosComValorUnicoPorDecidir([pedidoId])).includes(pedidoId)) return [];
  const pedido = await db.getSimulatorOrderById(pedidoId);
  const linhas = (await db.negociacoesDoPedido(pedidoId)) as unknown as NegociacaoParaOAgente[];
  return propostasParaOAgente(pedidoId, linhas, await doNovoModelo(linhas), (pedido as { baseDoPreco?: unknown } | undefined)?.baseDoPreco);
}

/** O que o fecho pelo agente precisa de saber do pedido. */
export async function pedidoParaOFechoDeVerdade(pedidoId: number): Promise<PedidoParaOFecho> {
  const db = await import("../db");
  const { pedidosComValorUnicoPorDecidir } = await import("../valor-unico-no-whatsapp-na-base");
  const pedido = (await db.getSimulatorOrderById(pedidoId)) as { status?: string | null; baseDoPreco?: unknown } | undefined;
  const linhas = await db.negociacoesDoPedido(pedidoId);
  return {
    status: pedido?.status ?? null,
    baseDoPreco: pedido?.baseDoPreco,
    temValorUnicoPorDecidir: (await pedidosComValorUnicoPorDecidir([pedidoId])).includes(pedidoId),
    temAcordada: linhas.some((n) => n.estado === "acordada"),
    jaPago: /\bpago\b|pagamento/i.test(String(pedido?.status ?? "")),
  };
}

/** As perguntas frequentes do site (as da página /faq, com o preço das mudanças de agora) e as frases do site que lá não estão. */
export async function perguntasDoSite(agora: Date): Promise<PerguntaDoSite[]> {
  const { perguntasFrequentes } = await import("../perguntas-frequentes");
  const { precoPublicoConhecido } = await import("../preco-publico-das-mudancas");
  const { AVISO_DA_LIMPEZA } = await import("../whatsapp-recolha");
  const { textoDaConfirmacaoDoCancelamento } = await import("../validade-do-orcamento");
  const lista: PerguntaDoSite[] = perguntasFrequentes(precoPublicoConhecido(), agora).flatMap((c) =>
    c.questions.map((q) => ({ pergunta: `${c.category} — ${q.q}`, resposta: q.a })),
  );
  lista.push(
    { pergunta: "Limpeza depois do esvaziamento", resposta: AVISO_DA_LIMPEZA },
    {
      pergunta: "O selo dos parceiros (o que quer dizer)",
      resposta: `O selo «${SELO_DO_VERIFICADO}» aparece junto dos parceiros a quem a CLYON confirmou o NIF, a identidade e o contacto. Diz-se de um parceiro só quando a proposta dele o mostra.`,
    },
    {
      pergunta: "Como cancelar um pedido",
      resposta: `Enquanto não há trabalho contratado nem data marcada, cancela-se pelo WhatsApp: pede-se a confirmação («${textoDaConfirmacaoDoCancelamento(0).replace("#0", "#N")}») e só o CANCELAR cancela. Com trabalho contratado ou data marcada, quem trata é uma pessoa da equipa.`,
    },
  );
  return lista;
}

/* ── O CANCELAR pela pergunta do agente ──────────────────────────────────── */

export const SQL_DOS_CANCELAMENTOS_DO_AGENTE = `CREATE TABLE IF NOT EXISTS vitoriaCancelamentos (
      pedidoId             INT UNSIGNED NOT NULL PRIMARY KEY,
      telefone             VARCHAR(20) NULL DEFAULT NULL,
      cancelarPedidoEm     DATETIME NULL DEFAULT NULL,
      canceladoEm          DATETIME NULL DEFAULT NULL,
      porEnviar            TEXT NULL,
      porEnviarDesde       DATETIME NULL DEFAULT NULL,
      paradoEm             DATETIME NULL DEFAULT NULL,
      paradoPorque         VARCHAR(255) NULL DEFAULT NULL,
      arquivadoEm          DATETIME NULL DEFAULT NULL,
      anonimizarAPartirDe  DATETIME NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** A fonte do cancelar da Vitória agente, para o caminho único. Com a pergunta: só o CANCELAR (48 h) cancela. */
export const FONTE_DO_CANCELAR_DO_AGENTE: FonteDoCancelamento = {
  decisao: "d92",
  tabela: "vitoriaCancelamentos",
  agoraSql: "UTC_TIMESTAMP()",
  abertoSql: "arquivadoEm IS NULL",
  confirmacao: "pergunta",
  aoPerguntarSql: "paradoEm = COALESCE(paradoEm, UTC_TIMESTAMP()), paradoPorque = COALESCE(paradoPorque, ?)",
  autorNome: "WhatsApp (Vitória agente)",
  notaDaPergunta: "O cliente pediu à Vitória para cancelar: perguntámos se confirma (responde CANCELAR). Nada foi cancelado.",
  resumo: (n) => `O cliente confirmou com CANCELAR, à pergunta da Vitória (d92): pedido cancelado, ${n} negociação(ões) encerrada(s).`,
  avisaComoTrabalhoClyon: false,
  paraAValidade: true,
  // d102 (24-11-2026): o CANCELAR à Vitória cancela como na conversa (d93) — dados apagados na hora, «não contactar».
  anonimizaNaHora: true,
};

async function poolDosCancelamentos() {
  const pool = await garantirTabelas();
  await pool.execute(SQL_DOS_CANCELAMENTOS_DO_AGENTE);
  return pool;
}

/** A pergunta do CANCELAR saiu (na resposta do agente): fica a valer 48 h. Um pedido já cancelado não se reabre. */
export async function marcarPerguntaDoCancelar(pedidoId: number, telefone: string): Promise<void> {
  const pool = await poolDosCancelamentos();
  const { appendOrderHistory } = await import("../db");
  await pool.execute(
    `INSERT INTO vitoriaCancelamentos (pedidoId, telefone, cancelarPedidoEm) VALUES (?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE cancelarPedidoEm = IF(canceladoEm IS NULL, UTC_TIMESTAMP(), cancelarPedidoEm), telefone = VALUES(telefone)`,
    [pedidoId, String(telefone).replace(/\D/g, "").slice(-20)],
  );
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: FONTE_DO_CANCELAR_DO_AGENTE.notaDaPergunta }).catch(() => {});
}

/**
 * O CANCELAR do cliente: cancela pelo caminho único (`cancelarEApagarNaHora`,
 * o da d93/d126), se o pedido é deste telefone. As excepções — o dinheiro, o
 * acordo, a data marcada — são as de `porqueFicaComAEquipa`, lidas lá, e
 * voltam com `daEquipa` (quem chama diz porquê ao cliente).
 *
 * d126, continuação (26-11-2026): um Trabalho CLYON com parceiros que só ACEITARAM (sem
 * contratado, pagamento nem data) cancela-se como os outros, e os parceiros
 * são avisados como no cancelamento dos Trabalhos CLYON. Antes, «é um Trabalho
 * CLYON» passava a conversa à equipa e nada se cancelava (o caso do 26/11).
 */
export async function cancelarPeloCancelarDoAgente(
  pedidoId: number,
  telefone: string,
): Promise<{ ok: true } | { ok: false; porque: string; daEquipa?: boolean }> {
  const pool = await poolDosCancelamentos();
  const { cancelarPeloLembreteComum } = await import("../cancelar-pelo-lembrete");
  const r = await cancelarPeloLembreteComum(FONTE_DO_CANCELAR_DO_AGENTE, pool, pedidoId, telefone, {
    verificar: async () => {
      const db = await import("../db");
      const { pedidosDoTelefone } = await import("../whatsapp-negociacao");
      if (!(await pedidosDoTelefone(telefone)).includes(pedidoId)) return { porque: "o pedido não é deste telefone" };
      const p = (await db.getSimulatorOrderById(pedidoId)) as { status?: string | null; serviceType?: string | null; city?: string | null } | undefined;
      if (!p) return { porque: "pedido não encontrado" };
      if (/cancel|conclu|complet/i.test(String(p.status ?? ""))) return { porque: `o pedido está ${p.status}` };
      // O contratado, a data, o pago, a referência viva e o faturado: as regras de sempre, no caminho único.
      return { eClyon: false, servico: p.serviceType ?? null, localidade: p.city ?? null };
    },
  });
  return r.ok ? { ok: true } : r;
}
