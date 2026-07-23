export const QUOTE_APPROVAL_SOURCE_STATUSES = ["received", "in_review"] as const;
export const QUOTE_APPROVAL_TARGET_STATUS = "awaiting_deposit" as const;
const QUOTE_VALUE_REQUIRED_STATUSES = [QUOTE_APPROVAL_TARGET_STATUS, "confirmed"] as const;

export type QuoteApprovalPayload = {
  status: typeof QUOTE_APPROVAL_TARGET_STATUS;
  estimated_price: number;
  admin_note: string;
};

/**
 * A aprovação de orçamento é o passo administrativo que comunica o valor ao
 * cliente e coloca o pedido em espera pelo respectivo depósito. O estado
 * `confirmed` fica reservado para a confirmação posterior dessa etapa.
 */
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
  const approvalNote = "Orçamento aprovado; pedido colocado a aguardar depósito.";

  return {
    payload: {
      status: QUOTE_APPROVAL_TARGET_STATUS,
      estimated_price: normalizedPrice,
      admin_note: extraNote ? `${approvalNote} ${extraNote}` : approvalNote,
    },
    error: null,
  };
}
