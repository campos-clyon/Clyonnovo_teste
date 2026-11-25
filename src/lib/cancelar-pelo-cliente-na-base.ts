/**
 * O CLIENTE CANCELA PELA CONVERSA, NA BASE — d93, ponto 2 (CEO e dono,
 * 23-11-2026). As regras puras estão em `cancelar-pelo-cliente.ts`.
 *
 * O cancelamento é o de sempre — `cancelarPedido` (encerra as negociações,
 * guarda o estado de antes), o motivo «Já não precisa», os parceiros com
 * proposta avisados como no cancelamento da Mesa (num Trabalho CLYON, como no
 * dos Trabalhos CLYON), a validade (d62) e o seguimento (d83) parados — e
 * depois, por este caminho, os dados saem NA HORA:
 *
 *   1. a mensagem ao cliente («O seu pedido #N foi cancelado. Não voltaremos a
 *      contactá-lo e os seus dados foram apagados.»), antes de apagar a
 *      conversa por onde ela sai;
 *   2. o número entra na lista de «não contactar» (`nao-contactar.ts`);
 *   3. o pedido anonimiza-se (`anonimizarPedido`, o da retenção, sem o nome);
 *   4. a conversa apaga-se (`apagarConversaWhatsApp`) — só se ele não tiver
 *      outro pedido aberto (esse ainda é dele, e a conversa também).
 *
 * Nunca DELETE do pedido: a linha fica, sem o cliente (o serviço, a
 * localidade, os valores e as datas ficam para as contas).
 */

import {
  appendOrderHistory,
  cancelarPedido,
  ensureNegociacoesTable,
  ensureSimulatorOrdersTable,
  getPool,
  gravarMotivoDoFecho,
  negociacoesDoPedido,
  registarSemFalhar,
} from "./db";
import { pedidoFechado } from "./pedido-arrumado";
import { mesmoTelefoneEstrito } from "./validade-do-orcamento";
import { mensagemDepoisDeCancelar } from "./porque-cancelou";
import {
  mensagemDoCancelamentoPeloCliente,
  porqueFicaComAEquipa,
  type OPedidoParaCancelar,
} from "./cancelar-pelo-cliente";

const MOTIVO = "O cliente já não precisa";

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

async function base(): Promise<Pool> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("[cancelar-pelo-cliente] base de dados indisponível");
  return pool;
}

const existeA = async (pool: Pool, sql: string, params: number[]): Promise<boolean> => {
  try {
    const [rows] = (await pool.execute(sql, params)) as [Array<{ x: number }>, unknown];
    return rows.length > 0;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") return false;
    throw err;
  }
};

/** O pedido, como as regras do cancelamento o lêem (com o telefone, para confirmar que é dele). */
export async function lerOPedidoParaCancelar(
  pedidoId: number,
): Promise<(OPedidoParaCancelar & { contactPhone: string | null; contactEmail: string | null; eClyon: boolean; servico: string | null; localidade: string | null }) | null> {
  const pool = await base();
  const [rows] = (await pool.execute(
    `SELECT o.id, o.status, o.anonimizadoEm, o.contactPhone, o.contactEmail, o.valorFixoClyon, o.serviceType, o.city, o.scheduledDate, o.dataAgendada
       FROM simulatorOrders o WHERE o.id = ? LIMIT 1`,
    [pedidoId],
  )) as [Array<Record<string, unknown>>, unknown];
  const o = rows[0];
  if (!o) return null;
  const contratado = await existeA(
    pool,
    `SELECT 1 AS x FROM negociacoes n
      WHERE n.pedidoId = ? AND (n.estado = 'acordada' OR n.confirmadoEm IS NOT NULL OR n.execucaoEnviadaEm IS NOT NULL OR n.pagoEm IS NOT NULL)
      LIMIT 1`,
    [pedidoId],
  );
  const pago = await existeA(pool, "SELECT 1 AS x FROM pagamentos WHERE pedidoId = ? AND (estado = 'pago' OR pagoEm IS NOT NULL) LIMIT 1", [pedidoId]);
  const referenciaViva = await existeA(
    pool,
    "SELECT 1 AS x FROM pagamentos WHERE pedidoId = ? AND estado = 'pendente' AND (expiraEm IS NULL OR expiraEm > NOW()) LIMIT 1",
    [pedidoId],
  );
  const faturado = await existeA(pool, "SELECT 1 AS x FROM faturasDoTrabalho WHERE pedidoId = ? AND activa = 1 LIMIT 1", [pedidoId]);
  return {
    existe: true,
    status: (o.status as string | null) ?? null,
    anonimizado: o.anonimizadoEm != null,
    contratado,
    dataMarcada: o.scheduledDate != null || o.dataAgendada != null,
    pago,
    referenciaViva,
    faturado,
    contactPhone: (o.contactPhone as string | null) ?? null,
    contactEmail: (o.contactEmail as string | null) ?? null,
    eClyon: o.valorFixoClyon != null,
    servico: (o.serviceType as string | null) ?? null,
    localidade: (o.city as string | null) ?? null,
  };
}

