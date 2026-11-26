import { distanciaEmLinhaRecta, FACTOR_DE_ESTRADA, pontoValido, type Ponto } from "./distancia-entre-pontos";
import { BASE_DA_ZONA, KM_DA_ZONA_POR_OMISSAO } from "./fora-da-zona";

/**
 * A MORADA ESCOLHIDA — d128b, 26-11-2026 (dono).
 *
 * Duas coisas, para o cliente não escolher a morada errada (o «Felgueiras»
 * que queria ser outro sítio):
 *
 * 1. A pesquisa dá preferência à zona de trabalho (o limite das Configs,
 *    `zona_km_maximo`, à volta da base), SEM excluir o resto do país: é uma
 *    preferência (`locationbias`), não uma restrição. Usa-se um rectângulo que
 *    contém o círculo da zona — o círculo do Google tem um raio máximo de 50 km
 *    e a zona tem 200.
 * 2. Escolhida a morada, mostra-se a localidade e, quando houver, a distância
 *    a Lisboa: «Felgueiras · 407 km de Lisboa». A distância é a mesma conta da
 *    regra dos 200 km (`kmDaBaseDoPedido`): a da estrada, quando o Google a
 *    mediu; senão a linha recta com a folga da estrada.
 *
 * Pura: serve o servidor (a rota do autocomplete) e o navegador.
 */

const KM_POR_GRAU_DE_LATITUDE = 111.32;

export type RectanguloDaZona = { sul: number; oeste: number; norte: number; este: number };

const arred = (n: number) => Math.round(n * 10000) / 10000;

/** O rectângulo que contém o círculo da zona (limite em km, à volta da base). */
export function rectanguloDaZona(limiteKm: number = KM_DA_ZONA_POR_OMISSAO, base: Ponto = BASE_DA_ZONA): RectanguloDaZona {
  const km = Number.isFinite(limiteKm) && limiteKm > 0 ? limiteKm : KM_DA_ZONA_POR_OMISSAO;
  const dLat = km / KM_POR_GRAU_DE_LATITUDE;
  const dLng = km / (KM_POR_GRAU_DE_LATITUDE * Math.cos((base.lat * Math.PI) / 180));
  return {
    sul: arred(Math.max(-90, base.lat - dLat)),
    oeste: arred(Math.max(-180, base.lng - dLng)),
    norte: arred(Math.min(90, base.lat + dLat)),
    este: arred(Math.min(180, base.lng + dLng)),
  };
}

/** O parâmetro `locationbias` da Places API (pedido no servidor). */
export function locationbiasDaZona(limiteKm?: number, base?: Ponto): string {
  const r = rectanguloDaZona(limiteKm, base);
  return `rectangle:${r.sul},${r.oeste}|${r.norte},${r.este}`;
}

/** A distância a Lisboa (à base) pela linha recta com a folga da estrada, em km inteiros. */
export function kmDeLisboa(ponto: { lat?: number | null; lng?: number | null }, base: Ponto = BASE_DA_ZONA): number | null {
  const p = { lat: Number(ponto.lat), lng: Number(ponto.lng) };
  if (ponto.lat == null || ponto.lng == null || !pontoValido(p) || (p.lat === 0 && p.lng === 0)) return null;
  return Math.round(distanciaEmLinhaRecta(base, p) * FACTOR_DE_ESTRADA);
}

const ehLisboa = (cidade: string) =>
  cidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase() === "lisboa";

/**
 * A linha por baixo da morada escolhida: «Felgueiras · 407 km de Lisboa».
 * `kmDaEstrada` (a medida do Google) ganha à linha recta. Em Lisboa, só
 * «Lisboa» — «Lisboa · 20 km de Lisboa» confundia. Sem localidade nem
 * distância, nada (null).
 */
export function linhaDaMoradaEscolhida(m: {
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  kmDaEstrada?: number | null;
}): string | null {
  const cidade = typeof m.city === "string" ? m.city.trim() : "";
  const estrada = typeof m.kmDaEstrada === "number" && Number.isFinite(m.kmDaEstrada) && m.kmDaEstrada > 0 ? Math.round(m.kmDaEstrada) : null;
  const km = estrada ?? kmDeLisboa({ lat: m.lat, lng: m.lng });
  if (cidade && ehLisboa(cidade)) return cidade;
  const distancia = km != null ? `${km} km de Lisboa` : "";
  const partes = [cidade, distancia].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}
