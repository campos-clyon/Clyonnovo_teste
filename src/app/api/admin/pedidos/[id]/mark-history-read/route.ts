import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, toMySQLDateTime } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/mark-history-read
 * Marca o histórico do pedido como lido. Usado para limpar o badge de "novas
 * respostas do cliente".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível." }, { status: 500 });

  const now = toMySQLDateTime();
  await pool.execute(
    `UPDATE simulatorOrders SET historyReadAt = ? WHERE id = ?`,
    [now, orderId]
  );

  return NextResponse.json({ ok: true, historyReadAt: now });
}
