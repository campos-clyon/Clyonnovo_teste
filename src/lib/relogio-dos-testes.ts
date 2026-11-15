/**
 * O RELÓGIO DOS TESTES — d29, 15-11-2026.
 *
 * À meia-noite de 15-11-2026 o modelo novo entrou em vigor (`novo-modelo.ts`) e
 * ~26 testes chumbaram de uma vez: liam o relógio real e provavam o modelo
 * antigo. Um teste que depende da data passa a dizer em que dia está — e, quando
 * faz sentido, prova os dois lados.
 *
 * Só se finge o `Date` (`toFake: ["Date"]`): os temporizadores, as promessas e
 * as leituras de ficheiros continuam reais.
 *
 * Usado só pelos testes (`*.test.ts`); o guarda `relogio-dos-testes.test.ts`
 * obriga quem toca no modelo a usá-lo, ou a passar a data à mão.
 */
import { afterEach, beforeEach, vi } from "vitest";

/** Um dia do modelo antigo: 14-11-2026, meio-dia em Lisboa (= UTC em Novembro). */
export const ANTES_DO_MODELO = new Date("2026-11-14T12:00:00Z");

/** Um dia do modelo de 15-11-2026: 20-11-2026, meio-dia em Lisboa. */
export const DEPOIS_DO_MODELO = new Date("2026-11-20T12:00:00Z");

/** Põe o relógio neste instante (só o `Date`). */
export function relogioEm(instante: Date): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instante);
}

/** Devolve o relógio real. */
export function relogioReal(): void {
  vi.useRealTimers();
}

/** Em cada teste do `describe` onde é chamado, o relógio está neste instante. */
export function comORelogioEm(instante: Date): void {
  beforeEach(() => relogioEm(instante));
  afterEach(() => relogioReal());
}
