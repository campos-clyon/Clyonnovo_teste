/**
 * O DIA COMBINADO COM O PARCEIRO — 26-11-2026 (decisão d131). PURO.
 *
 * Caso real (sem dados): o cliente escolheu a proposta com a condição «tem
 * que ser dia 2/12 de manhã»; a Vitória perguntou ao parceiro (d97), ele
 * respondeu «Sim, conseguimos, pode agendar», o cliente disse SIM e o fecho
 * fez-se — mas a data do pedido e a da negociação ficaram vazias, e uma
 * pessoa teve de as pôr à mão.
 *
 * Aqui lê-se a data da condição (e a hora, se o parceiro a disse), pela
 * mesma leitura do resto da Vitória (`interpretarQuando`, em hora de Lisboa:
 * manhã = 9h, tarde = 14h, ou a hora dita; «dia 2» = o próximo dia 2). Vai no
 * fecho que fica à espera do SIM; com o SIM, o fecho grava-a no pedido
 * (`dataAgendada`, a «Data e hora desejada») e na negociação
 * (`dataCombinada`, a da Agenda e do «Já está feito»), e a confirmação ao
 * cliente e o aviso ao parceiro dizem-na.
 */

import { datasDitas } from "../datas-ditas";
import { interpretarQuando, quandoNoResumo, type DadosDaRecolha } from "../whatsapp-recolha";

export type DiaCombinado = {
  /** O instante (ISO) — o que se grava. */
  em: string;
  /** As palavras de onde se leu (a condição, e a hora do parceiro). */
  dito: string;
};

/**
 * A data-hora que a condição combinada diz, ou null. Se o parceiro disse
 * outro dia («sim, quinta às 15h»), manda o dele; se só disse a hora, junta-se
 * à da condição. Uma data que já passou não conta.
 */
export function diaCombinadoNaCondicao(
  condicao: string | null | undefined,
  quandoDoParceiro: string | null | undefined,
  agora: Date,
): DiaCombinado | null {
  const c = String(condicao ?? "").trim();
  const q = String(quandoDoParceiro ?? "").trim();
  const candidatos: string[] = [];
  if (q && datasDitas(q, agora).length > 0) candidatos.push(q);
  if (c) candidatos.push(q ? `${c} ${q}` : c);
  for (const dito of candidatos) {
    // «Até quinta» é um limite, e não um dia marcado: sem um dia preferido, não se grava nada.
    if (!datasDitas(dito, agora).some((x) => x.papel === "preferida")) continue;
    const r = interpretarQuando(dito, agora);
    if (r.data && r.data.getTime() > agora.getTime()) return { em: r.data.toISOString(), dito: dito.slice(0, 200) };
  }
  return null;
}

/** O dia combinado em palavras, como no resumo da recolha («quarta-feira, 2 de dezembro, de manhã»). */
export function diaCombinadoEmPalavras(d: DiaCombinado): string {
  return quandoNoResumo({ dataDesejada: d.em, quandoTexto: d.dito } as DadosDaRecolha);
}

/** Um dia combinado guardado (no pendente do fecho, no botão), validado; ou null. */
export { lerDiaCombinado } from "./pendentes";

/** A frase da confirmação ao cliente, com o dia combinado. */
export function fraseDoDiaCombinado(d: DiaCombinado): string {
  return `Fica combinado para ${diaCombinadoEmPalavras(d)}, como pediu — o parceiro já tem o dia na agenda dele.`;
}
