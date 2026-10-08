/**
 * OS PERÍODOS DAS COMISSÕES DOS ASSISTENTES — 08-10-2026.
 *
 * *«Todos os trabalhos realizados a partir do dia 23/09, porém devemos ter uma
 * gestão dos valores: do dia 23/09 ao 15/10, depois a próxima contagem vai até
 * ao final do mês, 31/10, depois 15/11, até 30/11, a 15/12, a 31/12, etc.»*
 *
 * O primeiro período é o único fora do molde: começa a 23/09 e vai até 15/10.
 * Daí em diante são quinzenas de calendário — de 1 a 15, e de 16 ao último dia
 * do mês (28, 29, 30 ou 31). O que foi concluído antes de 23/09 não conta:
 * esse já está acertado.
 *
 * Tudo em DIAS DE LISBOA (`YYYY-MM-DD`), e nunca em instantes: um trabalho
 * confirmado às 00:30 de 16/10 em Portugal é 23:30 de 15/10 em UTC, e é na
 * quinzena de 16/10 que ele tem de cair. Quem chama converte o instante com
 * `diaEmLisboa`; aqui só se conta no calendário.
 *
 * Puro de propósito — sem base, sem relógio —, para se testar cada fronteira.
 */

/** O primeiro dia que conta. */
export const INICIO_DAS_COMISSOES = "2026-09-23";
/** O fim do primeiro período, o que não segue o molde das quinzenas. */
export const FIM_DO_PRIMEIRO_PERIODO = "2026-10-15";

export type Periodo = {
  /** `YYYY-MM-DD` — também é a chave do período. */
  inicio: string;
  /** `YYYY-MM-DD`, inclusive. */
  fim: string;
};

const dois = (n: number) => String(n).padStart(2, "0");

/** 28, 29, 30 ou 31. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O período a que pertence um dia de Lisboa — ou `null`, antes de 23/09/2026. */
export function periodoDoDia(dia: string): Periodo | null {
  const m = DIA.exec(dia);
  if (!m) return null;
  if (dia < INICIO_DAS_COMISSOES) return null;
  if (dia <= FIM_DO_PRIMEIRO_PERIODO) {
    return { inicio: INICIO_DAS_COMISSOES, fim: FIM_DO_PRIMEIRO_PERIODO };
  }
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  const prefixo = `${ano}-${dois(mes)}`;
  return d <= 15
    ? { inicio: `${prefixo}-01`, fim: `${prefixo}-15` }
    : { inicio: `${prefixo}-16`, fim: `${prefixo}-${dois(ultimoDiaDoMes(ano, mes))}` };
}

/** O dia a seguir a outro, no calendário. */
function diaSeguinte(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Os períodos desde o primeiro até ao que contém `hoje`, do mais recente para
 * o mais antigo — a ordem em que se lêem no ecrã. Vazio antes de 23/09/2026.
 */
export function periodosAte(hoje: string): Periodo[] {
  const lista: Periodo[] = [];
  let p = periodoDoDia(INICIO_DAS_COMISSOES);
  // Mil períodos são quarenta anos: a guarda só existe para um `hoje` estranho
  // nunca prender o servidor num ciclo.
  for (let i = 0; p && p.inicio <= hoje && i < 1000; i++) {
    lista.push(p);
    p = periodoDoDia(diaSeguinte(p.fim));
  }
  return lista.reverse();
}

export type EstadoDoPeriodo = "em_curso" | "por_pagar" | "pago";

/**
 * Em curso enquanto `hoje` não passar do último dia; depois disso, por pagar
 * até alguém o marcar como pago.
 */
export function estadoDoPeriodo(p: Periodo, hoje: string, pago: boolean): EstadoDoPeriodo {
  if (pago) return "pago";
  return hoje <= p.fim ? "em_curso" : "por_pagar";
}

/** `23/09 – 15/10/2026`; com o ano nos dois lados quando o período o atravessa. */
export function rotuloDoPeriodo(p: Periodo): string {
  const [ai, mi, di] = p.inicio.split("-");
  const [af, mf, df] = p.fim.split("-");
  return ai === af ? `${di}/${mi} – ${df}/${mf}/${af}` : `${di}/${mi}/${ai} – ${df}/${mf}/${af}`;
}
