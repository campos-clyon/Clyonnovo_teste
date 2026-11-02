/**
 * O PREÇO EM TRÊS LINHAS — «Serviço / IVA (23 %) / Total a pagar» (ordem do
 * CEO com o sim do dono, 02-11-2026: «ecrãs simples, direto ao ponto»).
 *
 * Puro (só as palavras de `palavras-do-pagamento.ts`): a app de cliente lê-o pelo
 * Metro (os rótulos) e o servidor usa-o para escrever as três linhas a partir
 * das contas que já faz (`desdobramento`, `quantoOClientePaga`, `comIva`). Não calcula preços: recebe o
 * sem IVA e o total que já se cobram e escreve-os. O IVA é a diferença entre
 * os dois, para que Serviço + IVA dê sempre o Total ao cêntimo — o mesmo que o
 * banco pede.
 */

import { SEM_IVA, SERVICO, TOTAL_A_PAGAR } from "./palavras-do-pagamento";

export type PrecoEmTresLinhas = {
  /** O valor sem IVA («367,50 €», ou «40 – 120 €» numa faixa). */
  servico: string;
  /** O IVA («84,53 €»). */
  iva: string;
  /** O rótulo do IVA, com a taxa («IVA (23 %)»). */
  ivaRotulo: string;
  /** O total com IVA, o que se paga («452,03 €»). */
  total: string;
};

/** As frases do bloco de pagar do site (`frases-do-pagamento.ts` → `palavras-do-pagamento.ts`), à letra. */
export const ROTULO_DO_SERVICO = SERVICO;
export const ROTULO_SEM_IVA = SEM_IVA;
export const ROTULO_DO_TOTAL = TOTAL_A_PAGAR;
/** Na referência do pedido ainda não há preço fechado: o total é «de referência». */
export const ROTULO_DO_TOTAL_DE_REFERENCIA = "Total de referência";

const aosCentimos = (v: number) => Math.round(v * 100) / 100;

/** «452,03 €» — dois decimais, sempre, como o banco os pede. */
export function emEurosComCentimos(v: number): string {
  return `${aosCentimos(v).toFixed(2).replace(".", ",")} €`;
}

/** «Desde» e faixas: «40 €», «135,30 €» (sem «,00»), como as tabelas do site. */
function emEurosCurto(v: number): string {
  const [inteiros, centimos] = aosCentimos(v).toFixed(2).split(".");
  const comEspacos = inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return centimos === "00" ? `${comEspacos} €` : `${comEspacos},${centimos} €`;
}

const rotuloDoIva = (taxa: number) => `IVA (${Math.round(taxa * 100)} %)`;

/**
 * As três linhas de um valor fechado: o sem IVA e o total que se cobra.
 * `null` se os números não fizerem sentido (o total abaixo do sem IVA).
 */
export function precoEmTresLinhas(semIva: number, total: number, taxaIva: number): PrecoEmTresLinhas | null {
  if (!Number.isFinite(semIva) || !Number.isFinite(total) || semIva <= 0 || total < semIva) return null;
  return {
    servico: emEurosComCentimos(semIva),
    iva: emEurosComCentimos(total - semIva),
    ivaRotulo: rotuloDoIva(taxaIva),
    total: emEurosComCentimos(total),
  };
}

/**
 * As três linhas de uma referência (antes das propostas): um valor, uma faixa
 * («40 – 120 €») ou um «desde». `comIva` é a conta do site (`quanto-custa.ts`).
 */
export function referenciaEmTresLinhas(
  de: number,
  ate: number | null,
  comIva: (v: number) => number,
  taxaIva: number,
  desde = false,
): PrecoEmTresLinhas | null {
  if (!Number.isFinite(de) || de <= 0) return null;
  const um = (v: number) => ({ s: v, t: comIva(v) });
  const a = um(de);
  const prefixo = desde ? "desde " : "";
  if (ate == null || ate === de || desde) {
    return {
      servico: `${prefixo}${emEurosCurto(a.s)}`,
      iva: `${prefixo}${emEurosCurto(a.t - a.s)}`,
      ivaRotulo: rotuloDoIva(taxaIva),
      total: `${prefixo}${emEurosCurto(a.t)}`,
    };
  }
  const b = um(ate);
  const faixa = (x: number, y: number) => `${emEurosCurto(x).replace(" €", "")} – ${emEurosCurto(y)}`;
  return {
    servico: faixa(a.s, b.s),
    iva: faixa(a.t - a.s, b.t - b.s),
    ivaRotulo: rotuloDoIva(taxaIva),
    total: faixa(a.t, b.t),
  };
}

/** Lê as três linhas que a API mandou, sem confiar na forma. `null` se faltar alguma. */
export function precoEmTresLinhasValido(v: unknown): PrecoEmTresLinhas | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() && x.length <= 80 ? x.trim() : null);
  const servico = s(o.servico);
  const iva = s(o.iva);
  const total = s(o.total);
  const ivaRotulo = s(o.ivaRotulo) ?? "IVA";
  return servico && iva && total ? { servico, iva, ivaRotulo, total } : null;
}