/** Os pedidos abertos DESTE telefone (número inteiro), do mais recente para trás. */
export async function pedidosAbertosDoTelefone(telefone: string): Promise<number[]> {
  const pool = await base();
  const d = telefone.replace(/\D/g, "");
  if (d.length < 9) return [];
  const [rows] = (await pool.execute(
    `SELECT id, status, contactPhone FROM simulatorOrders
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9) = RIGHT(?, 9) AND anonimizadoEm IS NULL
      ORDER BY id DESC LIMIT 20`,
    [d],
  )) as [Array<{ id: number; status: string | null; contactPhone: string | null }>, unknown];
  return rows
    .filter((r) => mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone) && !pedidoFechado(r.status))
    .map((r) => Number(r.id));
}

export type ResultadoDoCancelamentoPeloCliente =
  | { ok: true; encerradas: number; conversaApagada: boolean; mensagemPor: "whatsapp" | "email" | null }
  | { ok: false; porque: string; daEquipa: boolean };

/**
 * POR ONDE O CLIENTE PEDIU PARA CANCELAR — d102 (CEO e dono, 24-11-2026):
 * a conversa (d93), o CANCELAR à pergunta da Vitória agente (d92), o painel
 * do cliente no site (o link do pedido e a conta) e a app de cliente. O
 * resultado é o MESMO pelas quatro; só muda o que fica escrito no histórico.
 */
export type OrigemDoCancelamento = "conversa" | "desistencia" | "vitoria" | "link" | "conta" | "app";

const NO_HISTORICO: Record<OrigemDoCancelamento, string> = {
  conversa: "na conversa do WhatsApp (d93)",
  desistencia: "na conversa do WhatsApp, ao dizer que já não precisa (d111)",
  vitoria: "à pergunta da Vitória no WhatsApp (CANCELAR, d92/d102)",
  link: "na ligação do pedido (d102)",
  conta: "na conta do site (d102)",
  app: "na app de cliente (d102)",
};

const AUTOR: Record<OrigemDoCancelamento, string> = {
  conversa: "WhatsApp (o cliente cancelou)",
  desistencia: "WhatsApp (o cliente desistiu)",
  vitoria: "WhatsApp (Vitória agente)",
  link: "Cliente (ligação do pedido)",
  conta: "Cliente (conta do site)",
  app: "Cliente (app)",
};

/**
 * A MENSAGEM AO CLIENTE A CONFIRMAR — pelo WhatsApp quando há telemóvel
 * português (ou é a conversa por onde ele pediu); senão, ou se o WhatsApp não
 * sair, por email. Antes de anonimizar: depois já não há contacto.
 */
async function confirmarAoCliente(
  pedidoId: number,
  contacto: { telefone: string | null; email: string | null; daConversa: boolean },
  mensagem?: string | null,
): Promise<"whatsapp" | "email" | null> {
  const texto = mensagem?.trim() || mensagemDoCancelamentoPeloCliente(pedidoId);
  const { telemovelPortugues, emailValido } = await import("./lembrete-do-que-falta");
  const tel = contacto.daConversa ? contacto.telefone : telemovelPortugues(contacto.telefone);
  if (tel) {
    const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
    if (await enviarTextoWhatsApp(tel, texto).catch(() => false)) return "whatsapp";
  }
  const email = emailValido(contacto.email);
  if (email) {
    const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
    const saiu = await enviarEmailDoSeguimento({ para: email, assunto: `O seu pedido #${pedidoId} na CLYON foi cancelado`, texto }).catch(
      () => false,
    );
    if (saiu) return "email";
  }
  return null;
}

