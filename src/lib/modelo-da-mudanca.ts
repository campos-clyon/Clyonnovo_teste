/**
 * O MODELO DAS MUDANÇAS, SEM NÚMERO — 11-11-2026.
 *
 * Só a tabela de referência por import (como antes): o next.config e o
 * middleware lêem `mudancas-cidades.ts`, que usa estas frases. Os textos com o preço estão em
 * `preco-publico-das-mudancas.ts`, que as reexporta.
 */

import { MINIMO_DE_HORAS, PESSOAS_NA_EQUIPA, PRECO_POR_HORA, PRECO_POR_HORA_COM_IVA } from "./tabela-das-mudancas";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A referência, a meio de uma frase (sem ponto final) — quando não há parceiros na lista. */
export const REFERENCIA_DA_MUDANCA =
  `referência: ${euros(PRECO_POR_HORA)} + IVA por hora (${euros(PRECO_POR_HORA_COM_IVA)} com IVA), ` +
  `equipa de ${PESSOAS_NA_EQUIPA}, mínimo de ${MINIMO_DE_HORAS} horas`;

/** O modelo numa frase, para as páginas, a FAQ e o blog. */
export const MODELO_DA_MUDANCA =
  "Cada parceiro tem o seu preço por hora: no simulador de mudanças vê os parceiros disponíveis, com a nota, " +
  "o preço por hora, a equipa de 2 ou 3 pessoas e o material, e escolhe. O valor final sai das horas, dos km " +
  "e do material que confirma na folha do dia. A mudança é feita pelo parceiro que escolher.";

/** O mesmo, a meio de uma frase: «Paga-se à hora, ao preço por hora do parceiro que escolher». */
export const MODELO_DA_MUDANCA_CURTO = "ao preço por hora do parceiro que escolher";
