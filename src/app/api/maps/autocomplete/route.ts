import { NextRequest, NextResponse } from "next/server";

import { getMapsApiKey } from "@/lib/maps-config";

export const revalidate = 0;

export async function POST(request: NextRequest) {
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

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "autocomplete_unavailable" },
      { status: 502 },
    );
  }

  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      {
        error: data.error_message || data.status || "autocomplete_unavailable",
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
