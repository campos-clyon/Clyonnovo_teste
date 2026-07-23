import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";

import { withConnection, ensureSimulatorOrdersTable } from "@/lib/db";
import { verifyProviderAuthHeader } from "@/lib/provider-auth";

export const runtime = "nodejs";

// POST /api/parceiros/pedidos/[id]/iniciar — muda status para 'em_execucao'
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

  const affectedRows = await withConnection(async (conn) => {
    const [result] = await conn.execute(
      `UPDATE simulatorOrders
       SET status = 'em_execucao'
       WHERE id = ? AND providerId = ? AND status = 'aprovado'`,
      [orderId, provider.providerId],
    ) as [ResultSetHeader, unknown];
    return result.affectedRows;
  });

  if (affectedRows === 0) {
    return NextResponse.json(
      { error: "Pedido não encontrado ou não está no estado correto para iniciar." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
