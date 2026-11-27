import { aosCentimos } from "./financas";
import { despesasNoIntervalo, type DadosDasContas, type DespesasDoIntervalo } from "./financas-do-mes";

/**
 * O DINHEIRO NO INÍCIO — d56, 17-11-2026; BRUTO E LÍQUIDO desde a d139
 * (27-11-2026, dono).
 *
 * *«BRUTO — o que a CLYON ganhou com as taxas, sem descontar despesas.
 * LÍQUIDO (lucro) — bruto menos as despesas da CLYON.»*
 *
 *   · BRUTO — a soma do ganho da CLYON de cada trabalho concluído (a taxa da
 *     plataforma, sem IVA; nunca o dinheiro que vai para o parceiro), no DIA
 *     EM QUE O TRABALHO FOI FEITO (`diaQueConta`: o dia feito; sem ele, o da
 *     conclusão; o corrigido à mão manda). É a mesma conta do lucro de cada
 *     trabalho das comissões (`lucroDoTrabalho`), e vale para os dois
 *     modelos: antes de 15-11 a parte da CLYON do que o cliente lhe pagou;
 *     desde 15-11 a taxa que o parceiro passa à CLYON — conta quando o
 *     trabalho é feito, e o que ele ainda não passou está em «A receber dos
 *     profissionais». Contas de teste fora (`trabalhosQueContam`).
 *   · LÍQUIDO — bruto − despesas das Finanças (`despesasNoIntervalo`:
 *     recorrentes, ocasionais, despesas lançadas, comissões do euPago,
 *     comissões pagas às assistentes e à sócia). MARGEM = líquido ÷ bruto.
 *
 * Os períodos, em dias de Lisboa: hoje; a semana (de segunda a hoje); o mês
 * (do dia 1 a hoje); o ANO CIVIL (de 1 de janeiro a hoje); o total (desde o
 * primeiro dia com dinheiro). Os recorrentes contam por dia no hoje e na
 * semana, e o mês inteiro no mês, no ano e no total, como nas Finanças.
 *
 * Puro: quem chama diz o dia de hoje em Lisboa, nunca o relógio do navegador.
 * Não importa nada da base: o ecrã também o lê.
 */

export type PeriodoDoInicio = "hoje" | "semana" | "mes" | "ano" | "total";

export const PERIODOS_DO_INICIO: PeriodoDoInicio[] = ["hoje", "semana", "mes", "ano", "total"];

export const ROTULOS_DOS_PERIODOS: Record<PeriodoDoInicio, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
  total: "Total até hoje",
};

/** O ganho da CLYON num trabalho concluído, no dia em que foi feito. */
export type GanhoDoTrabalho = {
  pedidoId: number;
  /** O dia de Lisboa em que o trabalho foi feito (`YYYY-MM-DD`). */
  dia: string;
  /** A taxa da plataforma (o que a CLYON ganhou), sem IVA. Pode ser negativa (uma perda suportada). */
  ganho: number;
  /** Concluído e sem valor conhecido (Trabalho CLYON antigo sem preço, fechado à mão sem lucro): conta 0. */
  semValor: boolean;
};

/** A segunda-feira da semana do dia `YYYY-MM-DD` — a semana começa à segunda. */
export function segundaDoDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  const recuar = (t.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(a, m - 1, d - recuar)).toISOString().slice(0, 10);
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O primeiro dia com dinheiro: um trabalho, um gasto, um movimento, um pagamento. Sem nada, hoje. */
export function primeiroDiaDoTotal(trabalhos: GanhoDoTrabalho[], d: DadosDasContas, hoje: string): string {
  const dias: string[] = [];
  for (const t of trabalhos) dias.push(t.dia);
  for (const e of d.entradas) dias.push(e.dia);
  for (const m of d.movimentos) if (m.dia) dias.push(m.dia);
  for (const a of d.assistentes ?? []) dias.push(a.dia);
  for (const g of d.gastos) {
    if (g.tipo === "recorrente" && g.inicio) dias.push(`${g.inicio}-01`);
    if (g.tipo === "ocasional" && g.dia) dias.push(g.dia);
  }
  return dias.filter((x) => DIA.test(x) && x <= hoje).reduce((a, b) => (b < a ? b : a), hoje);
}

/** Os cinco intervalos, de `de` a hoje, e como contam os recorrentes. */
export function intervalosDoInicio(
  hoje: string,
  inicioDoTotal: string = hoje,
): Record<PeriodoDoInicio, { de: string; recorrentes: "por_dia" | "mes_inteiro" }> {
  return {
    hoje: { de: hoje, recorrentes: "por_dia" },
    semana: { de: segundaDoDia(hoje), recorrentes: "por_dia" },
    mes: { de: `${hoje.slice(0, 7)}-01`, recorrentes: "mes_inteiro" },
    // O ano civil: de 1 de janeiro a hoje, em Lisboa.
    ano: { de: `${hoje.slice(0, 4)}-01-01`, recorrentes: "mes_inteiro" },
    total: { de: inicioDoTotal < hoje ? inicioDoTotal : hoje, recorrentes: "mes_inteiro" },
  };
}

export type DinheiroDoPeriodo = {
  de: string;
  ate: string;
  /** O que a CLYON ganhou com as taxas, sem IVA e sem descontar despesas. */
  bruto: number;
  /** Quantos trabalhos feitos contam no bruto. */
  trabalhos: number;
  /** Desses, quantos contam 0 por falta de valor. */
  semValor: number;
  despesas: DespesasDoIntervalo;
  /** bruto − despesas: o lucro. */
  liquido: number;
  /** líquido ÷ bruto, em percentagem com uma casa; `null` sem bruto. */
  margem: number | null;
};

export type DinheiroDoInicio = Record<PeriodoDoInicio, DinheiroDoPeriodo>;

/** A margem: líquido ÷ bruto, em percentagem com uma casa; sem bruto positivo, não há. */
export function margemDe(liquido: number, bruto: number): number | null {
  if (!(bruto > 0)) return null;
  return Math.round((liquido / bruto) * 1000) / 10;
}

export function dinheiroDoInicio(args: { trabalhos: GanhoDoTrabalho[]; contas: DadosDasContas; hoje: string }): DinheiroDoInicio {
  const { trabalhos, contas, hoje } = args;
  const iv = intervalosDoInicio(hoje, primeiroDiaDoTotal(trabalhos, contas, hoje));
  const um = (p: PeriodoDoInicio): DinheiroDoPeriodo => {
    const { de, recorrentes } = iv[p];
    const doPeriodo = trabalhos.filter((t) => t.dia >= de && t.dia <= hoje);
    const bruto = aosCentimos(doPeriodo.reduce((s, t) => s + t.ganho, 0));
    const despesas = despesasNoIntervalo(contas, de, hoje, recorrentes);
    const liquido = aosCentimos(bruto - despesas.total);
    return {
      de,
      ate: hoje,
      bruto,
      trabalhos: doPeriodo.length,
      semValor: doPeriodo.filter((t) => t.semValor).length,
      despesas,
      liquido,
      margem: margemDe(liquido, bruto),
    };
  };
  return { hoje: um("hoje"), semana: um("semana"), mes: um("mes"), ano: um("ano"), total: um("total") };
}
