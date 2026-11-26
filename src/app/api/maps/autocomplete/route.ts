import { NextRequest, NextResponse } from "next/server";

import { getMapsApiKey } from "@/lib/maps-config";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { baseDaZona, limiteDaZonaKm } from "@/lib/fora-da-zona-na-base";
import { locationbiasDaZona } from "@/lib/morada-escolhida";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  const limite = await limitarRotaPublica(request, "maps-autocomplete", 60, 60);
  if (limite.erro) return limite.erro;

  const { input } = await request.json();
  const query = typeof input === "string" ? input.trim() : "";

  if (query.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const key = getMapsApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "maps_unconfigured" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    input: query,
    components: "country:pt",
    language: "pt-PT",
    // "geocode" cobre ruas e cidades/localidades; "address" (usado antes) excluía
    // pesquisas por cidade isolada (ex: "Lisboa"), devolvendo sempre ZERO_RESULTS.
    types: "geocode",
    key,
  });

  /*
   * d128b (26-11-2026): preferência à zona de trabalho (o limite das Configs à
   * volta da base) — preferência, não restrição: o resto do país continua a
   * aparecer. Se o Google recusar o parâmetro, pesquisa-se sem ele: uma
   * preferência nunca pode deixar o cliente sem moradas.
   */
  let zona: string | null = null;
  try {
    zona = locationbiasDaZona(await limiteDaZonaKm(), baseDaZona());
  } catch {
    zona = null;
  }
  const pedir = (comZona: boolean) => {
    const p = new URLSearchParams(params);
    if (comZona && zona) p.set("locationbias", zona);
    return fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${p.toString()}`, { cache: "no-store" });
  };

  let response = await pedir(true);
  let data = response.ok ? await response.json() : null;
  if (zona && (!response.ok || data?.status === "INVALID_REQUEST")) {
    console.warn("[maps/autocomplete] locationbias recusado — pesquisa sem a zona", data?.status ?? response.status);
    response = await pedir(false);
    data = response.ok ? await response.json() : null;
  }

  if (!response.ok || !data) {
    return NextResponse.json(
      { error: "autocomplete_unavailable" },
      { status: 502 },
    );
  }

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    /*
     * REQUEST_DENIED não é o Google em baixo — é a NOSSA chave sem a Places
     * API na lista de restrições. Foi exactamente o que aconteceu quando a
     * chave passou a só Routes + Geocoding: 33 falhas em cinco minutos e um
     * alerta da Vercel, com o Google perfeitamente de pé. O estado fica no
     * log e no corpo para o próximo diagnóstico demorar um minuto.
     */
    console.warn("[maps/autocomplete]", data.status, data.error_message ?? "");
    return NextResponse.json(
      {
        error:
          data.status === "REQUEST_DENIED"
            ? "places_api_recusada — falta a Places API nas restrições da chave"
            : data.error_message || data.status || "autocomplete_unavailable",
      },
      { status: 502 },
    );
  }

  const predictions = (data.predictions ?? []).map(
    (prediction: {
      place_id?: string;
      description?: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
    }) => ({
      placeId: prediction.place_id ?? prediction.description ?? "",
      description: prediction.description ?? "",
      mainText:
        prediction.structured_formatting?.main_text ??
        prediction.description ??
        "",
      secondaryText: prediction.structured_formatting?.secondary_text ?? "",
    }),
  );

  return NextResponse.json({ predictions });
}
