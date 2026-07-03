import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptionsCliente } from "@/auth-cliente";
import { getPool, ensureSimulatorOrdersTable } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const emailNorm = session.user.email.trim().toLowerCase();

  try {
    await ensureSimulatorOrdersTable();
    const pool = await getPool();
    if (!pool) throw new Error("Pool não disponível");

    // Ligação por email (normalizado) — fallback por telefone desactivado até que a coluna exista
    const where = `LOWER(TRIM(contactEmail)) = ?`;
    const params: unknown[] = [emailNorm];

    const [rows] = await pool.execute(
      `SELECT
         id, serviceType, address, city, status, estimateTotal, precoFinal,
         precoFinalIva, mensagemCliente, createdAt, scheduledDate,
         scheduledStartTime, scheduledEndTime
       FROM simulatorOrders
       WHERE ${where}
       ORDER BY createdAt DESC
       LIMIT 50`,
      params,
    ) as [Array<Record<string, unknown>>, unknown];

    return NextResponse.json({ pedidos: rows });
  } catch (err) {
    console.error("[api/conta/pedidos] Erro:", err);
    return NextResponse.json({ error: "Erro ao carregar pedidos." }, { status: 500 });
  }
}