/**
 * CANCELA, ANONIMIZA E NÃO VOLTA A CONTACTAR — o caminho único (d93, e desde
 * a d102 o de todas as portas do cliente). Confere tudo outra vez (o pedido
 * não está fechado, não tem acordo, data, pagamento, referência viva nem
 * fatura; e, pela conversa, que é deste telefone). `daEquipa: true` quando
 * fica com a equipa por uma das excepções; false quando falhou por outra razão.
 */
export async function cancelarEApagarNaHora(
  pedidoId: number,
  opcoes: {
    origem: OrigemDoCancelamento;
    /** O telefone da conversa (conversa, Vitória). Sem ele, o do pedido. */
    telefone?: string | null;
    /** Pela conversa: o pedido tem de ser deste número (o painel e a app já provaram que é dele). */
    verificarTelefone: boolean;
    /** O que se diz aos parceiros. Sem ele, «O cliente já não precisa». */
    motivo?: string | null;
    /** d111: a mensagem ao cliente, quando não é a de sempre (a da desistência). */
    mensagem?: string | null;
    /** d126: a mensagem sai depois, numa só, com os outros pedidos que ele cancelou (`cancelarOsPedidosPelaConversa`). */
    semMensagem?: boolean;
    /** d126: quem chama apaga a conversa no fim (vários pedidos de uma vez). */
    manterConversa?: boolean;
  },
): Promise<ResultadoDoCancelamentoPeloCliente> {
  const p = await lerOPedidoParaCancelar(pedidoId);
  if (!p) return { ok: false, porque: "o pedido não existe", daEquipa: false };
  const telefone = opcoes.telefone ?? p.contactPhone;
  if (opcoes.verificarTelefone && !mesmoTelefoneEstrito(p.contactPhone, String(opcoes.telefone ?? ""))) {
    return { ok: false, porque: "o pedido não é deste número", daEquipa: true };
  }
  const fica = porqueFicaComAEquipa(p);
  if (fica) return { ok: false, porque: fica, daEquipa: true };
  const motivo = (opcoes.motivo ?? "").trim() || MOTIVO;

  // Quem tem proposta — lido ANTES de cancelar, que encerra as negociações.
  const existentes = await negociacoesDoPedido(pedidoId).catch(() => []);
  const { quemTemOTrabalhoClyon } = await import("./db");
  const doTrabalhoClyon = p.eClyon ? (await quemTemOTrabalhoClyon(pedidoId).catch(() => ({ vivos: [] }))).vivos : [];

  const r = await cancelarPedido(pedidoId, { motivo });
  if (!r) return { ok: false, porque: "o pedido não se cancelou", daEquipa: false };
  await gravarMotivoDoFecho(pedidoId, "ja_nao_precisa", null, null).catch(() => {});

  // Os parceiros com proposta, como no cancelamento de sempre.
  if (p.eClyon) {
    const { avisarCancelamentoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarCancelamentoDoTrabalhoClyon({ pedidoId, servico: p.servico, localidade: p.localidade, motivo, quem: doTrabalhoClyon }).catch(() => 0);
  } else {
    const { avisarDoCancelamento } = await import("./avisar-cancelamento");
    await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo, porQuem: "cliente" }).catch(() => {});
  }
  // A validade (d62) e o seguimento (d83) param.
  try {
    const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
    await marcarCicloTerminado(pedidoId, `pedido cancelado pelo cliente ${NO_HISTORICO[opcoes.origem]}`);
  } catch {
    /* sem ciclo da validade */
  }
  try {
    const { pararSeguimento } = await import("./seguimento-do-cliente-na-base");
    await pararSeguimento(pedidoId, `pedido cancelado pelo cliente ${NO_HISTORICO[opcoes.origem]}`);
  } catch {
    /* sem seguimento */
  }

  // 1. A mensagem ao cliente, antes de a conversa se apagar e os contactos saírem.
  const daConversa = opcoes.origem === "conversa" || opcoes.origem === "desistencia" || opcoes.origem === "vitoria";
  // d126: pela conversa, a mensagem nova (cancelado + o porquê, uma só); a d111 traz a sua.
  const comOPorque = daConversa && !opcoes.mensagem?.trim();
  const mensagem = comOPorque ? mensagemDepoisDeCancelar([pedidoId], { dados: "apagados" }) : opcoes.mensagem;
  const mensagemPor = opcoes.semMensagem
    ? null
    : await confirmarAoCliente(pedidoId, { telefone, email: p.contactEmail, daConversa }, mensagem).catch(() => null);
  if (comOPorque && mensagemPor === "whatsapp" && telefone) {
    const { registarAPerguntaDoPorque } = await import("./porque-cancelou-na-base");
    await registarAPerguntaDoPorque(telefone, [pedidoId]).catch((e) =>
      console.error("[cancelar-pelo-cliente] a pergunta do porquê não ficou:", e instanceof Error ? e.message : e),
    );
  }

  // 2. Não contactar.
  if (telefone) {
    const { marcarParaNaoContactar } = await import("./nao-contactar");
    await marcarParaNaoContactar(telefone, `cancelou o pedido (${opcoes.origem}, d93/d102)`).catch((e) =>
      console.error("[cancelar-pelo-cliente] o «não contactar» não ficou:", e instanceof Error ? e.message : e),
    );
  }

  // d106: o email também, para os convites e lembretes da app (depois de anonimizar já não se sabe qual era).
  if (p.contactEmail) {
    const { marcarEmailParaNaoContactar } = await import("./nao-contactar");
    await marcarEmailParaNaoContactar(p.contactEmail, `cancelou o pedido (${opcoes.origem}, d106)`).catch((e) =>
      console.error("[cancelar-pelo-cliente] o «não contactar» do email não ficou:", e instanceof Error ? e.message : e),
    );
  }

  // O histórico e o registo ANTES de anonimizar (sem o nome nem o telefone).
  const resumo =
    `O cliente cancelou o pedido ${NO_HISTORICO[opcoes.origem]}: ${r.encerradas} negociação(ões) encerrada(s), parceiros avisados. ` +
    "Dados do cliente apagados na hora e o número marcado para não voltar a ser contactado." +
    (opcoes.semMensagem
      ? " A confirmação ao cliente sai numa só mensagem, com os outros pedidos que cancelou (d126)."
      : mensagemPor
        ? ` Confirmação ao cliente por ${mensagemPor === "whatsapp" ? "WhatsApp" : "email"}${comOPorque && mensagemPor === "whatsapp" ? ", com a pergunta do porquê (d126)" : ""}.`
        : " A confirmação ao cliente não saiu.");
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId, autorTipo: "cliente", autorNome: AUTOR[opcoes.origem], resumo });

  // 3. O pedido anonimiza-se já (o da retenção, sem o nome).
  const { anonimizarPedido } = await import("./regras-novas-na-base");
  await anonimizarPedido(pedidoId, {
    semNome: true,
    autorNome: `cancelado pelo cliente (${opcoes.origem}, d93/d102)`,
    resumo:
      `Pedido anonimizado no momento em que o cliente o cancelou ${NO_HISTORICO[opcoes.origem]}: ficam o serviço, a localidade, a zona do código postal, ` +
      "as datas e os valores; saíram o nome, os contactos, a morada, a descrição e as fotografias.",
  }).catch((e) => console.error("[cancelar-pelo-cliente] a anonimização falhou:", e instanceof Error ? e.message : e));

  // 4. A conversa apaga-se — só sem outro pedido aberto dele.
  const conversaApagada = telefone && !opcoes.manterConversa ? await apagarAConversaSemOutrosAbertos(telefone, [pedidoId]) : false;
  return { ok: true, encerradas: r.encerradas, conversaApagada, mensagemPor };
}

