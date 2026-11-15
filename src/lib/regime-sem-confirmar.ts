import { regimeParaOEcra } from "./perfil-fiscal";

/**
 * O REGIME DE IVA QUE CHEGA SEM `confirmarRegime` — d27, 15-11-2026.
 *
 * Desde a d19 (13-11) o regime só se confirma quando ele o escolhe, e o painel e
 * a app nova mandam-no com `confirmarRegime: true`. Mas o PATCH ainda GRAVAVA o
 * regime que viesse sem ele — e a app CLYON Pro instalada (a atualização de
 * 13-11, anterior à d19) manda SEMPRE `regimeIva` no ecrã da Faturação, com
 * «isento» posto por omissão. Quem lá gravava só o NIF ou a morada via o regime
 * guardado reescrito para «isento».
 *
 * Essa app começa o ecrã com o regime que o GET devolve (`regimeParaOEcra`: o
 * confirmado, ou vazio) e, vazio, marca «isento». Por isso, o que ela manda sem
 * ele tocar é sempre ESSE valor; um valor diferente só pode vir de um toque.
 *
 *   · Com `confirmarRegime: true` → grava e confirma (a escolha dele).
 *   · Sem ele, e IGUAL ao que o ecrã mostrava → não grava nada: é a gravação do
 *     NIF ou da morada, e o regime guardado fica como estava.
 *   · Sem ele, e DIFERENTE → ele tocou noutro regime: grava e confirma.
 *
 * O que fica de fora: quem, por confirmar, toca em «isento» na app antiga não o
 * confirma por aqui (é igual ao de omissão, não se distingue). Continua «a
 * confirmar» até gravar no painel ou na app atualizada — nunca fica com um
 * regime que não escolheu.
 */
export type RegimeEscolhido = "isento" | "normal";

export function regimeQueSeGrava(
  enviado: RegimeEscolhido,
  guardado: Parameters<typeof regimeParaOEcra>[0] | null | undefined,
  confirmarRegime: boolean,
): { grava: boolean; confirma: boolean } {
  if (confirmarRegime) return { grava: true, confirma: true };
  const oQueOEcraMostrava: RegimeEscolhido = regimeParaOEcra(guardado ?? {}) === "normal" ? "normal" : "isento";
  if (enviado === oQueOEcraMostrava) return { grava: false, confirma: false };
  return { grava: true, confirma: true };
}
