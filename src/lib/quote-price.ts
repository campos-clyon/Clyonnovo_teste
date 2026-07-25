/**
 * Leitura do preço de um pedido — motor de preços de 25-07-2026.
 *
 * ⚠️ REGRA CENTRAL (NOTA-BRIDGE-MOTOR §3.1): `total = 0` JÁ NÃO significa
 * "sem preço". Quem continuar a ler só o total mostra 0 € em pedidos que
 * têm valor — é o mesmo bug que o cliente via, mudado para o operador.
 *
 * O motor garante: **nenhum pedido fica com preço 0 ou null.** Todo o pedido
 * sai com um valor e um estado que diz o que esse valor é.
 *
 * Todos os valores da base são SEM IVA. O IVA (23%) é acrescentado na
 * apresentação, nunca guardado.
 */

export const VAT_RATE = 0.23;

/** Estados possíveis de uma cotação (coluna price_status). */
export type PriceStatus = "firme" | "intervalo" | "revisao" | null;

/**
 * Forma mínima de uma linha com preço. Serve tanto para `price_quotes`
 * (total) como para `service_requests` (estimated_price / final_price) —
 * o motor escreve as mesmas quatro colunas novas em ambas.
 */
export interface PricedRow {
  total?: number | string | null;
  estimated_price?: number | string | null;
  final_price?: number | string | null;
  estimate_min?: number | string | null;
  estimate_max?: number | string | null;
  price_status?: string | null;
}

export type PriceKind = "fechado" | "intervalo" | "revisao" | "legado";

export interface DisplayPrice {
  kind: PriceKind;
  /** Texto pronto a mostrar, sem IVA (ex: "199 € + IVA" ou "196 – 249 € + IVA") */
  text: string;
  /** Valor s/IVA a usar em contas — ponto médio nos intervalos; null no legado */
  value: number | null;
  min: number | null;
  max: number | null;
  /** Rótulo curto do estado para chip na UI */
  label: string;
  /** true quando o operador tem de decidir antes de avançar */
  needsReview: boolean;
}

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

/** Acrescenta IVA a 23% — só na apresentação ao cliente. */
export function withVat(withoutVat: number): number {
  return Math.round(withoutVat * (1 + VAT_RATE) * 100) / 100;
}

/**
 * Decide o que mostrar ao operador. Segue a regra da NOTA-BRIDGE-MOTOR §3.1:
 *
 *   1. `price_status` explícito manda sempre
 *   2. `price_status` NULL = cotação anterior ao motor → comportamento antigo
 *
 * O total é lido de `total` (price_quotes) ou de `final_price`/`estimated_price`
 * (service_requests), pela mesma ordem de precedência que o resto do painel usa.
 */
export function displayPrice(row: PricedRow | null | undefined): DisplayPrice {
  const empty: DisplayPrice = {
    kind: "legado", text: "Sem preço calculado", value: null,
    min: null, max: null, label: "Sem preço", needsReview: false,
  };
  if (!row) return empty;

  const total = num(row.total) ?? num(row.final_price) ?? num(row.estimated_price);
  const min = num(row.estimate_min);
  const max = num(row.estimate_max);
  const status = (row.price_status ?? null) as PriceStatus;

  if (status === "firme") {
    // Preço fechado: o total manda; se vier a 0, o extremo inferior serve
    const v = total !== null && total > 0 ? total : min;
    if (v === null || v <= 0) return empty;
    return {
      kind: "fechado", text: `${eur(v)} € + IVA`, value: v,
      min: v, max: v, label: "Preço firme", needsReview: false,
    };
  }

  if (status === "intervalo" || status === "revisao") {
    if (min === null || max === null) {
      // Estado diz intervalo mas faltam extremos — cai para o total se houver
      if (total !== null && total > 0) {
        return {
          kind: status === "revisao" ? "revisao" : "intervalo",
          text: `${eur(total)} € + IVA`, value: total, min: total, max: total,
          label: status === "revisao" ? "Requer revisão" : "Estimativa",
          needsReview: status === "revisao",
        };
      }
      return empty;
    }
    const mid = Math.round(((min + max) / 2) * 100) / 100;
    return {
      kind: status === "revisao" ? "revisao" : "intervalo",
      text: `${eur(min)} – ${eur(max)} € + IVA`,
      value: mid, min, max,
      label: status === "revisao" ? "Requer revisão" : "Estimativa",
      needsReview: status === "revisao",
    };
  }

  // price_status NULL — cotação anterior ao motor
  if (total !== null && total > 0) {
    return {
      kind: "fechado", text: `${eur(total)} € + IVA`, value: total,
      min: total, max: total, label: "Preço", needsReview: false,
    };
  }
  return empty;
}

/**
 * Preço a usar para VALIDAR uma operação (avançar fase, publicar).
 *
 * ⚠️ Não usar `estimated_price` isolado: com o motor novo o valor pode viver
 * só em `estimate_min`/`estimate_max`, e validar pelo campo antigo bloqueia
 * o operador num pedido que JÁ TEM preço — pior do que mostrar 0 €, porque
 * o obriga a inventar um valor que passa a divergir da cotação.
 *
 * Usa o extremo INFERIOR nos intervalos: é o mais conservador para decidir
 * se há preço suficiente para publicar.
 */
export function gatePrice(row: PricedRow | null | undefined): number | null {
  const p = displayPrice(row);
  if (p.kind === "legado") return null;
  return p.min ?? p.value;
}

/** true quando o pedido tem preço utilizável, venha ele de onde vier. */
export function hasUsablePrice(row: PricedRow | null | undefined): boolean {
  const v = gatePrice(row);
  return v !== null && v > 0;
}

/**
 * Valor a mostrar no campo "Valor do orçamento" do painel — o campo que
 * EDITA `estimated_price`.
 *
 * ⚠️ Não usar displayPrice/gatePrice aqui: esses preferem `final_price`, que
 * é o preço acordado com o cliente e muda por outras vias (aceitação da
 * proposta, ajustes no local). Se o campo mostrasse esse, o operador escrevia
 * 333, gravava com sucesso, e via 270 de volta ao recarregar — parecia que a
 * gravação falhava quando não falhava.
 *
 * Regra: o que já está em `estimated_price` manda; o valor do motor só entra
 * como âncora enquanto ninguém definiu orçamento.
 */
export function orcamentoDoPedido(row: PricedRow | null | undefined): number | null {
  if (!row) return null;
  const estimado = num(row.estimated_price);
  if (estimado !== null && estimado > 0) return estimado;
  return gatePrice(row);
}

// ─── Fluxo legado do site (MySQL simulatorOrders) ────────────────────────
// Mesma classe de problema, outros nomes de campo. `"0.00"` é uma string
// truthy, por isso `if (!v)` deixava passar zeros e as cadeias `??` paravam
// no primeiro valor não-nulo mesmo quando era 0 — e os intervalos
// estimateMin/estimateMax, declarados no tipo, nunca eram consultados.

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

/**
 * Alerta de prejuízo: o preço aprovado nunca deve descer abaixo do piso
 * anti-prejuízo do motor (NOTA-BRIDGE-MOTOR §3.3). Devolve null quando não
 * há piso conhecido — o trace só é legível por admin e pode não existir.
 */
export function isBelowFloor(
  approvedPrice: number | string | null | undefined,
  engineFloor: number | string | null | undefined,
): boolean | null {
  const p = num(approvedPrice);
  const floor = num(engineFloor);
  if (p === null || floor === null) return null;
  return p < floor;
}
