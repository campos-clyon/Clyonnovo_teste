/**
 * O TRABALHO FEITO FICA COM A DATA E A HORA EM QUE FOI FEITO — d36, 15-11-2026.
 *
 * `negociacoes.feitoEm` (v22) é o instante em que o trabalho foi dado por feito,
 * por quem quer que o dê: o profissional («Está feito», na app ou no painel), a
 * equipa no backoffice (Mesa, Trabalhos CLYON, «feito por outra empresa»), o
 * cliente na pergunta do modelo de 15-11, ou o prazo. Numa mudança (ou noutro
 * trabalho) à hora, é o FIM DA FOLHA — o dia e a hora em que acabou, e não o
 * instante em que alguém carregou no botão.
 *
 * As duas datas ficam: `dataCombinada` (o que se marcou) e `feitoEm` (o que
 * aconteceu). Um pedido de data vaga («esta semana») passa a ter este dia como
 * o dia do trabalho; um de data marcada guarda as duas, e a Agenda, os
 * Pagamentos e as comissões passam a ler a do feito (`dataDoTrabalho`).
 *
 * TRABALHOS ANTIGOS: NÃO SE PREENCHEM. As datas que existem não dizem quando o
 * trabalho foi feito — `execucaoEnviadaEm` de um «sem prova» é o dia em que a
 * equipa confirmou (às vezes dias depois), e a de um trabalho à hora é o
 * carregar no botão, não o fim da folha. Escrever essas datas como «feito em»
 * era gravar uma coisa falsa como se fosse verdade, e mexer no período das
 * comissões dos trabalhos ainda por pagar. Sem `feitoEm`, tudo se lê como até
 * hoje. A única excepção é a confirmação: um trabalho dado por feito antes da
 * d36 e confirmado depois dela leva o `execucaoEnviadaEm` dele (é exactamente
 * quando foi dado por feito), ou o fim da folha.
 *
 * ⚠️ AS FRASES SQL VÃO NO SET, DEPOIS das colunas de que dependem: o MySQL
 * avalia as atribuições de um UPDATE de uma tabela da esquerda para a direita,
 * já com os valores novos. `execucaoEnviadaEm = NOW(), …, ${FEITO_EM_AO_DAR_POR_FEITO}`.
 */
import { dataEHoraEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/** Ao dar por feito (no mesmo SET que `execucaoEnviadaEm = NOW()`): o fim da folha, ou agora. */
export const FEITO_EM_AO_DAR_POR_FEITO = "feitoEm = COALESCE(horasFimEm, NOW())";

/**
 * Ao confirmar (cliente, equipa ou prazo): o que já lá estava; senão o fim da
 * folha; senão quando foi dado por feito (os trabalhos de antes da d36).
 */
export const FEITO_EM_AO_CONFIRMAR = "feitoEm = COALESCE(feitoEm, horasFimEm, execucaoEnviadaEm, NOW())";

/**
 * Ao gravar as horas ou a folha (no mesmo SET, DEPOIS de `horasFimEm = ?`): num
 * trabalho já dado por feito, o «feito em» segue o fim da folha corrigida; num
 * por fazer, fica como está (nulo).
 */
export const FEITO_EM_COM_AS_HORAS =
  "feitoEm = IF(execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL, feitoEm, COALESCE(horasFimEm, feitoEm))";

/** Ao desfazer o «feito» (reabrir, passar a outro, retirar a entrega da CLYON). */
export const FEITO_EM_APAGADO = "feitoEm = NULL";

type Instante = Date | string | null | undefined;

/** O «feito em» de uma linha da base, ou `null`. */
export function feitoEmDe(l: { feitoEm?: Instante } | null | undefined): Date | null {
  return instanteDaBase(l?.feitoEm ?? null);
}

/**
 * A DATA DO TRABALHO: a do feito, quando existe; senão a combinada; senão a
 * que o cliente pediu. É a única regra — Agenda, Pagamentos e comissões lêem
 * esta.
 */
export function dataDoTrabalho(l: {
  feitoEm?: Instante;
  dataCombinada?: Instante;
  dataAgendada?: Instante;
}): Date | null {
  return feitoEmDe(l) ?? instanteDaBase(l.dataCombinada ?? null) ?? instanteDaBase(l.dataAgendada ?? null);
}

/** «Feito a 14/11/2026 · 18:30» — para o histórico do pedido, em hora de Lisboa. */
export function fraseDoFeitoEm(d: Date): string {
  return `Feito a ${dataEHoraEmLisboa(d)}.`;
}
