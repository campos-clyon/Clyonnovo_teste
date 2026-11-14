/**
 * A SAÍDA DIÁRIA DA PONTE — 14-11-2026.
 *
 * O Chromium do WhatsApp Web vai engordando desde cada arranque (uns 0,1 GB
 * por dia) e a memória é quase toda a conta do Railway. Por isso a ponte sai
 * sozinha uma vez por dia, de madrugada, e o Railway levanta-a de novo, magra.
 * A sessão fica no volume: volta a ligar sem pedir emparelhamento.
 *
 * A hora conta-se SEMPRE em Lisboa, nunca pela hora do servidor (que corre em
 * UTC, em Singapura). No Inverno 04h de Lisboa são 04h UTC; no Verão, 03h UTC.
 *
 * Funções puras, sem nada da ponte dentro, para se poderem testar daqui.
 */

/** A hora de Lisboa em que a ponte sai (04h00–04h59). */
export const HORA_DA_SAIDA = 4;

/** Uma ponte que arrancou há menos disto não sai: acabou de nascer. */
export const IDADE_MINIMA_MS = 60 * 60_000;

/**
 * O código de saída. NÃO é zero de propósito: o serviço da ponte no Railway
 * está com a política de reinício «On Failure», que só levanta o contentor
 * quando ele sai com um código diferente de zero. Com `exit(0)` a ponte
 * ficava parada até alguém carregar em Restart. 75 = EX_TEMPFAIL («volte a
 * tentar»), para se distinguir nos registos de uma avaria (1).
 */
export const CODIGO_DA_SAIDA_DIARIA = 75;

const FORMATO = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A hora e o minuto em Lisboa de um instante. */
export function horaDeLisboa(instante) {
  const partes = FORMATO.formatToParts(instante);
  const valor = (tipo) => Number(partes.find((p) => p.type === tipo)?.value ?? NaN);
  return { hora: valor("hour"), minuto: valor("minute") };
}

/**
 * Deve sair agora?
 *   agora        — Date ou ms
 *   arrancouEm   — ms em que o processo nasceu
 *   ocupada      — está a meio de enviar ou de tratar uma mensagem
 *
 * Só dentro da hora das 04h de Lisboa: se estiver ocupada, adia-se para o
 * minuto seguinte, e ainda tem a hora inteira para sair. Depois de sair, a
 * ponte nova tem menos de uma hora e não volta a sair nesse dia.
 */
export function deveSairAgora({ agora, arrancouEm, ocupada }) {
  const instante = agora instanceof Date ? agora : new Date(agora);
  if (horaDeLisboa(instante).hora !== HORA_DA_SAIDA) return false;
  if (instante.getTime() - arrancouEm < IDADE_MINIMA_MS) return false;
  if (ocupada) return false;
  return true;
}
