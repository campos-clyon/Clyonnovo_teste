import { APPROVAL_TARGET_STATUS } from "./order-status-flow";

/**
 * Aprovação de orçamento — alinhada com CONTRATO.md §3:
 * admin_approve_request exige preço definido, rejeita se o pedido não
 * estiver em received/in_review/draft, e coloca o pedido em "confirmed".
 * A publicação aos parceiros é automática (trigger auto_match, §4) —
 * o backoffice NÃO publica por sua conta.
 */
export const QUOTE_APPROVAL_SOURCE_STATUSES = ["draft", "received", "in_review"] as const;
export const QUOTE_APPROVAL_TARGET_STATUS = APPROVAL_TARGET_STATUS;
const QUOTE_VALUE_REQUIRED_STATUSES = ["awaiting_deposit", "confirmed"] as const;

export type QuoteApprovalPayload = {
  status: typeof QUOTE_APPROVAL_TARGET_STATUS;
  estimated_price: number;
  admin_note: string;
};

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
    ? "Indique um valor de orçamento superior a 0 € antes de aprovar."
    : null;
}

export function buildQuoteApprovalPayload(
  price: unknown,
  note?: string | null,
): { payload: QuoteApprovalPayload | null; error: string | null } {
  const error = quoteApprovalError(price);
  if (error) return { payload: null, error };

  const normalizedPrice = validatedQuotePrice(price)!;
  const extraNote = typeof note === "string" ? note.trim() : "";
  const approvalNote = "Orçamento aprovado; pedido confirmado — publicação aos parceiros é automática.";

  return {
    payload: {
      status: QUOTE_APPROVAL_TARGET_STATUS,
      estimated_price: normalizedPrice,
      admin_note: extraNote ? `${approvalNote} ${extraNote}` : approvalNote,
    },
    error: null,
  };
}
