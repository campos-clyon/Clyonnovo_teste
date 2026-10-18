/**
 * Leitura do preço de um pedido do site (MySQL simulatorOrders).
 *
 * Aqui vivia também a leitura do motor de preços da app antiga (`price_status`,
 * `estimate_min`/`estimate_max` nos pedidos dela). Saiu a 18-10-2026, com a
 * secção «App CLYON» do backoffice, que era quem a usava.
 */

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Formata um valor em euros sem casas decimais desnecessárias. */
export function eur(v: number): string {
  return v.toLocaleString("pt-PT", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ─── Fluxo legado do site (MySQL simulatorOrders) ────────────────────────
// `"0.00"` é uma string truthy, por isso `if (!v)` deixava passar zeros e as
// cadeias `??` paravam no primeiro valor não-nulo mesmo quando era 0 — e os
// intervalos estimateMin/estimateMax, declarados no tipo, nunca eram
// consultados.

/** Primeiro valor estritamente positivo de uma lista. */
export function firstPositive(
  ...values: Array<number | string | null | undefined>
): number | null {
  for (const v of values) {
    const n = num(v);
    if (n !== null && n > 0) return n;
  }
  return null;
}

export interface LegacyOrderPrice {
  estimateTotal?: string | number | null;
  estimateMin?: string | number | null;
  estimateMax?: string | number | null;
  precoFinal?: string | number | null;
  precoFinalIva?: string | number | null;
}

/**
 * Texto de preço para pedidos do fluxo legado. Cai para o intervalo quando
 * os totais vêm a 0 — em vez de mostrar "0 €" ou "—" com o valor ali ao lado.
 * `withVat` escolhe entre a coluna c/IVA e as s/IVA.
 */
export function legacyPriceText(
  o: LegacyOrderPrice | null | undefined,
  opts: { withVat?: boolean } = {},
): string | null {
  if (!o) return null;
  const direct = opts.withVat
    ? firstPositive(o.precoFinalIva, o.precoFinal, o.estimateTotal)
    : firstPositive(o.precoFinal, o.estimateTotal);
  if (direct !== null) return `${eur(direct)} €`;

  const min = num(o.estimateMin);
  const max = num(o.estimateMax);
  if (min !== null && max !== null && min > 0 && max > 0) {
    return min === max ? `${eur(min)} €` : `${eur(min)} – ${eur(max)} €`;
  }
  return null;
}

/** true quando há algum valor positivo, incluindo só o intervalo. */
export function legacyHasPrice(o: LegacyOrderPrice | null | undefined): boolean {
  return legacyPriceText(o) !== null;
}
