import { TAXA_IVA } from "./taxas-plataforma";

/**
 * A CONTA DA ESTIMATIVA DE UM PEDIDO — sem IVA, IVA e total, lidos do campo certo.
 *
 * d77, 21-11-2026. A ficha do pedido em «Todos os pedidos» dizia, no #653,
 * «Estimativa s/IVA 135,30 € · IVA 23 % 25,30 € · Estimativa total 135.30 €».
 * Os 135,30 são o preço COM IVA (110,00 + 25,30): a ficha lia o `estimateTotal`
 * como se fosse sem IVA, e o total e o sem IVA davam o mesmo número.
 *
 * O QUE CADA COLUNA GUARDA (d59, 16-11-2026, e o simulador desde 07-2026 — o
 * corte do IVA incluído, a 01-10-2026, mudou o que o CLIENTE vê numa
 * negociação, não o que o simulador grava nas colunas do pedido):
 *
 *   · `estimateMin`   — o valor estimado SEM IVA (não é o mínimo de faixa);
 *   · `estimateMax`   — o mesmo valor COM IVA (não é o máximo de faixa);
 *   · `estimateTotal` — COM IVA outra vez;
 *   · `estimateJson`  — a estimativa inteira, com os nomes certos
 *     (`estimatedPriceWithoutVat`, `vatAmount`, `estimatedPriceWithVat`) e a
 *     faixa do motor (`estimateMin/MaxWithoutVat`).
 *
 * O «Recalcular estimativa» do backoffice gravava, até hoje, o sem IVA no
 * `estimateTotal` e a faixa em `estimateMin`/`estimateMax`. Esses pedidos não
 * passam no confronto das colunas (o total não é o mínimo × 1,23) e lêem-se
 * pelo `estimateJson`, que o recálculo também grava.
 *
 * Um preço final escrito pela equipa (`precoFinal` sem IVA, `precoFinalIva`
 * com IVA) ganha à estimativa.
 */

export type ContaDaEstimativa = {
  semIva: number;
  iva: number;
  comIva: number;
  /** «preco_final» quando a equipa já fixou o preço; «estimativa» quando é a do motor. */
  fonte: "preco_final" | "estimativa";
};

export type PedidoComEstimativa = {
  precoFinal?: string | number | null;
  precoFinalIva?: string | number | null;
  estimateMin?: string | number | null;
  estimateMax?: string | number | null;
  estimateTotal?: string | number | null;
  estimateJson?: string | null;
};

type EstimativaGuardada = {
  estimatedPriceWithoutVat?: unknown;
  estimatedPriceWithVat?: unknown;
  vatAmount?: unknown;
};

const FATOR_IVA = 1 + TAXA_IVA;
/** Folga do confronto sem IVA × 1,23 = com IVA: os descontos arredondam cada coluna à parte. */
const FOLGA = 0.05;

function positivo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const centimos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function conta(semIva: number, comIva: number, fonte: ContaDaEstimativa["fonte"]): ContaDaEstimativa {
  const s = centimos(semIva);
  const c = centimos(comIva);
  return { semIva: s, iva: centimos(c - s), comIva: c, fonte };
}

function lerEstimativa(json?: string | null): EstimativaGuardada | null {
  if (!json) return null;
  try {
    const e = JSON.parse(json);
    return e && typeof e === "object" ? (e as EstimativaGuardada) : null;
  } catch {
    return null;
  }
}

/**
 * Sem IVA, IVA e total com IVA do pedido. `null` quando não há valor nenhum.
 *
 * `comPrecoFinal: false` dá só a estimativa do motor (o separador «Serviço e
 * Fotos» mostra-a ao lado do preço final).
 */
export function contaDaEstimativa(
  o: PedidoComEstimativa | null | undefined,
  opts: { comPrecoFinal?: boolean } = {},
): ContaDaEstimativa | null {
  if (!o) return null;

  if (opts.comPrecoFinal !== false) {
    const final = positivo(o.precoFinal);
    const finalComIva = positivo(o.precoFinalIva);
    if (final != null) return conta(final, finalComIva ?? final * FATOR_IVA, "preco_final");
    if (finalComIva != null) return conta(finalComIva / FATOR_IVA, finalComIva, "preco_final");
  }

  // As colunas do simulador: sem IVA no estimateMin, com IVA no estimateTotal (ou no estimateMax).
  const semIvaDaColuna = positivo(o.estimateMin);
  const comIvaDaColuna = positivo(o.estimateTotal) ?? positivo(o.estimateMax);
  if (
    semIvaDaColuna != null &&
    comIvaDaColuna != null &&
    Math.abs(comIvaDaColuna - semIvaDaColuna * FATOR_IVA) <= FOLGA
  ) {
    return conta(semIvaDaColuna, comIvaDaColuna, "estimativa");
  }

  // A estimativa guardada, pelos nomes.
  const est = lerEstimativa(o.estimateJson);
  const semIvaDoJson = positivo(est?.estimatedPriceWithoutVat);
  const comIvaDoJson = positivo(est?.estimatedPriceWithVat);
  if (semIvaDoJson != null) return conta(semIvaDoJson, comIvaDoJson ?? semIvaDoJson * FATOR_IVA, "estimativa");
  if (comIvaDoJson != null) return conta(comIvaDoJson / FATOR_IVA, comIvaDoJson, "estimativa");

  // Só o total: pela regra das colunas, é com IVA.
  const total = positivo(o.estimateTotal);
  if (total != null) return conta(total / FATOR_IVA, total, "estimativa");
  if (semIvaDaColuna != null) return conta(semIvaDaColuna, semIvaDaColuna * FATOR_IVA, "estimativa");
  return null;
}

const NUMERO_PT = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** «1234,56» — o número em pt-PT, sem o símbolo (para «… € com IVA»). */
export function valorPt(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : v == null || v === "" ? Number.NaN : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? NUMERO_PT.format(n) : "—";
}

/** «135,30 €» — vírgula decimal e o símbolo depois, como se escreve em Portugal. */
export function eurosPt(v: number | string | null | undefined): string {
  const t = valorPt(v);
  return t === "—" ? t : `${t} €`;
}

/** «110,00 € + 25,30 € de IVA (23 %)» — o sem IVA dito sempre como parte do total. */
export function desdobramentoDaConta(c: Pick<ContaDaEstimativa, "semIva" | "iva">): string {
  return `${eurosPt(c.semIva)} + ${eurosPt(c.iva)} de IVA (${Math.round(TAXA_IVA * 100)} %)`;
}
