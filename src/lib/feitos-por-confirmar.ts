import { diasDeCalendarioEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/*
 * HÁ QUANTO TEMPO ESTÁ FEITO E POR CONFIRMAR — 27-10-2026.
 *
 * Na Mesa, «Feitos, à espera de confirmação» dizia o quê, e não desde quando.
 * Um trabalho dado por feito há três dias é dinheiro de um profissional preso
 * há três dias. Conta-se em dias de calendário de Lisboa (hora-de-lisboa.ts),
 * nunca no relógio de quem olha; passados DOIS dias, a linha sobe ao topo do
 * bloco e o selo passa a alerta.
 */

/** A partir de quantos dias um feito por confirmar passa a alerta. */
export const DIAS_ATE_AO_ALERTA = 2;

/** Os dias desde que o profissional o deu por feito, ou null sem data. */
export function diasAEsperarConfirmacao(
  execucaoEnviadaEm: string | Date | null | undefined,
  agora: Date = new Date(),
): number | null {
  const d = instanteDaBase(execucaoEnviadaEm ?? null);
  if (!d) return null;
  return Math.max(0, diasDeCalendarioEmLisboa(d, agora));
}

/** «hoje», «há 1 dia», «há 3 dias». */
export function haQuantosDias(dias: number | null): string {
  if (dias == null) return "";
  if (dias <= 0) return "hoje";
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export function passouDoPrazo(dias: number | null): boolean {
  return dias != null && dias >= DIAS_ATE_AO_ALERTA;
}

/**
 * A ordem do bloco: os atrasados primeiro, e dentro de cada grupo a ordem que
 * já trazia (o número, o mais alto em cima). Estável — não mexe no resto.
 */
export function atrasadosPrimeiro<T>(lista: readonly T[], dias: (x: T) => number | null): T[] {
  const atrasados = lista.filter((x) => passouDoPrazo(dias(x)));
  const resto = lista.filter((x) => !passouDoPrazo(dias(x)));
  return [...atrasados, ...resto];
}
