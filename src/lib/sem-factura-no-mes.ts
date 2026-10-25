import { dataDeReferencia, dentroDoIntervalo, intervaloDoPeriodo } from "./filtros-dos-pagamentos";

/**
 * QUANTOS PAGAMENTOS SEM FACTURA HOUVE NO MÊS — 25-10-2026 (decisão d19).
 *
 * Uma linha nos Pagamentos: quantos pagamentos do mês foram sem factura, e que
 * parte do valor foram. O mês é o de Lisboa; cada trabalho conta pela data em
 * que o cliente pagou, ou, sem ela, pela do trabalho — a mesma dos
 * «Recebidos» (`dataDeReferencia`). O valor é o do trabalho sem IVA, para os
 * dois lados se compararem (um sem factura não leva IVA). As contas de teste
 * ficam de fora.
 *
 * PURO: as contas das datas são as que mais se enganam, e provam-se sozinhas.
 */

export type LinhaDoMes = {
  contaDeTeste?: boolean;
  pagouSemFactura?: boolean;
  motivoSemFactura?: string | null;
  valorAcordado: number;
  conta?: { semIva: number } | null;
  dataDoTrabalho: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
};

export type SemFacturaNoMes = {
  /** Os pagamentos do mês, com e sem factura. */
  pagamentos: number;
  semFactura: number;
  /** Os sem factura do mês sem o motivo escrito (os de antes da regra). */
  semMotivo: number;
  /** O valor do mês, sem IVA, e o dos sem factura. */
  valor: number;
  valorSemFactura: number;
  /** A parte do valor que foi sem factura, de 0 a 1 — nula sem valor nenhum. */
  percentagem: number | null;
};

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function semFacturaNoMes(linhas: readonly LinhaDoMes[], agora: Date): SemFacturaNoMes {
  const mes = intervaloDoPeriodo("este_mes", agora);
  let pagamentos = 0;
  let semFactura = 0;
  let semMotivo = 0;
  let valor = 0;
  let valorSemFactura = 0;
  for (const t of linhas) {
    if (t.contaDeTeste) continue;
    if (!dentroDoIntervalo(dataDeReferencia(t, "recebidos"), mes)) continue;
    const v = t.conta ? t.conta.semIva : t.valorAcordado;
    if (!Number.isFinite(v)) continue;
    pagamentos += 1;
    valor += v;
    if (t.pagouSemFactura) {
      semFactura += 1;
      valorSemFactura += v;
      if (!(t.motivoSemFactura ?? "").trim()) semMotivo += 1;
    }
  }
  valor = aosCentimos(valor);
  valorSemFactura = aosCentimos(valorSemFactura);
  return {
    pagamentos,
    semFactura,
    semMotivo,
    valor,
    valorSemFactura,
    percentagem: valor > 0 ? valorSemFactura / valor : null,
  };
}

/** 0,0742 → «7,4 %». */
function emPercentagem(p: number): string {
  return `${String(Math.round(p * 1000) / 10).replace(".", ",")} %`;
}

/** A frase da linha dos Pagamentos. */
export function fraseDoSemFacturaNoMes(r: SemFacturaNoMes): string {
  if (r.pagamentos === 0) return "Sem factura este mês: ainda não há pagamentos no mês.";
  const de = `${r.semFactura} de ${r.pagamentos} ${r.pagamentos === 1 ? "pagamento" : "pagamentos"}`;
  const parte = r.percentagem != null ? ` — ${emPercentagem(r.percentagem)} do valor, sem IVA` : "";
  const motivo =
    r.semMotivo > 0 ? ` ${r.semMotivo} ${r.semMotivo === 1 ? "está" : "estão"} sem motivo registado.` : "";
  return `Sem factura este mês: ${de}${parte}.${motivo}`;
}