/**
 * A conversa apaga-se — só sem outro pedido aberto dele. A mensagem que ainda
 * está na fila da ponte (a do cancelamento, que acabou de lá entrar) NÃO se
 * apaga: sem isto, a ponte nunca a levava (d126, 25-11-2026).
 */
async function apagarAConversaSemOutrosAbertos(telefone: string, cancelados: readonly number[]): Promise<boolean> {
  const outros = (await pedidosAbertosDoTelefone(telefone).catch(() => [0])).filter((id) => !cancelados.includes(id));
  if (outros.length > 0) return false;
  const { apagarConversaWhatsApp } = await import("./db");
  return apagarConversaWhatsApp(telefone, { deixarOQueEstaPorSair: true })
    .then(() => true)
    .catch(() => false);
}

export type ResultadoDosCancelamentos = {
  cancelados: number[];
  recusados: Array<{ pedidoId: number; porque: string; daEquipa: boolean }>;
  mensagemSaiu: boolean;
  conversaApagada: boolean;
};

/**
 * OS PEDIDOS QUE ELE INDICOU, CANCELADOS DE UMA VEZ — d126 (CEO e dono,
 * 25-11-2026). Cada um pelo caminho de sempre (`cancelarEApagarNaHora`:
 * `cancelarPedido` → `fimDoPedido`, as guardas do dinheiro e do acordo, o
 * «não contactar», a anonimização), e no fim UMA mensagem com todos os que se
 * cancelaram, com a pergunta do porquê (`porque-cancelou.ts`). Os que ficam
 * com a equipa voltam em `recusados`, com o porquê — quem chama passa-os a uma
 * pessoa e diz-lhe porquê.
 */
