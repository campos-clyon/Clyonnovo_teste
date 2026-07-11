import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getPool, toMySQLDateTime } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/mark-history-read
 * Marca o histórico do pedido como lido pelo assistente (agora). Usado para
 * limpar o badge de "novas respostas do cliente".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const isAdmin = Number(jwt.isAdmin) === 1;
  const isAssistente = jwt.funcao === "assistente";
  if (!isAdmin && !isAssistente) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

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
