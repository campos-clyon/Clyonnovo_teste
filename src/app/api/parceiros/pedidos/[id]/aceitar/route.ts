import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";

import { withConnection, ensureSimulatorOrdersTable } from "@/lib/db";
import { verifyProviderAuthHeader } from "@/lib/provider-auth";

export const runtime = "nodejs";

// POST /api/parceiros/pedidos/[id]/aceitar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const provider = await verifyProviderAuthHeader(req.headers.get("authorization"));
  if (!provider) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
  }

  await ensureSimulatorOrdersTable();

  // UPDATE atómico: só aceita se ainda ninguém o tiver reclamado (evita corrida entre parceiros)
  const affectedRows = await withConnection(async (conn) => {
    const [result] = await conn.execute(
      `UPDATE simulatorOrders
       SET providerId = ?, providerAcceptedAt = NOW()
       WHERE id = ? AND status = 'aprovado' AND providerId IS NULL`,
      [provider.providerId, orderId],
    ) as [ResultSetHeader, unknown];
    return result.affectedRows;
  });

  if (affectedRows === 0) {
    return NextResponse.json(
      { error: "Este pedido já foi aceite por outro parceiro ou já não está disponível." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
