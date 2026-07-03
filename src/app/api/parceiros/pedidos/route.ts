import { NextRequest, NextResponse } from "next/server";

import { withConnection, ensureSimulatorOrdersTable } from "@/lib/db";
import { verifyProviderAuthHeader } from "@/lib/provider-auth";
import { normalize } from "@/lib/coverage";

export const runtime = "nodejs";

interface ProviderOrderRow {
  id: number;
  serviceType: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  floor: string | null;
  hasElevator: string | null;
  urgency: string | null;
  precoFinal: string | null;
  precoFinalIva: string | null;
  status: string;
  providerAcceptedAt: string | null;
  createdAt: string;
}

// GET /api/parceiros/pedidos — { available: [...], mine: [...] }
export async function GET(req: NextRequest) {
  const provider = await verifyProviderAuthHeader(req.headers.get("authorization"));
  if (!provider) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensureSimulatorOrdersTable();

  const { available, mine } = await withConnection(async (conn) => {
    const [zoneRows] = await conn.execute(
      "SELECT zone FROM provider_coverage WHERE providerId = ? AND isActive = 1",
      [provider.providerId],
    ) as [Array<{ zone: string }>, unknown];
    const normalizedZones = zoneRows.map((z) => normalize(z.zone));

    const [candidateRows] = await conn.execute(
      `SELECT id, serviceType, description, address, city, floor, hasElevator, urgency,
              precoFinal, precoFinalIva, status, providerAcceptedAt, createdAt
       FROM simulatorOrders
       WHERE status = 'aprovado' AND providerId IS NULL
       ORDER BY createdAt ASC`,
    ) as [ProviderOrderRow[], unknown];

    const available = candidateRows.filter((order) => {
      const city = normalize(order.city ?? "");
      if (!city) return false;
      return normalizedZones.some((zone) => city.includes(zone) || zone.includes(city));
    });

    const [mine] = await conn.execute(
      `SELECT id, serviceType, description, address, city, floor, hasElevator, urgency,
              precoFinal, precoFinalIva, status, providerAcceptedAt, createdAt
       FROM simulatorOrders
       WHERE providerId = ?
       ORDER BY providerAcceptedAt DESC`,
      [provider.providerId],
    ) as [ProviderOrderRow[], unknown];

    return { available, mine };
  });

  return NextResponse.json({ available, mine });
}
