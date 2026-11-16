/**
 * NADA PAGO REGISTADO — 16-11-2026 (d52). Uma referência do valor final sai
 * com o total quando o trabalho não tem nenhum pagamento do cliente dado por
 * pago; se o cliente já pagou uma parte por fora e ninguém a registou, sai a
 * mais. O ecrã avisa antes do «Enviar» e pede um segundo clique.
 */
export const AVISO_SEM_NADA_PAGO =
  "Não há nada pago registado neste trabalho. Se o cliente já pagou uma parte, registe-a primeiro " +
  "(Pagamentos › «Já recebemos») — senão a referência sai com o total.";

export function semNadaPagoRegistado(c: { modo: string; pagoAteAgora?: number } | null | undefined): boolean {
  return c?.modo === "referencia" && !((c.pagoAteAgora ?? 0) > 0);
}
