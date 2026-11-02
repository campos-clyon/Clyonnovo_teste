/**
 * A ESCOLHA RECOLHIDA (02-11-2026, ordem do CEO com o sim do dono): numa lista
 * de escolha única do Pedir com perguntas a seguir no mesmo ecrã, depois de o
 * cliente escolher, as outras opções saem e fica só a escolhida, num cartão
 * compacto com «Mudar» — o espaço vai para as perguntas seguintes. «Mudar»
 * volta a mostrar todas; escolher outra vez (a mesma ou outra) recolhe.
 */

export const MUDAR = "Mudar";

/** Mostra-se só a escolhida? Só quando a lista recolhe, há uma escolha válida e o cliente não pediu para mudar. */
export function soAEscolhida(recolhe: boolean, valor: string | undefined, ids: readonly string[], aMudar: boolean): boolean {
  return recolhe && !aMudar && valor !== undefined && ids.includes(valor);
}

/** O que o leitor de ecrã diz no cartão: «Quanto há para levar?: Enche uma carrinha. Mudar». */
export function rotuloDoCartao(nome: string, rotulo?: string): string {
  return `${rotulo ? `${rotulo.replace(/\?$/, "")}: ` : ""}${nome}. ${MUDAR}`;
}