export async function cancelarOsPedidosPelaConversa(
  pedidos: readonly number[],
  telefone: string,
  opcoes: { origem?: OrigemDoCancelamento } = {},
): Promise<ResultadoDosCancelamentos> {
  const origem = opcoes.origem ?? "conversa";
  const cancelados: number[] = [];
  const recusados: ResultadoDosCancelamentos["recusados"] = [];
  for (const pedidoId of [...new Set(pedidos)]) {
    const r = await cancelarEApagarNaHora(pedidoId, { origem, telefone, verificarTelefone: true, semMensagem: true, manterConversa: true }).catch(
      (err) => ({ ok: false as const, porque: err instanceof Error ? err.message : "erro ao cancelar", daEquipa: false }),
    );
    if (r.ok) cancelados.push(pedidoId);
    else recusados.push({ pedidoId, porque: r.porque, daEquipa: r.daEquipa });
  }
  let mensagemSaiu = false;
  if (cancelados.length > 0) {
    const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
    mensagemSaiu = await enviarTextoWhatsApp(
      telefone,
      mensagemDepoisDeCancelar(cancelados, { dados: "apagados", semMaisContacto: recusados.length === 0 }),
    ).catch(() => false);
    if (mensagemSaiu) {
      const { registarAPerguntaDoPorque } = await import("./porque-cancelou-na-base");
      await registarAPerguntaDoPorque(telefone, cancelados).catch((e) =>
        console.error("[cancelar-pelo-cliente] a pergunta do porquê não ficou:", e instanceof Error ? e.message : e),
      );
    }
    for (const id of cancelados) {
      await appendOrderHistory(id, {
        type: "note",
        by: null,
        message: mensagemSaiu
          ? `A confirmação do cancelamento saiu pelo WhatsApp, numa só mensagem (${cancelados.length > 1 ? `com ${cancelados.filter((x) => x !== id).map((x) => `#${x}`).join(", ")}` : "só este pedido"}), com a pergunta do porquê (d126).`
          : "A confirmação do cancelamento ao cliente não saiu pelo WhatsApp (d126).",
      }).catch(() => {});
    }
  }
  const conversaApagada = cancelados.length > 0 && recusados.length === 0 ? await apagarAConversaSemOutrosAbertos(telefone, cancelados) : false;
  return { cancelados, recusados, mensagemSaiu, conversaApagada };
}

/** Pela conversa (d93): o pedido tem de ser deste telefone. */
export async function cancelarPeloCliente(pedidoId: number, telefone: string): Promise<ResultadoDoCancelamentoPeloCliente> {
  return cancelarEApagarNaHora(pedidoId, { origem: "conversa", telefone, verificarTelefone: true });
}
