import { CUSTOMER_APPROVAL_STATUS } from "./order-status-flow";

/**
 * Proposta de preço ao cliente — substitui a antiga "aprovação de orçamento".
 *
 * Plano de negociação de 24-07-2026 (§3, §6, §9): o admin já não aprova o
 * pedido diretamente para `confirmed`. Envia uma PROPOSTA, o cliente decide,
 * e só depois de ele aceitar e pagar a reserva é que o pedido é publicado.
 *
 * A escrita é feita pela RPC admin_send_price_proposal do Bridge — este
 * módulo só valida o que o painel recolhe antes de a chamar.
 */

/** Estados a partir dos quais o admin pode enviar (ou reenviar) uma proposta. */
export const QUOTE_APPROVAL_SOURCE_STATUSES = ["draft", "received", "in_review"] as const;

/** Estado onde o pedido fica após a proposta ser enviada. */
export const QUOTE_APPROVAL_TARGET_STATUS = CUSTOMER_APPROVAL_STATUS;

/**
 * Estados que não fazem sentido sem um valor definido.
 * NOTA-PARA-O-SITE.md §1: sem preço, o trigger não publica e o pedido fica
 * invisível aos profissionais SEM ERRO NENHUM. `awaiting_customer_approval`
 * entra na lista porque enviar o cliente a decidir sem valor é absurdo.
 */
const QUOTE_VALUE_REQUIRED_STATUSES = [
  CUSTOMER_APPROVAL_STATUS, "awaiting_deposit", "confirmed", "assignment_pending",
] as const;

/** Mínimo de caracteres da justificação (obrigatória — plano §9). */
export const PROPOSAL_MESSAGE_MIN_LENGTH = 10;

export function isQuoteApprovalAvailable(status: string | null | undefined): boolean {
  return (QUOTE_APPROVAL_SOURCE_STATUSES as readonly string[]).includes(status ?? "");
}

export function quotePriceIsRequiredForStatus(status: string | null | undefined): boolean {
  return (QUOTE_VALUE_REQUIRED_STATUSES as readonly string[]).includes(status ?? "");
}

export function validatedQuotePrice(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function quoteApprovalError(value: unknown): string | null {
  return validatedQuotePrice(value) === null
    ? "Indique um valor de proposta superior a 0 €."
    : null;
}

/**
 * Valida os dados da proposta antes de chamar a RPC. Usada pela UI (para
 * desactivar o botão e explicar porquê) e pela rota API (para não confiar
 * no cliente). A justificação é obrigatória por decisão de produto.
 */
export function validateProposal(
  amount: unknown,
  message: unknown,
): { ok: boolean; error: string | null } {
  const priceError = quoteApprovalError(amount);
  if (priceError) return { ok: false, error: priceError };

  const text = typeof message === "string" ? message.trim() : "";
  if (text.length < PROPOSAL_MESSAGE_MIN_LENGTH) {
    return {
      ok: false,
      error: `A justificação é obrigatória e deve explicar o valor ao cliente (mínimo ${PROPOSAL_MESSAGE_MIN_LENGTH} caracteres).`,
    };
  }

  return { ok: true, error: null };
}
