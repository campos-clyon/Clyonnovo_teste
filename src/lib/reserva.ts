import { contaDoCliente, type Taxas } from "./taxas-plataforma";

/**
 * A RESERVA PARA IMPREVISTOS — d39 (CEO e dono, 15-11-2026).
 *
 * Num pedido com valor único, o cliente paga o valor único e a CLYON escolhe
 * o parceiro e aceita a proposta DELE pelo valor dele. A diferença é a
 * reserva: valor único − o que o cliente pagaria pela proposta (sem IVA).
 *
 *   · O PARCEIRO fatura só a parte dele (a proposta dele, menos a taxa, como
 *     sempre). Não vê o valor único: vê a proposta aceite e a taxa normal; no
 *     que deve à CLYON vê uma só linha, «parte da CLYON (taxa da plataforma e
 *     reserva)».
 *   · A CLYON fatura taxa + reserva, sempre com IVA. No modelo de 15-11 passa
 *     pelo parceiro, como a taxa: o cliente paga tudo ao parceiro, e o parceiro
 *     passa a parte da CLYON pela dívida.
 *   · Reserva negativa (o escolhido pediu mais): a parte da CLYON desce, até
 *     abaixo da taxa; abaixo de zero, a CLYON paga a diferença ao parceiro por
 *     crédito na carteira (`pagamento-directo.ts`).
 *
 * Fica gravada na negociação (`negociacoes.reservaCent`, reserva-na-base.ts)
 * no momento em que a CLYON a fecha, e não muda depois: o valor único já não
 * se mexe com parceiro contratado. Em cêntimos, inteiros. PURA.
 */

export const RESERVA_EM_PALAVRAS = "reserva para imprevistos";
/** O que o parceiro lê no que deve à CLYON quando há reserva — sem dizer «valor único». */
export const PARTE_DA_CLYON_COM_RESERVA = "parte da CLYON (taxa da plataforma e reserva)";

/** valor único − o que o cliente pagaria pela proposta, sem IVA, em cêntimos. */
export function reservaDoValorUnico(valorUnicoSemIva: number, acordado: number, taxas: Taxas): number | null {
  if (!Number.isFinite(valorUnicoSemIva) || valorUnicoSemIva <= 0 || !Number.isFinite(acordado) || acordado <= 0) return null;
  const doParceiro = contaDoCliente(acordado, taxas).semIva;
  return Math.round(valorUnicoSemIva * 100) - Math.round(doParceiro * 100);
}

/** A reserva gravada numa linha (`reservaCent`), ou 0. */
export function reservaDaLinha(l: { reservaCent?: unknown } | null | undefined): number {
  const v = l?.reservaCent;
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isInteger(n) ? n : 0;
}

/**
 * A reserva só vale no valor ACORDADO de uma negociação fechada — nunca numa
 * proposta nem num ajuste (aí o cliente vê o valor da proposta).
 */
export function reservaParaOValor(
  l: { reservaCent?: unknown; estado?: unknown; valorAcordado?: unknown } | null | undefined,
  valor: number | null | undefined,
): number {
  const r = reservaDaLinha(l);
  if (r === 0 || valor == null || l?.estado !== "acordada") return 0;
  const acordado = Number(l.valorAcordado);
  return Number.isFinite(acordado) && Math.abs(acordado - valor) < 0.005 ? r : 0;
}

/** «+15,00 €» / «−10,00 €». */
export function reservaEmTexto(cent: number): string {
  const sinal = cent > 0 ? "+" : cent < 0 ? "−" : "";
  return `${sinal}${(Math.abs(cent) / 100).toFixed(2).replace(".", ",")} €`;
}
