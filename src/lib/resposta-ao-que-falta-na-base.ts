import { appendOrderHistory, getPool, getSimulatorOrderById } from "./db";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "./o-que-falta-no-pedido";
import type { ChaveDaFalta } from "./mensagem-do-que-falta";
import { estadoDeVoltaDoPrecisaInfo, PEDIDO_COMPLETO_PELA_CONTA, PEDIDO_COMPLETO_PELO_WHATSAPP, podeSairDoPrecisaInfo } from "./resposta-ao-que-falta";

/**
 * O PEDIDO QUE FICOU COMPLETO PELO WHATSAPP — 22-11-2026 (decisão d86). A base
 * da `resposta-ao-que-falta.ts`.
 *
 * Depois de a Vitória gravar o que o cliente respondeu, conta-se outra vez o
 * que falta, com o pedido como ficou na base (`oQueFaltaNoPedido`, a mesma
 * lista do botão «Pedir o que falta»). Se o pedido estava em «precisa info» à
 * espera do «Pedir o que falta» e já não falta nada, volta ao estado de um
 * pedido que a Vitória registou — «atribuído» se alguém o tem, «por atribuir»
 * se não —, na fila «por enviar», onde a equipa o confere e o envia aos
 * parceiros. Pela base e não por `updateSimulatorOrder`: esse manda ao
 * cliente o email da mudança de estado, e a resposta já lhe chegou pelo
 * WhatsApp. Só sai de «precisa info» (a guarda no UPDATE): se entretanto
 * alguém lhe mudou o estado, fica o de quem mudou.
 */
export async function oPedidoFicouCompleto(
  pedidoId: number,
  canal: "whatsapp" | "conta" = "whatsapp",
): Promise<{ faltas: ChaveDaFalta[]; saiu: boolean }> {
  const pedido = await getSimulatorOrderById(pedidoId).catch(() => undefined);
  if (!pedido) return { faltas: [], saiu: false };
  const faltas = oQueFaltaNoPedido(pedido as unknown as PedidoParaOQueFalta);
  const p = pedido as unknown as { status?: string | null; mensagemCliente?: string | null; assignedToId?: unknown };
  if (!podeSairDoPrecisaInfo(p.status, p.mensagemCliente, faltas)) return { faltas, saiu: false };
  const pool = await getPool();
  if (!pool) return { faltas, saiu: false };
  const [r] = (await pool.execute(
    "UPDATE simulatorOrders SET status = ?, updatedAt = NOW() WHERE id = ? AND status = 'precisa_info'",
    [estadoDeVoltaDoPrecisaInfo(p.assignedToId), pedidoId],
  )) as [{ affectedRows?: number }, unknown];
  const saiu = Number(r?.affectedRows ?? 0) > 0;
  if (saiu) {
    await appendOrderHistory(pedidoId, { type: "created", by: null, message: canal === "conta" ? PEDIDO_COMPLETO_PELA_CONTA : PEDIDO_COMPLETO_PELO_WHATSAPP }).catch(() => {});
  }
  return { faltas, saiu };
}
