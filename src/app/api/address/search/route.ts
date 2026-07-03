import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
  };
  lat: string;
  lon: string;
}

interface AddressSuggestion {
  label: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  source: "nominatim";
}

/**
 * GET /api/address/search?q=rua+rui
 * 
 * Busca endereços em Portugal através do Nominatim
 * Evita fazer requisições diretas do browser (evita CORS e rate limiting)
 * 
 * Returns: {
 *   suggestions: AddressSuggestion[]
 * }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "pt");
    url.searchParams.set("limit", "8");
    url.searchParams.set("accept-language", "pt");

    const response = await fetch(url.toString(), {
      headers: {
        "Accept-Language": "pt-PT,pt;q=0.9",
        "User-Agent": "CLYON/1.0 (+https://clyon.pt)",
      },
    });

    if (!response.ok) {
      console.error("[address/search] Nominatim HTTP error:", response.status);
      return NextResponse.json({ suggestions: [] });
    }

    const results: NominatimResult[] = await response.json();

    const suggestions: AddressSuggestion[] = results
      .map((result) => {
        const road = result.address?.road || "";
        const number = result.address?.house_number || "";
        const address = `${road}${number ? `, ${number}` : ""}`.trim();
        const city = result.address?.city || result.address?.town || result.address?.village || "";
        const postalCode = result.address?.postcode || "";

        return {
          label: result.display_name,
          address,
          city,
          postalCode,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          source: "nominatim" as const,
        };
      })
      // Aceitar resultados com rua OU apenas cidade (pesquisas por cidade isolada,
      // ex: "Lisboa", não têm "road" e eram descartadas por completo).
      .filter((s) => s.address.trim().length > 0 || s.city.trim().length > 0);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[address/search] Error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
