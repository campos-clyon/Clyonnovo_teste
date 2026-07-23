import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";

import { withConnection, ensureSimulatorOrdersTable } from "@/lib/db";
import { verifyProviderAuthHeader } from "@/lib/provider-auth";

export const runtime = "nodejs";

// POST /api/parceiros/pedidos/[id]/concluir — muda status para 'concluido'
// e dispara exportação automática para Google Sheets (ver src/lib/google-sheets.ts).
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

  const { affectedRows, order } = await withConnection(async (conn) => {
    const [result] = await conn.execute(
      `UPDATE simulatorOrders
       SET status = 'concluido', completedAt = NOW()
       WHERE id = ? AND providerId = ? AND status IN ('aprovado', 'em_execucao')`,
      [orderId, provider.providerId],
    ) as [ResultSetHeader, unknown];

    if (result.affectedRows === 0) return { affectedRows: 0, order: null };

    const [rows] = await conn.execute(
      `SELECT id, createdAt, serviceType, city, estimateTotal, precoFinal, precoFinalIva, providerId
       FROM simulatorOrders WHERE id = ? LIMIT 1`,
      [orderId],
    ) as [any[], unknown];

    return { affectedRows: result.affectedRows, order: rows[0] ?? null };
  });

  if (affectedRows === 0) {
    return NextResponse.json(
      { error: "Pedido não encontrado ou não está num estado que permite marcar como concluído." },
      { status: 409 },
    );
  }

  // Exportação para Google Sheets — assíncrona, nunca bloqueia a resposta
  if (order) {
    import("@/lib/google-sheets")
      .then(({ exportCompletedOrderToSheet }) => exportCompletedOrderToSheet(order))
      .catch((err) => console.error("[parceiros/concluir] falha Sheets:", err));

    // Email de pedido de avaliação ao cliente (se tiver email registado)
    const { withConnection: wc } = await import("@/lib/db");
    wc(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT contactName, contactEmail, serviceType FROM simulatorOrders WHERE id = ? LIMIT 1",
        [orderId],
      ) as [Array<{ contactName: string | null; contactEmail: string | null; serviceType: string | null }>, unknown];
      const o = rows[0];
      if (o?.contactEmail) {
        const { sendReviewRequestEmail } = await import("@/lib/email-parceiro");
        await sendReviewRequestEmail({
          to:           o.contactEmail,
          clienteName:  o.contactName ?? "Cliente",
          serviceType:  o.serviceType ?? null,
          orderId,
        });
      }
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
