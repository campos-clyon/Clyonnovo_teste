import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSimulatorOrdersTable } from "@/lib/db";
import { sendWeeklyDigestEmail, type DigestOrder } from "@/lib/email-digest";
import { bearerConfere } from "@/lib/segredo-igual";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";

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
  // Falha fechada. Estava `if (secret)`: sem CRON_SECRET definido, a rota
  // ficava aberta a qualquer pessoa — e esta envia emails a clientes reais.
  // Uma configuração em falta não pode transformar-se em porta aberta.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/weekly-digest] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // Em tempo constante — ver segredo-igual.ts.
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  /*
   * CADA PASSAGEM CARIMBADA — 27-10-2026 (d7). Não tinha try/catch nem
   * registo: um 500 ficava só na consola da Vercel, e um email que o Resend
   * recusava contava como «skipped», igual a quem não tinha pedidos. Agora
   * as recusas contam à parte e uma só que seja faz a passagem «falhou».
   */
  try {
    const r = await carimbarPassagem(
      "weekly-digest",
      async () => {
        await ensureSimulatorOrdersTable();
        const pool = await getPool();
        if (!pool) throw new Error("DB indisponível");

        // Estados considerados "activos" (não terminais).
        const INACTIVE = ["concluido", "cancelado", "rejeitado", "arquivado"];

        const [users] = (await pool.execute(
          "SELECT name, email FROM users WHERE notifWeeklyDigest = 1 AND deletedAt IS NULL",
        )) as [Array<{ name: string | null; email: string }>, unknown];

        let sent = 0;
        let skipped = 0;
        let recusados = 0;

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
          else recusados++;
        }
        return { candidates: users.length, sent, skipped, recusados };
      },
      (d) => ({
        ok: d.recusados === 0,
        motivo: d.recusados > 0 ? `${d.recusados} email(s) recusado(s) — ver RESEND_API_KEY_clyonsite e o Resend` : null,
        detalhe: d,
      }),
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/weekly-digest]", error);
    return NextResponse.json({ error: "Erro no resumo semanal" }, { status: 500 });
  }
}
