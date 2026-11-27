import { distanciaEmLinhaRecta, FACTOR_DE_ESTRADA, pontoValido, type Ponto } from "./distancia-entre-pontos";
import { BASE_DA_ZONA, KM_DA_ZONA_POR_OMISSAO } from "./fora-da-zona";

/**
 * O PARCEIRO FORA DA ZONA — d15, 27-11-2026 (CEO e dono; o raio máximo do parceiro
 * fica nos 500 km, escolha A do CEO).
 *
 * A CLYON não envia pedidos acima de `zona_km_maximo` de Lisboa (200 km hoje; nas
 * mudanças conta a origem — ver `fora-da-zona.ts`). Um parceiro com a base para lá
 * do limite pode candidatar-se e ter conta, mas não recebe pedidos: diz-se-lho
 * ANTES de preencher, e a equipa vê a marca âmbar na candidatura e na conta.
 *
 * O LIMITE NUNCA SE ESCREVE À MÃO. Chega sempre por parâmetro (`limite`), lido das
 * Configs por `limiteDaZonaKm` (fora-da-zona-na-base.ts) — o mesmo que marca os
 * pedidos. Aqui só há contas puras; a distância é a do envio (linha recta × 1,3).
 */

export type ParceiroForaDaZona = { km: number; limite: number };

/** Km de Lisboa (a base) de um ponto, pela régua do envio. Nulo se o ponto não vale. */
export function kmDeLisboaDeUmPonto(ponto: { lat: unknown; lng: unknown } | null | undefined, base: Ponto = BASE_DA_ZONA): number | null {
  if (!ponto) return null;
  const p = { lat: Number(ponto.lat), lng: Number(ponto.lng) };
  if (ponto.lat == null || ponto.lng == null || ponto.lat === "" || ponto.lng === "") return null;
  if (!pontoValido(p) || (p.lat === 0 && p.lng === 0)) return null;
  return Math.round(distanciaEmLinhaRecta(base, p) * FACTOR_DE_ESTRADA * 10) / 10;
}

/** A base do parceiro está acima do limite? Sem ponto, não se sabe — não marca. */
export function parceiroForaDaZona(
  ponto: { lat: unknown; lng: unknown } | null | undefined,
  limite: number = KM_DA_ZONA_POR_OMISSAO,
  base: Ponto = BASE_DA_ZONA,
): ParceiroForaDaZona | null {
  const km = kmDeLisboaDeUmPonto(ponto, base);
  return km != null && km > limite ? { km, limite } : null;
}

/** O aviso de quem se candidata ou se inscreve. O número vem do limite que lhe dão. */
export function avisoDaZonaParaOParceiro(limite: number): string {
  const km = Math.round(limite);
  return (
    `A CLYON só envia pedidos até ${km} km de Lisboa: acima disso não há pedidos para si ` +
    `(nas mudanças conta o sítio de onde a mudança sai). Se a sua base fica mais longe, pode candidatar-se, ` +
    `mas não vai receber pedidos por agora.`
  );
}

/** A linha âmbar do backoffice, no cartão da candidatura ou da conta. */
export function linhaDoParceiroForaDaZona(f: Pick<ParceiroForaDaZona, "km" | "limite">): string {
  return `Fora da zona: base a ${Math.round(f.km)} km de Lisboa (limite ${Math.round(f.limite)} km) — não recebe pedidos`;
}
