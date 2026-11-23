/**
 * O PROFISSIONAL RECEBE DEPOIS DO CLIENTE — d5 (CEO e dono, 22-11-2026).
 *
 * Nos Trabalhos CLYON a CLYON recebe do cliente e paga ao profissional. Houve
 * trabalhos pagos ao profissional antes de o cliente pagar: num deles o
 * cliente acabou por pagar 100 € a menos e a CLYON ficou com −100 €. Por isso o
 * «Pagar ao profissional» só fica livre depois de o cliente pagar; antes, pede
 * um motivo escrito do administrador, que fica no histórico do pedido e no
 * registo permanente.
 *
 * Só nos Trabalhos CLYON. Nos outros pedidos vale a regra de sempre (o «já
 * pagámos» dos Pagamentos anota o adiantamento). Pura; as duas rotas que
 * marcam o pagamento (Pagamentos e Carteiras) chamam-na.
 */

/** O motivo que a rota pede — curto, mas dito. */
export const MOTIVO_DO_ADIANTAMENTO_MINIMO = 3;
export const MOTIVO_DO_ADIANTAMENTO_MAXIMO = 300;

/** A frase da recusa, que o backoffice mostra e que leva a caixa do motivo. */
export const PAGAR_ANTES_DO_CLIENTE =
  "O cliente ainda não pagou este Trabalho CLYON. Para pagar antes, escreva o motivo (fica registado).";

/** Um Trabalho CLYON é o pedido com valor fixo ou a negociação que nasceu de uma oferta. */
export function eTrabalhoClyon(l: { valorFixoClyon?: unknown; ofertaClyon?: unknown }): boolean {
  if (l.valorFixoClyon != null && l.valorFixoClyon !== "") return true;
  return typeof l.ofertaClyon === "string" && l.ofertaClyon.trim() !== "";
}

/** O motivo escrito, aparado e dentro do limite, ou nulo se não serve. */
export function lerMotivoDoAdiantamento(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/\s+/g, " ");
  return m.length >= MOTIVO_DO_ADIANTAMENTO_MINIMO ? m.slice(0, MOTIVO_DO_ADIANTAMENTO_MAXIMO) : null;
}

/**
 * Pode marcar-se como pago ao profissional? Sim, sem mais, quando o cliente já
 * pagou ou não é um Trabalho CLYON; sim com `adiantadoPor` (o motivo, para o
 * histórico) quando o cliente ainda não pagou e veio um motivo; não, sem ele.
 */
export type PodePagarAoProfissional = { ok: true; adiantadoPor: string | null } | { ok: false; precisaDeMotivo: true };

export function podePagarAoProfissional(
  l: { valorFixoClyon?: unknown; ofertaClyon?: unknown; clientePagouEm?: unknown },
  motivo: unknown,
): PodePagarAoProfissional {
  if (!eTrabalhoClyon(l) || l.clientePagouEm != null) return { ok: true, adiantadoPor: null };
  const m = lerMotivoDoAdiantamento(motivo);
  return m ? { ok: true, adiantadoPor: m } : { ok: false, precisaDeMotivo: true };
}
