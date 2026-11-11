import { guardarPercursoDoPedido } from "./db";
import { pontoValido, type Ponto } from "./distancia-entre-pontos";
import { percursoDeJson, type PercursoGuardado } from "./mapa-do-percurso";

/**
 * O PERCURSO DE UMA MUDANÇA, COM O TRAÇADO — 11-11-2026. Do lado do servidor:
 * pergunta ao Routes os km, os minutos e o traçado (encodedPolyline) e guarda
 * no pedido, uma vez. O mapa (`/api/mapa?percurso=`) e o pedido dirigido ao
 * parceiro lêem o que ficou guardado — a segunda vista não paga outra chamada.
 *
 * Sem trânsito, como `distancia-rodoviaria.ts`: o número tem de ser o mesmo de
 * manhã e à noite. Nunca atira: sem chave, sem rede ou sem rota devolve null e
 * quem chama desenha o bloco sem mapa.
 */

async function perguntarAoRoutes(origem: Ponto, destino: Ponto): Promise<PercursoGuardado | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
        destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        polylineQuality: "OVERVIEW",
        languageCode: "pt-PT",
        regionCode: "PT",
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const dados = (await res.json()) as {
      routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
    };
    const rota = dados.routes?.[0];
    if (!rota?.distanceMeters) return null;
    const segundos = Number(String(rota.duration ?? "").replace("s", ""));
    return {
      versao: 1,
      km: Math.round((rota.distanceMeters / 1000) * 10) / 10,
      minutos: Number.isFinite(segundos) && segundos > 0 ? Math.round(segundos / 60) : null,
      polyline: rota.polyline?.encodedPolyline ?? null,
      em: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** O percurso do pedido: o guardado, ou pergunta-se agora e guarda-se. */
export async function percursoDoPedido(
  pedidoId: number,
  guardado: string | null | undefined,
  origem: Ponto | null | undefined,
  destino: Ponto | null | undefined,
): Promise<PercursoGuardado | null> {
  const ja = percursoDeJson(guardado ?? null);
  if (ja) return ja;
  if (!pontoValido(origem) || !pontoValido(destino)) return null;
  const novo = await perguntarAoRoutes(origem, destino);
  if (!novo) return null;
  await guardarPercursoDoPedido(pedidoId, JSON.stringify(novo)).catch((e) =>
    console.error("[percurso do pedido] não se guardou:", e instanceof Error ? e.message : e),
  );
  return novo;
}
