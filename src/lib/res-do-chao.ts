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

/**
 * A LOJA, AO NÍVEL DA RUA — 27-11-2026 (d141, pedida e aprovada pelo dono).
 *
 * O #692 era num restaurante, com o rés-do-chão marcado, e a descrição
 * arrumada pedia «o elevador». O andar tem agora três respostas: o
 * rés-do-chão, a LOJA (ao nível da rua) e o andar N (só este pergunta o
 * elevador). A loja grava «loja» no andar — e conta como rés-do-chão em tudo
 * o que é preço (`floorNumber` lê-a como 0: sem andares).
 */
export const LOJA = "loja";
export const LOJA_POR_EXTENSO = "Loja (ao nível da rua)";

export function eLoja(andar: string | null | undefined): boolean {
  const a = (andar ?? "").trim().toLowerCase();
  return /^(loja|ao\s+n[ií]vel\s+d[ao]\s+(rua|ch[aã]o|passeio))\b/.test(a);
}

/**
 * NÃO HÁ ANDARES NEM ELEVADOR A PERGUNTAR: o rés-do-chão, a loja, uma
 * moradia térrea, o piso térreo. É o que o preço lê como andar 0 e o que a
 * descrição nunca põe «por confirmar».
 */
export function eAoNivelDaRua(andar: string | null | undefined): boolean {
  if (eResDoChao(andar) || eLoja(andar)) return true;
  const a = (andar ?? "").trim().toLowerCase();
  return /^(piso\s+)?t[eé]rre[oa]\b|^moradia\s+t[eé]rrea\b|^piso\s+0\b/.test(a);
}
