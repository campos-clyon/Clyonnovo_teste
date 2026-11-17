/*
 * «FALTA A RUA» NO CARTÃO DA MESA — 17-11-2026 (d69). Sem importações: lê-o o
 * painel (um componente do browser) e o servidor. Ver `rua-depois-do-aceite.ts`.
 */

/** A etiqueta do cartão da Mesa. */
export function linhaDaRuaNaMesa(r: { aceite: boolean; pedidaEm: string | null; passadaEm: string | null }): string {
  if (!r.aceite) return "Falta a rua — pede-se ao cliente quando aceitar";
  if (r.passadaEm) return "Falta a rua — o cliente aceitou e não respondeu: pedir-lha";
  if (r.pedidaEm) return "Falta a rua — a Vitória já a pediu ao cliente";
  return "Falta a rua — o cliente aceitou";
}
