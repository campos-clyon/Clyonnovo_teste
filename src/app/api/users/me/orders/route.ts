import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptionsCliente } from "@/auth-cliente";
import { getPool, ensureSimulatorOrdersTable } from "@/lib/db";

/**
 * Constrói a condição SQL que liga os pedidos ao cliente autenticado.
 *
 * Um pedido pertence ao cliente se o email do pedido (contactEmail) corresponde
 * ao email da sessão — comparação normalizada (TRIM + LOWER) para tolerar maiúsculas/espaços.
 *
 * Nota: Fallback por telefone desactivado até que a coluna `phone` exista na tabela `users`.
 *
 * Devolve o fragmento SQL e os respectivos parâmetros.
 */
function buildOwnershipMatch(emailNorm: string) {
  return { sql: `LOWER(TRIM(contactEmail)) = ?`, params: [emailNorm] };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const status = searchParams.get("status") ?? "todos";
  const limit  = 10;
  const offset = (page - 1) * limit;

  const emailNorm = session.user.email.trim().toLowerCase();

  try {
    await ensureSimulatorOrdersTable();
    const pool = await getPool();
    if (!pool) throw new Error("Pool não disponível");

    const match = buildOwnershipMatch(emailNorm);

    // ── Resumo (Visão Geral) — sempre sobre TODOS os pedidos do cliente ──────────
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS totalOrders,
         SUM(CASE WHEN status NOT IN ('concluido','cancelado','rejeitado') THEN 1 ELSE 0 END) AS activeOrders,
         MAX(createdAt) AS lastOrderDate
       FROM simulatorOrders
       WHERE ${match.sql}`,
      match.params,
    ) as [Array<{ totalOrders: number; activeOrders: number | null; lastOrderDate: string | null }>, unknown];

    const summary = {
      totalOrders:   Number(summaryRows[0]?.totalOrders ?? 0),
      activeOrders:  Number(summaryRows[0]?.activeOrders ?? 0),
      lastOrderDate: summaryRows[0]?.lastOrderDate ?? null,
    };

    // ── Lista paginada (respeita o filtro de estado) ─────────────────────────────
    const conditions = [match.sql];
    const params: unknown[] = [...match.params];
    if (status !== "todos") {
      conditions.push("status = ?");
      params.push(status);
    }
    const where = conditions.join(" AND ");

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM simulatorOrders WHERE ${where}`,
      params,
    ) as [Array<{ total: number }>, unknown];
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.execute(
      `SELECT
         o.id, o.serviceType, o.address, o.city, o.postalCode, o.status,
         o.estimateMin, o.estimateMax, o.estimateTotal,
         o.precoFinal, o.precoFinalIva,
         o.mensagemCliente, o.description,
         o.scheduledDate, o.scheduledStartTime,
         o.createdAt, o.updatedAt, o.confirmadoPeloCliente,
         o.canceladoPeloCliente,
         o.recurrenceFrequency, o.recurringDiscountPercent,
         o.clientRating, o.clientRatingComment,
         o.providerId, o.assignedToId, o.assignedToName,
         p.name AS providerName, p.phone AS providerPhone
       FROM simulatorOrders o
       LEFT JOIN providers p ON p.id = o.providerId
       WHERE ${where}
       ORDER BY o.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ) as [Array<Record<string, unknown>>, unknown];

    return NextResponse.json({
      orders: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary,
    });
  } catch (err) {
    console.error("[api/users/me/orders] GET:", err);
    return NextResponse.json({ error: "Erro ao carregar pedidos." }, { status: 500 });
  }
}
