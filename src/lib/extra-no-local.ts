import { PRECO_POR_ITEM, PRECO_POR_SACO } from "./precos-publicos";
import { type BaseDoPreco } from "./base-do-preco";

/**
 * O VALOR, O QUE COBRE E O EXTRA NO LOCAL — 15-11-2026 (decisão d47).
 *
 * As três primeiras partes da mensagem curta (`mensagem-do-orcamento.ts`),
 * à parte e sem dependências pesadas: a nota do preço que o cliente lê no
 * site, na app e nas mensagens da Vitória (`itens-a-mais.ts`) sai daqui, e a
 * app importa essa. Os números saem das fontes únicas (`precos-publicos.ts`).
 */

/** «105 €», «129,15 €», «1 230 €» — sem «,00» quando é redondo. */
export function eurosCurtos(v: number): string {
  const c = Math.round(v * 100) / 100;
  const [inteiro, cent] = c.toFixed(2).split(".");
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return cent === "00" ? `${grupos} €` : `${grupos},${cent} €`;
}

/** (a) «105 € + IVA = 129,15 €» — e sem fatura, só o total. */
export function valorComIva(semIva: number, total: number): string {
  if (Math.abs(total - semIva) < 0.005) return eurosCurtos(total);
  return `${eurosCurtos(semIva)} + IVA = ${eurosCurtos(total)}`;
}

/** (b) O que o valor cobre. */
export const INCLUI = "Inclui o que está nas fotografias e na descrição.";

const SEMPRE_COMBINADO = "sempre combinado consigo antes.";

const virgula = (n: number) => n.toFixed(2).replace(".", ",");

/** A tabela das peças, como o dono a escreveu: «peça pequena 15 €, média 30 €, grande 50 € + IVA». */
export const TABELA_DAS_PECAS_CURTA = `peça pequena ${PRECO_POR_ITEM.pequeno} €, média ${PRECO_POR_ITEM.medio} €, grande ${PRECO_POR_ITEM.grande} € + IVA`;

/** (c) O extra no local — com o preço da regra de cada serviço. */
export function extraNoLocal(servico: string | null | undefined, base: BaseDoPreco | null | undefined = "total"): string {
  if (base === "hora") {
    return `Se no local houver mais a fazer, as horas a mais pagam-se ao mesmo preço por hora, ${SEMPRE_COMBINADO}`;
  }
  if (base === "carga") {
    return `Se for preciso mais uma carga, paga-se ao mesmo preço por carga, ${SEMPRE_COMBINADO}`;
  }
  if (servico === "recolha_entulho") {
    return (
      `Se no local houver mais entulho, o extra paga-se à parte por saco ` +
      `(${virgula(PRECO_POR_SACO.minimo)} a ${virgula(PRECO_POR_SACO.maximo)} € + IVA cada), ${SEMPRE_COMBINADO}`
    );
  }
  if (servico === "mudanca") {
    // O preço por hora é o do parceiro da lista (d7), não o da referência.
    return `Se no local houver mais a levar, as horas a mais pagam-se ao preço por hora do parceiro, ${SEMPRE_COMBINADO}`;
  }
  if (servico && servico.startsWith("esvaziamento")) {
    // A regra do esvaziamento é o espaço e o volume, não a peça (d20, e d47).
    return `Se no local houver mais coisas, o volume a mais paga-se à parte, ${SEMPRE_COMBINADO}`;
  }
  if (!servico || servico === "manutencao_casa" || servico === "outro") {
    return `Se no local houver mais a fazer, o extra orça-se à parte, ${SEMPRE_COMBINADO}`;
  }
  // A recolha de móveis e de monos: pela tabela das peças (d20; os monos desde a d47).
  return `Se no local houver mais coisas, o extra paga-se à parte pela tabela (${TABELA_DAS_PECAS_CURTA}), ${SEMPRE_COMBINADO}`;
}

/** O extra tem preço? (A manutenção orça-se e o esvaziamento conta o volume: não têm tabela.) */
export function extraComPreco(texto: string): boolean {
  // Um número, ou o preço já dito (o mesmo por hora/carga, ou o preço por hora do parceiro).
  return /\d/.test(texto) || /mesmo preço|preço por hora/.test(texto);
}
