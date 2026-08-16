/**
 * Distância entre dois pontos, em linha recta.
 *
 * Não confundir com `distancia-estimada.ts`, que estima a distância desde a
 * base da CLYON a partir do código postal e serve o motor de preços. Este
 * ficheiro responde a outra pergunta: quão longe fica este trabalho da base
 * *deste* profissional — o que decide se ele chega a ver o pedido.
 *
 * É linha recta e não distância de estrada, de propósito. Perguntar a estrada
 * a uma API para cada par (pedido × profissional) seria uma chamada por
 * profissional a cada pedido criado, paga e lenta, para decidir uma coisa que
 * o próprio profissional já definiu por alto quando escreveu "desloco-me até
 * 30 km". A linha recta subestima a estrada em cerca de 20-30 %, e por isso o
 * raio é aplicado com uma folga — ver FACTOR_DE_ESTRADA.
 */

/** Raio médio da Terra, em km. */
const RAIO_DA_TERRA_KM = 6371;

/**
 * Quanto a estrada é mais longa do que a linha recta, em média.
 *
 * Sem isto, quem dissesse "30 km" recebia pedidos a 30 km em linha recta que
 * na prática são 39 de estrada — e a promessa que lhe fizemos no registo
 * deixava de ser verdade logo no primeiro pedido.
 */
export const FACTOR_DE_ESTRADA = 1.3;

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

export type Ponto = { lat: number; lng: number };

export function pontoValido(p: unknown): p is Ponto {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // 0,0 é no Golfo da Guiné. Em Portugal é sempre um campo por preencher que
    // alguém converteu para número — e passava a "0 km da base", ou seja,
    // elegível para tudo.
    !(lat === 0 && lng === 0)
  );
}

/** Haversine. Devolve km em linha recta. */
export function distanciaEmLinhaRecta(a: Ponto, b: Ponto): number {
  const dLat = radianos(b.lat - a.lat);
  const dLng = radianos(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(a.lat)) * Math.cos(radianos(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A distância a usar na regra de elegibilidade: linha recta corrigida para
 * aproximar a estrada. `null` quando não há coordenadas de um dos lados — e aí
 * a regra cai nas zonas, que é o comportamento certo e não um erro.
 */
export function distanciaParaElegibilidade(
  base: unknown,
  trabalho: unknown,
): number | null {
  if (!pontoValido(base) || !pontoValido(trabalho)) return null;
  const km = distanciaEmLinhaRecta(base, trabalho) * FACTOR_DE_ESTRADA;
  return Math.round(km * 10) / 10;
}
