import { NextRequest, NextResponse } from "next/server";

import { withConnection, ensureSimulatorOrdersTable } from "@/lib/db";
import { verifyProviderAuthHeader } from "@/lib/provider-auth";

export const runtime = "nodejs";

interface GanhosRow {
  jobsConcluded: number;
  grossTotal: string | null;
  netTotal: string | null;
  ratingAvg: string | null;
  ratingCount: number;
}

// GET /api/parceiros/ganhos — resumo de ganhos e avaliações do parceiro autenticado
export async function GET(req: NextRequest) {
  const provider = await verifyProviderAuthHeader(req.headers.get("authorization"));
  if (!provider) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensureSimulatorOrdersTable();

  const result = await withConnection(async (conn) => {
    const [providerRows] = await conn.execute(
      "SELECT commissionRate FROM providers WHERE id = ? LIMIT 1",
      [provider.providerId],
    ) as [Array<{ commissionRate: string }>, unknown];
    const commissionRate = Number(providerRows[0]?.commissionRate ?? 15);

    const [rows] = await conn.execute(
      `SELECT
         COUNT(*) AS jobsConcluded,
         SUM(COALESCE(precoFinal, 0)) AS grossTotal,
         SUM(COALESCE(precoFinal, 0) * (1 - ? / 100)) AS netTotal,
         AVG(clientRating) AS ratingAvg,
         SUM(CASE WHEN clientRating IS NOT NULL THEN 1 ELSE 0 END) AS ratingCount
       FROM simulatorOrders
       WHERE providerId = ? AND status = 'concluido'`,
      [commissionRate, provider.providerId],
    ) as [GanhosRow[], unknown];

    const row = rows[0];
    return {
      commissionRate,
      jobsConcluded: Number(row?.jobsConcluded ?? 0),
      grossTotal: Number(row?.grossTotal ?? 0),
      netTotal: Number(row?.netTotal ?? 0),
      ratingAvg: row?.ratingAvg != null ? Number(row.ratingAvg) : null,
      ratingCount: Number(row?.ratingCount ?? 0),
    };
  });

  return NextResponse.json(result);
}
