/**
 * A SAÍDA DE UMA ASSISTENTE — d40, 15-11-2026.
 *
 * Uma conta em «todos os trabalhos» continuava a ganhar sobre tudo o que se
 * concluísse depois de a pessoa deixar de trabalhar connosco. Cada conta passa
 * a ter um dia de saída («Saiu a», dia de Lisboa `YYYY-MM-DD`), escrito só pelo
 * administrador:
 *
 *   · um trabalho cujo dia que conta (o dia em que foi feito, ou nos antigos o
 *     da conclusão — `diaQueConta`) é DEPOIS do dia de saída não conta para
 *     ela, seja a conta «todos» ou «os seus»; o próprio dia de saída ainda
 *     conta;
 *   · EXCEPTO os pedidos marcados um a um como «conta para ela (falou com o
 *     cliente)»: esses contam quando ficarem concluídos, na quinzena em que
 *     forem feitos — nada se antecipa;
 *   · os períodos já pagos não mudam (estão fotografados).
 *
 * Desactivar a conta (`active = 0`) é outra coisa, e continua à parte.
 *
 * Puro de propósito — sem base, sem relógio —, para se testar cada regra.
 */

export type SaidaDaConta = {
  /** O último dia de Lisboa que ainda conta — `null` enquanto trabalha connosco. */
  saiuA: string | null;
  /** Os pedidos que contam depois da saída, por excepção. */
  excepcoes: number[];
};

export const SEM_SAIDA: SaidaDaConta = { saiuA: null, excepcoes: [] };

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Um dia que existe no calendário, `YYYY-MM-DD` — ou `null`. */
export function diaDeSaidaValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = DIA.exec(v.trim());
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(a, mes - 1, d));
  const existe = data.getUTCFullYear() === a && data.getUTCMonth() === mes - 1 && data.getUTCDate() === d;
  return existe ? v.trim() : null;
}

/** A lista das excepções gravada, lida com desconfiança: só números de pedido, sem repetidos, do maior para o menor. */
export function excepcoesDoJson(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const lista = JSON.parse(json);
    if (!Array.isArray(lista)) return [];
    const ids = lista.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return [...new Set(ids)].sort((a, b) => b - a);
  } catch {
    return [];
  }
}

/** A lista com o pedido marcado (ou desmarcado) — sem repetidos, do maior para o menor. */
export function comExcepcao(lista: number[], pedidoId: number, marcar: boolean): number[] {
  const s = new Set(lista.filter((n) => Number.isInteger(n) && n > 0));
  if (marcar) s.add(pedidoId);
  else s.delete(pedidoId);
  return [...s].sort((a, b) => b - a);
}

/**
 * Este trabalho conta para a conta, olhando à saída? `dia` é o dia de Lisboa
 * que o período usa (`diaQueConta`) — ou o dia em que se espera que seja
 * feito, numa previsão. `porExcepcao` diz quando só conta por estar marcado.
 */
export function contaDepoisDaSaida(
  pedidoId: number,
  dia: string | null,
  saida: SaidaDaConta | null | undefined,
): { conta: boolean; porExcepcao: boolean } {
  if (!saida?.saiuA) return { conta: true, porExcepcao: false };
  if (dia != null && dia <= saida.saiuA) return { conta: true, porExcepcao: false };
  if (saida.excepcoes.includes(Number(pedidoId))) return { conta: true, porExcepcao: true };
  return { conta: false, porExcepcao: false };
}

/** `2026-11-10` → «Saiu a 10/11/2026». */
export function rotuloDaSaida(saiuA: string): string {
  return `Saiu a ${saiuA.split("-").reverse().join("/")}`;
}

/** O que se lê ao lado de um trabalho que só conta por excepção. */
export const ROTULO_DA_EXCEPCAO = "conta por excepção (falou com o cliente)";
