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
export type OrigemDoCancelamento = "conversa" | "vitoria" | "link" | "conta" | "app";

const NO_HISTORICO: Record<OrigemDoCancelamento, string> = {
  conversa: "na conversa do WhatsApp (d93)",
  vitoria: "à pergunta da Vitória no WhatsApp (CANCELAR, d92/d102)",
  link: "na ligação do pedido (d102)",
  conta: "na conta do site (d102)",
  app: "na app de cliente (d102)",
};

const AUTOR: Record<OrigemDoCancelamento, string> = {
  conversa: "WhatsApp (o cliente cancelou)",
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
): Promise<"whatsapp" | "email" | null> {
  const texto = mensagemDoCancelamentoPeloCliente(pedidoId);
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
  const daConversa = opcoes.origem === "conversa" || opcoes.origem === "vitoria";
  const mensagemPor = await confirmarAoCliente(pedidoId, { telefone, email: p.contactEmail, daConversa }).catch(() => null);

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
    (mensagemPor ? ` Confirmação ao cliente por ${mensagemPor === "whatsapp" ? "WhatsApp" : "email"}.` : " A confirmação ao cliente não saiu.");
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
  let conversaApagada = false;
  if (telefone) {
    const outros = (await pedidosAbertosDoTelefone(telefone).catch(() => [1])).filter((id) => id !== pedidoId);
    if (outros.length === 0) {
      const { apagarConversaWhatsApp } = await import("./db");
      conversaApagada = await apagarConversaWhatsApp(telefone)
        .then(() => true)
        .catch(() => false);
    }
  }
  return { ok: true, encerradas: r.encerradas, conversaApagada, mensagemPor };
}

/** Pela conversa (d93): o pedido tem de ser deste telefone. */
export async function cancelarPeloCliente(pedidoId: number, telefone: string): Promise<ResultadoDoCancelamentoPeloCliente> {
  return cancelarEApagarNaHora(pedidoId, { origem: "conversa", telefone, verificarTelefone: true });
}
