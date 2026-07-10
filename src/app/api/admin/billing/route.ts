import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/admin/billing
 * Returns billing info for the authenticated assistant (or all assistants for admin).
 */
export async function GET(req: NextRequest) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível." }, { status: 500 });

  const isAdmin = Number(jwt.isAdmin) === 1;

  if (isAdmin) {
    const [rows] = await pool.execute(`
      SELECT c.id, c.nome, c.costPerAcceptedOrder, c.totalPaid,
        (SELECT COUNT(*) FROM simulatorOrders WHERE assignedToId = c.id AND acceptedAt IS NOT NULL) as acceptedCount
      FROM colaboradores c
      WHERE c.funcao = 'assistente'
      ORDER BY c.nome
    `);
    return NextResponse.json({ assistants: rows });
  }

  // Assistant: own billing
  const [rows] = await pool.execute(`
    SELECT c.costPerAcceptedOrder, c.totalPaid,
      (SELECT COUNT(*) FROM simulatorOrders WHERE assignedToId = c.id AND acceptedAt IS NOT NULL) as acceptedCount
    FROM colaboradores c
    WHERE c.id = ?
  `, [jwt.id]);

  const row = (rows as any[])[0];
  if (!row) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });

  const costPerOrder = parseFloat(row.costPerAcceptedOrder ?? "6");
  const totalOwed = row.acceptedCount * costPerOrder;
  const totalPaid = parseFloat(row.totalPaid ?? "0");

  return NextResponse.json({
    acceptedCount: row.acceptedCount,
    costPerOrder,
    totalOwed,
    totalPaid,
    balance: totalOwed - totalPaid,
  });
}

/**
 * PATCH /api/admin/billing
 * Admin-only: update costPerAcceptedOrder or record a payment for an assistant.
 * Body: { assistantId, costPerAcceptedOrder?, addPayment? }
 */
export async function PATCH(req: NextRequest) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (Number(jwt.isAdmin) !== 1) return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível." }, { status: 500 });

  const body = await req.json();
  const { assistantId, costPerAcceptedOrder, addPayment } = body;

  if (!assistantId) return NextResponse.json({ error: "assistantId obrigatório." }, { status: 400 });

  const sets: string[] = [];
  const vals: any[] = [];

  if (costPerAcceptedOrder !== undefined) {
    sets.push("costPerAcceptedOrder = ?");
    vals.push(Number(costPerAcceptedOrder));
  }

  if (addPayment !== undefined && Number(addPayment) > 0) {
    sets.push("totalPaid = totalPaid + ?");
    vals.push(Number(addPayment));
  }

  if (sets.length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  vals.push(assistantId);
  await pool.execute(`UPDATE colaboradores SET ${sets.join(", ")}, updatedAt = NOW() WHERE id = ?`, vals);

  return NextResponse.json({ ok: true });
}
