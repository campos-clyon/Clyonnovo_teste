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
): Promise<(OPedidoParaCancelar & { contactPhone: string | null; eClyon: boolean; servico: string | null; localidade: string | null }) | null> {
  const pool = await base();
  const [rows] = (await pool.execute(
    `SELECT o.id, o.status, o.anonimizadoEm, o.contactPhone, o.valorFixoClyon, o.serviceType, o.city, o.scheduledDate, o.dataAgendada
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
  | { ok: true; encerradas: number; conversaApagada: boolean }
  | { ok: false; porque: string; daEquipa: boolean };

/**
 * CANCELA, ANONIMIZA E NÃO VOLTA A CONTACTAR. Confere tudo outra vez (o
 * pedido é deste telefone, não está fechado, não tem acordo, pagamento,
 * referência viva nem fatura). `daEquipa: true` quando fica com a equipa por
 * uma das excepções; false quando falhou por outra razão.
 */
export async function cancelarPeloCliente(pedidoId: number, telefone: string): Promise<ResultadoDoCancelamentoPeloCliente> {
  const p = await lerOPedidoParaCancelar(pedidoId);
  if (!p) return { ok: false, porque: "o pedido não existe", daEquipa: false };
  if (!mesmoTelefoneEstrito(p.contactPhone, telefone)) return { ok: false, porque: "o pedido não é deste número", daEquipa: true };
  const fica = porqueFicaComAEquipa(p);
  if (fica) return { ok: false, porque: fica, daEquipa: true };

  // Quem tem proposta — lido ANTES de cancelar, que encerra as negociações.
  const existentes = await negociacoesDoPedido(pedidoId).catch(() => []);
  const { quemTemOTrabalhoClyon } = await import("./db");
  const doTrabalhoClyon = p.eClyon ? (await quemTemOTrabalhoClyon(pedidoId).catch(() => ({ vivos: [] }))).vivos : [];

  const r = await cancelarPedido(pedidoId, { motivo: MOTIVO });
  if (!r) return { ok: false, porque: "o pedido não se cancelou", daEquipa: false };
  await gravarMotivoDoFecho(pedidoId, "ja_nao_precisa", null, null).catch(() => {});

  // Os parceiros com proposta, como no cancelamento de sempre.
  if (p.eClyon) {
    const { avisarCancelamentoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarCancelamentoDoTrabalhoClyon({ pedidoId, servico: p.servico, localidade: p.localidade, motivo: MOTIVO, quem: doTrabalhoClyon }).catch(() => 0);
  } else {
    const { avisarDoCancelamento } = await import("./avisar-cancelamento");
    await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo: MOTIVO, porQuem: "cliente" }).catch(() => {});
  }
  // A validade (d62) e o seguimento (d83) param.
  try {
    const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
    await marcarCicloTerminado(pedidoId, "pedido cancelado pelo cliente na conversa (d93)");
  } catch {
    /* sem ciclo da validade */
  }
  try {
    const { pararSeguimento } = await import("./seguimento-do-cliente-na-base");
    await pararSeguimento(pedidoId, "pedido cancelado pelo cliente na conversa (d93)");
  } catch {
    /* sem seguimento */
  }

  // 1. A mensagem ao cliente, antes de a conversa se apagar.
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  await enviarTextoWhatsApp(telefone, mensagemDoCancelamentoPeloCliente(pedidoId)).catch(() => false);

  // 2. Não contactar.
  const { marcarParaNaoContactar } = await import("./nao-contactar");
  await marcarParaNaoContactar(telefone, `cancelou o pedido na conversa (d93)`).catch((e) =>
    console.error("[cancelar-pelo-cliente] o «não contactar» não ficou:", e instanceof Error ? e.message : e),
  );

  // O histórico e o registo ANTES de anonimizar (sem o nome nem o telefone).
  const resumo =
    `O cliente cancelou o pedido na conversa do WhatsApp (d93): ${r.encerradas} negociação(ões) encerrada(s), parceiros avisados. ` +
    "Dados do cliente apagados na hora e o número marcado para não voltar a ser contactado.";
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId, autorTipo: "cliente", autorNome: "WhatsApp (o cliente cancelou)", resumo });

  // 3. O pedido anonimiza-se já (o da retenção, sem o nome).
  const { anonimizarPedido } = await import("./regras-novas-na-base");
  await anonimizarPedido(pedidoId, {
    semNome: true,
    autorNome: "cancelado pelo cliente (d93)",
    resumo:
      "Pedido anonimizado no momento em que o cliente o cancelou na conversa (d93): ficam o serviço, a localidade, a zona do código postal, " +
      "as datas e os valores; saíram o nome, os contactos, a morada, a descrição e as fotografias.",
  }).catch((e) => console.error("[cancelar-pelo-cliente] a anonimização falhou:", e instanceof Error ? e.message : e));

  // 4. A conversa apaga-se — só sem outro pedido aberto dele.
  let conversaApagada = false;
  const outros = (await pedidosAbertosDoTelefone(telefone).catch(() => [1])).filter((id) => id !== pedidoId);
  if (outros.length === 0) {
    const { apagarConversaWhatsApp } = await import("./db");
    conversaApagada = await apagarConversaWhatsApp(telefone)
      .then(() => true)
      .catch(() => false);
  }
  return { ok: true, encerradas: r.encerradas, conversaApagada };
}
