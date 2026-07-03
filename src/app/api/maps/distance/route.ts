import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseGoogleDurationToSeconds(duration: string): number {
  // Routes API devolve ex: "1680s"
  return Number(duration.replace("s", ""));
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

// ---------------------------------------------------------------------------
// Resposta amigável reutilizável
// ---------------------------------------------------------------------------

const FRIENDLY_ERROR = NextResponse.json(
  {
    ok: false,
    customerMessage:
      "Não foi possível calcular a distância agora. A equipa CLYON confirma manualmente.",
  },
  { status: 503 }
);

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const revalidate = 0;

export async function POST(request: NextRequest) {
  // 1. Chave de servidor — NUNCA usar NEXT_PUBLIC_ no backend
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    console.error(
      "[maps/distance] ERRO CRÍTICO: GOOGLE_MAPS_SERVER_API_KEY não configurada em produção.\n" +
      "AÇÃO NECESSÁRIA:\n" +
      "1. Ir a https://vercel.com/projects/clyon-site/settings/environment-variables\n" +
      "2. Adicionar variável na environment 'Production':\n" +
      "   Nome: GOOGLE_MAPS_SERVER_API_KEY\n" +
      "   Valor: [chave do Google Cloud com Routes API ativa]\n" +
      "3. Fazer redeploy\n" +
      "Routes API docs: https://developers.google.com/maps/documentation/routes"
    );
    return NextResponse.json(
      {
        ok: false,
        error: "NO_API_KEY",
        customerMessage: "Distância a confirmar manualmente.",
        debug: {
          missingVar: "GOOGLE_MAPS_SERVER_API_KEY",
          action: "Adicionar em Project Settings → Environment Variables → Production",
          docsUrl: "https://developers.google.com/maps/documentation/routes",
        },
      },
      { status: 200 } // 200, não 503, para não quebrar o frontend
    );
  }

  // 2. Origem: coordenadas da base CLYON (preferencial) ou endereço
  const baseLat = process.env.CLYON_BASE_LAT ? Number(process.env.CLYON_BASE_LAT) : null;
  const baseLng = process.env.CLYON_BASE_LNG ? Number(process.env.CLYON_BASE_LNG) : null;
  const baseAddress = process.env.CLYON_BASE_ADDRESS ?? "Av. Q.ta das Laranjeiras, 2865-688 Fernão Ferro, Portugal";

  console.log("[maps/distance] BASE_COORDS:", baseLat, baseLng, "| ADDRESS:", baseAddress);

  const originPayload =
    baseLat !== null && baseLng !== null
      ? { location: { latLng: { latitude: baseLat, longitude: baseLng } } }
      : { address: baseAddress };

  // 3. Destino: coordenadas (preferencial) ou endereço formatado
  let body: { destination?: { formattedAddress?: string; lat?: number; lng?: number; placeId?: string } };
  try {
    body = await request.json();
  } catch (err) {
    console.error("[maps/distance] ERRO: Payload JSON inválido:", err);
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", customerMessage: "Dados inválidos no pedido." },
      { status: 400 }
    );
  }

  const dest = body.destination;
  if (!dest || (!dest.lat && !dest.formattedAddress)) {
    console.error("[maps/distance] ERRO: Destino em falta ou inválido:", dest);
    return NextResponse.json(
      { ok: false, error: "MISSING_DESTINATION", customerMessage: "Destino em falta." },
      { status: 400 }
    );
  }

  const destinationPayload =
    dest.lat && dest.lng
      ? { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } }
      : { address: dest.formattedAddress! };

  console.log("[maps/distance] REQUEST:", {
    origin: originPayload,
    destination: destinationPayload,
  });

  // 4. Chamada à Google Routes API
  try {
    const routesUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const routesPayload = {
      origin: originPayload,
      destination: destinationPayload,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-PT",
      regionCode: "PT",
    };

    console.log("[maps/distance] Chamando Google Routes API...");

    const res = await fetch(routesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.localizedValues",
      },
      body: JSON.stringify(routesPayload),
      cache: "no-store",
    });

    console.log("[maps/distance] Routes API HTTP status:", res.status);

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[maps/distance] ERRO HTTP:", res.status, "| Body:", errBody);
      
      // Identificar causa comum
      let debugInfo = "";
      if (res.status === 403) {
        debugInfo = "PERMISSION_DENIED — Chave sem permissão para Routes API ou IP não autorizado";
      } else if (res.status === 429) {
        debugInfo = "QUOTA_EXCEEDED — Limite de requisições Google atingido";
      } else if (res.status === 401) {
        debugInfo = "UNAUTHENTICATED — Chave inválida ou expirada";
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: "ROUTES_API_ERROR",
          httpStatus: res.status,
          details: errBody.substring(0, 200),
          debugInfo,
          customerMessage: "Distância a confirmar manualmente.",
        },
        { status: 200 } // 200, não 503
      );
    }

    const data = await res.json();
    console.log("[maps/distance] Routes API response:", JSON.stringify(data).substring(0, 300));

    const route = data.routes?.[0];

    if (!route) {
      console.error("[maps/distance] ERRO: Nenhuma rota retornada. Data:", JSON.stringify(data));
      return NextResponse.json(
        {
          ok: false,
          error: "NO_ROUTE_FOUND",
          details: "Google Routes não encontrou rota",
          customerMessage: "Distância a confirmar manualmente.",
        },
        { status: 200 } // 200, não 503
      );
    }

    if (!route.distanceMeters || !route.duration) {
      console.error("[maps/distance] ERRO: Rota sem distância ou duração. Route:", JSON.stringify(route).substring(0, 300));
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_ROUTE_DATA",
          details: "Rota sem distância ou duração",
          customerMessage: "Distância a confirmar manualmente.",
        },
        { status: 200 } // 200, não 503
      );
    }

    const distanceMeters: number = route.distanceMeters;
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationSeconds = parseGoogleDurationToSeconds(String(route.duration));
    const durationText = formatDuration(durationSeconds);

    console.log("[maps/distance] SUCESSO:", {
      distanceKm,
      durationText,
      distanceMeters,
    });

    return NextResponse.json({
      ok: true,
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationText,
      origin: {
        address: baseAddress,
        lat: baseLat,
        lng: baseLng,
      },
      destination: {
        formattedAddress: dest.formattedAddress,
        lat: dest.lat,
        lng: dest.lng,
        placeId: dest.placeId,
      },
    });
  } catch (err) {
    console.error("[maps/distance] ERRO INESPERADO:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: err instanceof Error ? err.message : "Unknown error",
        customerMessage: "Erro ao calcular distância. Tente novamente.",
      },
      { status: 500 }
    );
  }
}
