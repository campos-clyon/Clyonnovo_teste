/**
 * O ANDAR É O RÉS-DO-CHÃO? — 17-10-2026.
 *
 * *«Vamos colocar na opção andar a caixinha de rés-do-chão; quando essa caixa
 * for marcada não aparece a opção elevador, pois não precisa.»*
 *
 * A caixa escreve «rés-do-chão» no andar — o valor que `floorNumber`
 * (pricing-helper) já lê como 0. E reconhece o que se escreve à mão no mesmo
 * campo — «R/C», «r/c», «rés do chão», «0» — para a caixa aparecer marcada e o
 * elevador escondido também nesses casos.
 */
export const RES_DO_CHAO = "rés-do-chão";

export function eResDoChao(andar: string | null | undefined): boolean {
  const a = (andar ?? "").trim().toLowerCase();
  if (!a) return false;
  if (a === "0") return true;
  return /^(r\s*\/\s*c|rc|r[eé]s[\s-]*d[oe][\s-]*ch[aã]o)(\b|\s|\.|$)/.test(a);
}
