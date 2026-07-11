import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getPool, appendOrderHistory, getSimulatorOrderById } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/users/me/orders/[id]/reply
 * Body: { message: string }
 *
 * Cliente autenticado responde a um pedido de informação da assistente.
 * A resposta é anexada ao historyJson com type="client_reply" e mostrada
 * ao assistente no backoffice.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Mensagem demasiado longa." }, { status: 400 });

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível." }, { status: 500 });

  // Validar propriedade do pedido pelo email do cliente
  const [rows] = await pool.execute(
    `SELECT id FROM simulatorOrders WHERE id = ? AND LOWER(TRIM(contactEmail)) = ? LIMIT 1`,
    [orderId, email.trim().toLowerCase()]
  ) as any[];
  if (!(rows as any[])[0]) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  await appendOrderHistory(orderId, {
    type: "client_reply",
    by: { id: 0, nome: session!.user!.name ?? email, role: "cliente" },
    message,
  });

  const updated = await getSimulatorOrderById(orderId);
  return NextResponse.json({ ok: true, historyJson: (updated as any)?.historyJson ?? null });
}
