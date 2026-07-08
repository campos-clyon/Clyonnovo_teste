import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSimulatorOrdersTable } from "@/lib/db";
import { sendWeeklyDigestEmail, type DigestOrder } from "@/lib/email-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/weekly-digest
 * Envia o resumo semanal aos clientes com notifWeeklyDigest=1 que tenham pedidos activos.
 *
 * Protegido por CRON_SECRET: o Vercel Cron envia automaticamente
 * `Authorization: Bearer ${CRON_SECRET}` quando a env var existe.
 * Configurar o agendamento em vercel.json.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível" }, { status: 503 });

  // Estados considerados "activos" (não terminais).
  const INACTIVE = ["concluido", "cancelado", "rejeitado", "arquivado"];

  const [users] = (await pool.execute(
    "SELECT name, email FROM users WHERE notifWeeklyDigest = 1 AND deletedAt IS NULL",
  )) as [Array<{ name: string | null; email: string }>, unknown];

  let sent = 0;
  let skipped = 0;

  for (const u of users) {
    const [orders] = (await pool.execute(
      `SELECT id, serviceType, status
         FROM simulatorOrders
        WHERE LOWER(TRIM(contactEmail)) = LOWER(TRIM(?))
          AND status NOT IN (${INACTIVE.map(() => "?").join(", ")})
        ORDER BY createdAt DESC`,
      [u.email, ...INACTIVE],
    )) as [DigestOrder[], unknown];

    if (orders.length === 0) {
      skipped++;
      continue;
    }

    const ok = await sendWeeklyDigestEmail({
      to: u.email,
      clienteName: u.name,
      orders,
    });
    if (ok) sent++;
    else skipped++;
  }

  return NextResponse.json({ ok: true, candidates: users.length, sent, skipped });
}
