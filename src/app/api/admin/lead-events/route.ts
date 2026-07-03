import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { withConnection } from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const colaborador = await verifyColaboradorAuthHeader(request.headers.get("authorization"));
  if (!colaborador) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  if (!colaborador.isAdmin) return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  return { colaborador };
}

function getPeriodStart(periodo: string): string {
  const now = new Date();
  switch (periodo) {
    case "hoje":
      return `${now.toISOString().slice(0, 10)} 00:00:00`;
    case "semana": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const d = new Date(now);
      d.setDate(d.getDate() - diff);
      return `${d.toISOString().slice(0, 10)} 00:00:00`;
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return `${d.toISOString().slice(0, 10)} 00:00:00`;
    }
    default: {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return `${d.toISOString().slice(0, 10)} 00:00:00`;
    }
  }
}

// GET /api/admin/lead-events
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "7d";
    const eventType = searchParams.get("eventType") || "";
    const startDate = getPeriodStart(periodo);
    const hoje = new Date().toISOString().slice(0, 10);

    const conditions: string[] = ["createdAt >= ?"];
    const params: unknown[] = [startDate];
    if (eventType) {
      conditions.push("eventType = ?");
      params.push(eventType);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const { events, totals } = await withConnection(async (conn) => {
      const [eventsRows] = await conn.execute(
        `SELECT id, eventType, action, pagePath, label, phone, email, name,
                serviceType, location, contactPreference,
                utmSource, utmMedium, utmCampaign, createdAt
         FROM leadEvents ${where}
         ORDER BY createdAt DESC
         LIMIT 500`,
        params,
      );

      const semanaStart = (() => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const d = new Date(now);
        d.setDate(d.getDate() - diff);
        return `${d.toISOString().slice(0, 10)} 00:00:00`;
      })();

      const [totalsRows] = await conn.execute(
        `SELECT
          SUM(CASE WHEN eventType = 'click_whatsapp'        AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS whatsappHoje,
          SUM(CASE WHEN eventType = 'click_call'            AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS ligarHoje,
          SUM(CASE WHEN eventType LIKE 'click_cta%'         AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS ctaHoje,
          SUM(CASE WHEN eventType LIKE 'form_submit%'       AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS formHoje,
          SUM(CASE WHEN eventType = 'click_email'           AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS emailHoje,
          SUM(CASE WHEN eventType LIKE 'simulator_%'        AND DATE(createdAt) = ? THEN 1 ELSE 0 END) AS simuladorHoje,
          SUM(CASE WHEN eventType = 'click_whatsapp'        AND createdAt >= ?   THEN 1 ELSE 0 END) AS whatsappSemana,
          SUM(CASE WHEN eventType = 'click_call'            AND createdAt >= ?   THEN 1 ELSE 0 END) AS ligarSemana,
          SUM(CASE WHEN eventType LIKE 'click_cta%'         AND createdAt >= ?   THEN 1 ELSE 0 END) AS ctaSemana,
          SUM(CASE WHEN eventType LIKE 'form_submit%'       AND createdAt >= ?   THEN 1 ELSE 0 END) AS formSemana,
          SUM(CASE WHEN eventType = 'click_email'           AND createdAt >= ?   THEN 1 ELSE 0 END) AS emailSemana,
          SUM(CASE WHEN eventType LIKE 'simulator_%'        AND createdAt >= ?   THEN 1 ELSE 0 END) AS simuladorSemana,
          COUNT(*) AS total
         FROM leadEvents`,
        [hoje, hoje, hoje, hoje, hoje, hoje, semanaStart, semanaStart, semanaStart, semanaStart, semanaStart, semanaStart],
      );

      return {
        events: Array.isArray(eventsRows) ? eventsRows : [],
        totals: Array.isArray(totalsRows) ? (totalsRows as any[])[0] : {},
      };
    });

    return NextResponse.json({ events, totals });
  } catch (error) {
    console.error("[api/admin/lead-events] GET error:", error);
    return NextResponse.json({ events: [], totals: {}, error: "Erro ao carregar eventos" }, { status: 500 });
  }
}
