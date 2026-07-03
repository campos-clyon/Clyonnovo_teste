import { NextRequest, NextResponse } from 'next/server';

interface NominatimResponse {
  address?: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
  };
  error?: string;
}

/**
 * POST /api/address/reverse
 * 
 * Reverse geocoding: Convert GPS coordinates (lat, lng) to address
 * Uses Nominatim (OpenStreetMap) - free, no API key required
 * 
 * Request:
 * {
 *   lat: 38.7506,
 *   lng: -9.1228
 * }
 * 
 * Response:
 * {
 *   ok: true,
 *   formattedAddress: "Rua Rui Grácio, 1950-135 Lisboa",
 *   city: "Lisboa",
 *   postalCode: "1950-135",
 *   lat: 38.7506,
 *   lng: -9.1228
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        {
          ok: false,
          error: 'MISSING_COORDINATES',
          message: 'lat e lng são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Validar coordenadas
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_COORDINATES',
          message: 'lat e lng devem ser números',
        },
        { status: 400 }
      );
    }

    // Chamar Nominatim (reverse geocoding)
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt`;

    const response = await fetch(nominatimUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CLYON-App (https://clyon.pt)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[address/reverse] Nominatim HTTP error:', response.status);
      return NextResponse.json(
        {
          ok: false,
          error: 'NOMINATIM_ERROR',
          message: 'Erro ao obter endereço',
        },
        { status: 503 }
      );
    }

    const data: NominatimResponse = await response.json();

    if (!data.address) {
      console.error('[address/reverse] Nominatim sem endereço:', data);
      return NextResponse.json(
        {
          ok: false,
          error: 'NO_ADDRESS_FOUND',
          message: 'Nenhum endereço encontrado para estas coordenadas',
        },
        { status: 404 }
      );
    }

    // Construir endereço formatado
    const road = data.address.road || '';
    const houseNumber = data.address.house_number || '';
    const street = road && houseNumber ? `${road}, ${houseNumber}` : road || 'Local desconhecido';
    const postalCode = data.address.postcode || '';
    const city = data.address.city || data.address.county || data.address.state || 'Portugal';

    const formattedAddress = `${street}${postalCode ? ', ' + postalCode : ''} ${city}`.trim();

    console.log('[address/reverse] Sucesso:', { lat, lng, city, formattedAddress });

    return NextResponse.json({
      ok: true,
      formattedAddress,
      city,
      postalCode,
      lat,
      lng,
    });
  } catch (err) {
    console.error('[address/reverse] Erro inesperado:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'UNEXPECTED_ERROR',
        message: 'Erro ao processar localização',
      },
      { status: 500 }
    );
  }
}
