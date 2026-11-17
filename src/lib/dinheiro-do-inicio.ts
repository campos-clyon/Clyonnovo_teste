import { lucroNoIntervalo, type DadosDasContas, type LucroDoIntervalo, type PeriodoDaSocia } from "./financas-do-mes";

/**
 * O DINHEIRO NO INÍCIO — d56, 17-11-2026.
 *
 * O lucro de hoje, desta semana (segunda a hoje), deste mês e deste ano, em
 * dias de Lisboa, pela MESMA conta das Finanças (`lucroNoIntervalo`, o núcleo
 * de `contasDoMes`). Hoje e a semana com os recorrentes rateados por dia; o
 * mês e o ano com os meses inteiros, como as Finanças os contam.
 *
 * Puro: quem chama diz o dia de hoje em Lisboa (`diaEmLisboa`), nunca o
 * relógio do navegador.
 */

export type PeriodoDoInicio = "hoje" | "semana" | "mes" | "ano";

export const ROTULOS_DOS_PERIODOS: Record<PeriodoDoInicio, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
};

/** A segunda-feira da semana do dia `YYYY-MM-DD` — a semana começa à segunda. */
export function segundaDoDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  const recuar = (t.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(a, m - 1, d - recuar)).toISOString().slice(0, 10);
}

/** Os quatro intervalos, de `de` a `ate` (hoje), e como contam os recorrentes. */
export function intervalosDoInicio(hoje: string): Record<PeriodoDoInicio, { de: string; recorrentes: "por_dia" | "mes_inteiro" }> {
  return {
    hoje: { de: hoje, recorrentes: "por_dia" },
    semana: { de: segundaDoDia(hoje), recorrentes: "por_dia" },
    mes: { de: `${hoje.slice(0, 7)}-01`, recorrentes: "mes_inteiro" },
    ano: { de: `${hoje.slice(0, 4)}-01-01`, recorrentes: "mes_inteiro" },
  };
}

export type DinheiroDoInicio = Record<PeriodoDoInicio, LucroDoIntervalo>;

export function dinheiroDoInicio(d: DadosDasContas, socia: PeriodoDaSocia[] | null, hoje: string): DinheiroDoInicio {
  const iv = intervalosDoInicio(hoje);
  const um = (p: PeriodoDoInicio) => lucroNoIntervalo(d, iv[p].de, hoje, { hoje, recorrentes: iv[p].recorrentes, socia });
  return { hoje: um("hoje"), semana: um("semana"), mes: um("mes"), ano: um("ano") };
}
