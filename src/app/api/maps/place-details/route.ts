import { NextRequest, NextResponse } from "next/server";

import { getMapsApiKey } from "@/lib/maps-config";

export const revalidate = 0;

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

function findComponent(
  components: AddressComponent[],
  type: string,
): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name;
}

export async function POST(request: NextRequest) {
  const { placeId } = await request.json();

  if (typeof placeId !== "string" || !placeId) {
    return NextResponse.json({ ok: false, error: "missing_place_id" }, { status: 400 });
  }

  const key = getMapsApiKey();
  if (!key) {
    return NextResponse.json({ ok: false, error: "maps_unconfigured" }, { status: 503 });
  }

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "geometry,formatted_address,address_components,name",
    language: "pt-PT",
    region: "pt",
    key,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: "details_unavailable" }, { status: 502 });
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.result) {
      return NextResponse.json(
        { ok: false, error: data.error_message || data.status || "details_unavailable" },
        { status: 502 },
      );
    }

    const result = data.result;
    const components: AddressComponent[] = result.address_components ?? [];

    const city =
      findComponent(components, "locality") ||
      findComponent(components, "postal_town") ||
      findComponent(components, "administrative_area_level_2") ||
      "";

    const postalCode = findComponent(components, "postal_code") || "";
    const countryCode =
      components.find((c) => c.types.includes("country"))?.short_name || "";

    const lat = result.geometry?.location?.lat ?? null;
    const lng = result.geometry?.location?.lng ?? null;

    return NextResponse.json({
      ok: true,
      formattedAddress: result.formatted_address ?? "",
      city,
      postalCode,
      countryCode,
      lat,
      lng,
    });
  } catch (err) {
    console.error("[maps/place-details] erro:", err);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
