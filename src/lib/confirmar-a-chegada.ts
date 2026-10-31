import { appendOrderHistory, confirmarChegadaPeloCliente, perfilDoProfissional, registarSemFalhar } from "@/lib/db";
import { sendPushToUser } from "@/lib/webpush";

/**
 * A CHEGADA CONFIRMADA — uma função só, para as portas todas (d3, 31-10-2026).
 *
 * O cliente confirma que o parceiro chegou pelo link, pela conta, pela app de
 * cliente (`agir-como-cliente.ts`), pelo WhatsApp com um «SIM» à Vitória
 * (`chegada-pelo-whatsapp.ts`), ou ao telefone — e então é a equipa que a
 * grava no backoffice, com o nome de quem o fez. Em todas: grava-se uma vez,
 * só depois do «Cheguei» (`confirmarChegadaPeloCliente`), fica no histórico e
 * no registo, e o profissional recebe o aviso no telemóvel para concluir.
 *
 * Devolve false quando não havia nada para confirmar (já confirmada, ou ele
 * ainda não disse «Cheguei»). Os avisos nunca desfazem a gravação.
 */
export async function confirmarAChegada(c: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  /** Para o histórico: «pelo link do pedido», «pelo WhatsApp», «por telefone, registado no backoffice por …». */
  onde: string;
  autorTipo: "cliente" | "clyon";
  autorNome: string | null;
}): Promise<boolean> {
  const gravou = await confirmarChegadaPeloCliente(c.negociacaoId, c.pedidoId);
  if (!gravou) return false;
  await appendOrderHistory(c.pedidoId, {
    type: "created",
    by: null,
    message: `Cliente confirmou a chegada (negociação #${c.negociacaoId}, ${c.onde}).`,
  }).catch((err) => console.error("[confirmar-a-chegada] histórico:", err));
  await registarSemFalhar({
    acontecimento: "chegada_confirmada",
    pedidoId: c.pedidoId,
    negociacaoId: c.negociacaoId,
    providerId: c.providerId,
    autorTipo: c.autorTipo,
    autorNome: c.autorNome,
    resumo: c.autorTipo === "clyon" ? "A CLYON registou a chegada confirmada pelo cliente." : "O cliente confirmou a chegada.",
  });
  return true;
}

/** O aviso ao profissional: «já pode concluir». Nunca lança. */
export async function avisarProfissionalDaChegadaConfirmada(c: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
}): Promise<void> {
  try {
    const alvo = await perfilDoProfissional(c.providerId).catch(() => null);
    if (!alvo?.email) return;
    await sendPushToUser(String(alvo.email), {
      title: "O cliente confirmou que chegou",
      body: `Pedido #${c.pedidoId}: já pode concluir o trabalho quando terminar.`,
      url: "/profissionais/painel",
      tag: `chegada-${c.negociacaoId}`,
      negociacaoId: c.negociacaoId,
    }, "pro");
  } catch (err) {
    console.error("[confirmar-a-chegada] o aviso ao profissional não saiu:", err);
  }
}
