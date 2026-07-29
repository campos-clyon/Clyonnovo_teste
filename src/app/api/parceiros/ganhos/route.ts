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
    // Já não se subtrai comissão nenhuma ao que o profissional recebe.
    //
    // A coluna providers.commissionRate ainda existe, com 15 por omissão, e
    // esta consulta descontava-a: num trabalho de 400 € mostrava 340 €. No
    // modelo desde 29-07-2026 o profissional recebe do cliente o valor
    // acordado POR INTEIRO — a CLYON não lhe paga nem lhe retém nada.
    //
    // O que ele paga é uma taxa de aceitação de 10%, descontada da carteira
    // em euros no momento em que aceita o trabalho. Não sai daqui, e por isso
    // não se abate a este total. Os 5% da reserva são pagos pelo CLIENTE por
    // cima do serviço — nunca lhe tocam.
    const [rows] = await conn.execute(
      `SELECT
         COUNT(*) AS jobsConcluded,
         SUM(COALESCE(precoFinal, 0)) AS grossTotal,
         AVG(clientRating) AS ratingAvg,
         SUM(CASE WHEN clientRating IS NOT NULL THEN 1 ELSE 0 END) AS ratingCount
       FROM simulatorOrders
       WHERE providerId = ? AND status = 'concluido'`,
      [provider.providerId],
    ) as [GanhosRow[], unknown];

    const row = rows[0];
    const recebido = Number(row?.grossTotal ?? 0);
    return {
      jobsConcluded: Number(row?.jobsConcluded ?? 0),
      /** O que o profissional recebeu dos clientes, por inteiro. */
      grossTotal: recebido,
      /** Percentagem da taxa de aceitação, para o ecrã explicar o modelo. */
      taxaAceitacaoPct: 10,
      ratingAvg: row?.ratingAvg != null ? Number(row.ratingAvg) : null,
      ratingCount: Number(row?.ratingCount ?? 0),
    };
  });

  return NextResponse.json(result);
}
