import { JANELA_DE_CONTACTO, naJanelaDeContacto } from "./janela-de-contacto";
import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/**
 * A JANELA DAS MENSAGENS AUTOMÁTICAS DA D88 — 23-11-2026 (CEO e dono).
 *
 * O «Pedir o que falta» sozinho (passo 1) e as propostas que vão ao cliente
 * sozinhas (passo 3) saem na janela de contacto (`janela-de-contacto.ts`, das 9h às 20h de Lisboa). O que fica fora — um
 * pedido que entra às 22h, uma proposta que chega às 6h, uma mensagem que
 * não saiu ontem porque já tinha saído outra automática nesse dia — sai às 9h,
 * nunca antes: às 8h seria cedo para quem não está à espera de nada.
 *
 * PURO, e sempre na hora de Lisboa (o servidor corre em UTC).
 */

export const JANELA_DAS_MENSAGENS_AUTOMATICAS = { das: JANELA_DE_CONTACTO.abre, as: JANELA_DE_CONTACTO.fecha } as const;
/** A hora a que sai o que ficou para depois (fora de horas, ou de outro dia). */
export const HORA_DO_QUE_FICOU_PARA_DEPOIS = JANELA_DE_CONTACTO.abre;

const dois = (n: number) => String(n).padStart(2, "0");

/** Na janela de contacto (9h–20h de Lisboa)? */
export function naJanelaDasMensagensAutomaticas(agora: Date): boolean {
  return naJanelaDeContacto(agora);
}

/** Um dia (YYYY-MM-DD) a uma hora de Lisboa, como instante. */
export function aHoraDoDia(dia: string, hora: number, minuto = 0): Date {
  return instanteEmLisboa(`${dia}T${dois(hora)}:${dois(minuto)}`) ?? new Date(Number.NaN);
}

/** O primeiro instante na janela a partir de `d`: ele mesmo, ou — se cair fora — as 9h a seguir. */
function primeiroNaJanela(d: Date): Date {
  const { hora } = pecasEmLisboa(d);
  const dia = diaEmLisboa(d);
  if (hora >= JANELA_DAS_MENSAGENS_AUTOMATICAS.as) return aHoraDoDia(somarDiasAoDia(dia, 1), HORA_DO_QUE_FICOU_PARA_DEPOIS);
  if (hora < JANELA_DAS_MENSAGENS_AUTOMATICAS.das) return aHoraDoDia(dia, HORA_DO_QUE_FICOU_PARA_DEPOIS);
  return d;
}

/**
 * QUANDO SAI uma mensagem que podia sair a partir de `devido`, vista `agora`.
 * Pura. Se `devido` cai fora da janela, às 9h a seguir; se `agora` já passou
 * disso e está fora da janela, às 9h a seguir a `agora`; e uma que ficou de
 * outro dia (fora de horas, ou travada pela uma-por-dia), nunca antes das 9h.
 */
export function momentoDeSaida(devido: Date, agora: Date): Date {
  const m = primeiroNaJanela(devido);
  if (agora.getTime() <= m.getTime()) return m;
  const { hora } = pecasEmLisboa(agora);
  const dia = diaEmLisboa(agora);
  if (hora >= JANELA_DAS_MENSAGENS_AUTOMATICAS.as) return aHoraDoDia(somarDiasAoDia(dia, 1), HORA_DO_QUE_FICOU_PARA_DEPOIS);
  if (hora < JANELA_DAS_MENSAGENS_AUTOMATICAS.das || (dia !== diaEmLisboa(m) && hora < HORA_DO_QUE_FICOU_PARA_DEPOIS)) {
    return aHoraDoDia(dia, HORA_DO_QUE_FICOU_PARA_DEPOIS);
  }
  return agora;
}

/** Já pode sair agora? Pura. */
export function podeSairAgora(devido: Date | null | undefined, agora: Date): boolean {
  if (!(devido instanceof Date) || Number.isNaN(devido.getTime())) return false;
  return agora.getTime() >= momentoDeSaida(devido, agora).getTime();
}

/** «23/11 às 9h», «24/11 às 14h35» — o instante em Lisboa, curto, para os cartões. */
export function diaEHoraCurtos(instante: Date): string {
  const p = pecasEmLisboa(instante);
  return `${dois(p.dia)}/${dois(p.mes)} às ${p.hora}h${p.minuto ? dois(p.minuto) : ""}`;
}
