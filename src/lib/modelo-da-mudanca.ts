/**
 * O MODELO DAS MUDANÇAS, SEM NÚMERO — 11-11-2026.
 *
 * Só a tabela de referência por import (como antes): o next.config e o
 * middleware lêem `mudancas-cidades.ts`, que usa estas frases. Os textos com o preço estão em
 * `preco-publico-das-mudancas.ts`, que as reexporta.
 */

import {
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  PRECO_POR_HORA,
  PRECO_POR_HORA_COM_IVA,
  PRECO_POR_HORA_DUAS_PESSOAS,
  PRECO_POR_HORA_DUAS_PESSOAS_COM_IVA,
} from "./tabela-das-mudancas";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A referência, a meio de uma frase (sem ponto final) — quando não há parceiros na lista. */
export const REFERENCIA_DA_MUDANCA =
  `referência: ${euros(PRECO_POR_HORA_DUAS_PESSOAS)} + IVA por hora (${euros(PRECO_POR_HORA_DUAS_PESSOAS_COM_IVA)} com IVA) com 2 pessoas, ` +
  `${euros(PRECO_POR_HORA)} + IVA por hora (${euros(PRECO_POR_HORA_COM_IVA)} com IVA) com ${PESSOAS_NA_EQUIPA}, mínimo de ${MINIMO_DE_HORAS} horas`;

/** O modelo numa frase, para as páginas, a FAQ e o blog. */
export const MODELO_DA_MUDANCA =
  "Cada parceiro tem o seu preço por hora: no simulador de mudanças vê os parceiros disponíveis, com a nota, " +
  "o preço por hora, a equipa de 2 ou 3 pessoas e o material, e escolhe. O valor final sai das horas, dos km " +
  "e do material que confirma na folha do dia. A mudança é feita pelo parceiro escolhido.";

/**
 * O QUE SE COMBINA ANTES — d51, 16-11-2026. Numa mudança não há «preço fechado antes de
 * começar»: combina-se o preço por hora, e o valor final é a conta da folha do dia, que o
 * cliente valida. Sem ponto final, com maiúscula: serve de linha sozinha e de fim de frase.
 */
export const O_PRECO_DA_MUDANCA_COMBINA_SE =
  "Preço por hora combinado antes, e a conta da folha do dia validada por si";

/** O mesmo, a meio de uma frase: «Paga-se à hora, ao preço por hora do parceiro escolhido». */
export const MODELO_DA_MUDANCA_CURTO = "ao preço por hora do parceiro escolhido";
