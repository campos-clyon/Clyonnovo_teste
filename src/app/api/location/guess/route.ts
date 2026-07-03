import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/location/guess
 *
 * Descobre a localização aproximada do cliente a partir dos headers de
 * geolocalização por IP da Vercel. Não requer permissão do browser nem GPS.
 *
 * Resposta (cidade encontrada):
 * {
 *   ok: true,
 *   source: "ip",
 *   country: "Portugal",
 *   countryCode: "PT",
 *   city: "Lisboa",
 *   region: "Lisboa",
 *   label: "Lisboa"
 * }
 *
 * Resposta (só país):
 * { ok: true, source: "ip", country: "Portugal", countryCode: "PT", label: "Portugal" }
 *
 * Resposta (nada encontrado):
 * { ok: false }
 */

// Mapa mínimo de códigos de país → nome em português
const COUNTRY_NAMES: Record<string, string> = {
  PT: "Portugal",
  ES: "Espanha",
  FR: "France",
  GB: "Reino Unido",
  DE: "Alemanha",
  IT: "Itália",
  BR: "Brasil",
  US: "Estados Unidos",
  NL: "Países Baixos",
  BE: "Bélgica",
  CH: "Suíça",
  LU: "Luxemburgo",
  IE: "Irlanda",
  AO: "Angola",
  MZ: "Moçambique",
  CV: "Cabo Verde",
};

function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    // Vercel envia a cidade URL-encoded (ex: "Lisbon" ou "S%C3%A3o%20Paulo")
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export async function GET(request: NextRequest) {
  try {
    const countryCode = decodeHeader(
      request.headers.get("x-vercel-ip-country"),
    ).toUpperCase();
    const region = decodeHeader(
      request.headers.get("x-vercel-ip-country-region"),
    );
    const city = decodeHeader(request.headers.get("x-vercel-ip-city"));

    const country = countryCode
      ? COUNTRY_NAMES[countryCode] || countryCode
      : "";

    if (process.env.NODE_ENV !== "production") {
      console.log("[location/guess] headers:", { countryCode, region, city });
    }

    // Cidade encontrada → melhor caso
    if (city) {
      return NextResponse.json({
        ok: true,
        source: "ip",
        country: country || undefined,
        countryCode: countryCode || undefined,
        city,
        region: region || undefined,
        label: city,
      });
    }

    // Só país
    if (country) {
      return NextResponse.json({
        ok: true,
        source: "ip",
        country,
        countryCode: countryCode || undefined,
        region: region || undefined,
        label: country,
      });
    }

    // Nada encontrado (ex: localhost / dev sem headers da Vercel)
    return NextResponse.json({ ok: false });
  } catch (err) {
    console.error("[location/guess] erro inesperado:", err);
    return NextResponse.json({ ok: false });
  }
}
