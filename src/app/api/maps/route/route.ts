import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseGoogleDurationToSeconds(duration: string): number {
  return Number(duration.replace("s", ""));
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

const FRIENDLY_ERROR = NextResponse.json(
  { ok: false, customerMessage: "Não foi possível calcular o percurso agora." },
  { status: 503 }
);

// ---------------------------------------------------------------------------
// POST /api/maps/route
// Calcula o percurso entre origem e destino (para o serviço Mudança).
// Body: { origin: AddressData, destination: AddressData }
// ---------------------------------------------------------------------------

export const revalidate = 0;

export async function POST(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    console.error("[maps/route] GOOGLE_MAPS_SERVER_API_KEY não configurada.");
    return FRIENDLY_ERROR;
  }

  let body: {
    origin?: { lat?: number; lng?: number; formattedAddress?: string };
    destination?: { lat?: number; lng?: number; formattedAddress?: string };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, customerMessage: "Payload inválido." }, { status: 400 });
  }

  const { origin, destination } = body;
  if (!origin || !destination) {
    return NextResponse.json({ ok: false, customerMessage: "Origem ou destino em falta." }, { status: 400 });
  }

  const buildWaypoint = (addr: typeof origin) =>
    addr!.lat && addr!.lng
      ? { location: { latLng: { latitude: addr!.lat, longitude: addr!.lng } } }
      : { address: addr!.formattedAddress! };

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.localizedValues",
      },
      body: JSON.stringify({
        origin: buildWaypoint(origin),
        destination: buildWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-PT",
        regionCode: "PT",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[maps/route] Routes API HTTP error:", res.status, errBody);
      return FRIENDLY_ERROR;
    }

    const data = await res.json();
    const route = data.routes?.[0];

    if (!route || !route.distanceMeters || !route.duration) {
      console.error("[maps/route] Routes API sem rota válida:", JSON.stringify(data));
      return FRIENDLY_ERROR;
    }

    const distanceMeters: number = route.distanceMeters;
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationSeconds = parseGoogleDurationToSeconds(String(route.duration));
    const durationText = formatDuration(durationSeconds);

    return NextResponse.json({ ok: true, distanceMeters, distanceKm, durationSeconds, durationText });
  } catch (err) {
    console.error("[maps/route] Erro inesperado:", err);
    return FRIENDLY_ERROR;
  }
}
