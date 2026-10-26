import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { withConnection, toMySQLDateTime } from "@/lib/db";
import { inicioDoPeriodoEmLisboa } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";

/*
 * Quem passa, confirmado na base em cada chamada (ver `conta-do-painel.ts`).
 *
 * 03-10-2026 — decisão do dono: um assistente com a secção Leads passa
 * a usar este ecrã. Por isso `requireAdmin` (o administrador, ou o
 * assistente com a secção — ver `SECCOES_QUE_ABREM` em `papel-do-painel.ts`)
 * e não `requireAdminGeral`, que era o que estava aqui.
 */
async function exigirAcesso(request: NextRequest, soAdministrador = false) {
  const { err, colab } = soAdministrador
    ? await requireAdminGeral(request)
    : await requireAdmin(request);
  if (err) return { error: err };
  return { colaborador: colab };
}

/*
 * «Hoje», «esta semana» e os últimos N dias começam à meia-noite de Lisboa
 * (26-10-2026), em UTC para a base. Antes era o dia em UTC (`toISOString`), e
 * a semana contava-se com `getDay()` no relógio do processo.
 */
function getPeriodStart(periodo: string): string {
  return toMySQLDateTime(inicioDoPeriodoEmLisboa(periodo));
}

// GET /api/admin/lead-events
export async function GET(request: NextRequest) {
  const auth = await exigirAcesso(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "7d";
    const eventType = searchParams.get("eventType") || "";
    const startDate = getPeriodStart(periodo);
    // Nada se grava no futuro: «desde a meia-noite de Lisboa» é o dia de hoje.
    const hoje = getPeriodStart("hoje");

    const conditions: string[] = ["createdAt >= ?"];
    const params: string[] = [startDate];
    if (eventType) {
      conditions.push("eventType = ?");
      params.push(eventType);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const { events, totals, paginas } = await withConnection(async (conn) => {
      const [eventsRows] = await conn.execute(
        `SELECT id, eventType, action, pagePath, label, phone, email, name,
                serviceType, location, contactPreference,
                utmSource, utmMedium, utmCampaign, createdAt
         FROM leadEvents ${where}
         ORDER BY createdAt DESC
         LIMIT 500`,
        params,
      );

      const semanaStart = getPeriodStart("semana");

      const [totalsRows] = await conn.execute(
        `SELECT
          SUM(CASE WHEN eventType = 'click_whatsapp'        AND createdAt >= ?      THEN 1 ELSE 0 END) AS whatsappHoje,
          SUM(CASE WHEN eventType = 'click_call'            AND createdAt >= ?      THEN 1 ELSE 0 END) AS ligarHoje,
          SUM(CASE WHEN eventType LIKE 'click_cta%'         AND createdAt >= ?      THEN 1 ELSE 0 END) AS ctaHoje,
          SUM(CASE WHEN eventType LIKE 'form_submit%'       AND createdAt >= ?      THEN 1 ELSE 0 END) AS formHoje,
          SUM(CASE WHEN eventType = 'click_email'           AND createdAt >= ?      THEN 1 ELSE 0 END) AS emailHoje,
          SUM(CASE WHEN eventType LIKE 'simulator_%'        AND createdAt >= ?      THEN 1 ELSE 0 END) AS simuladorHoje,
          SUM(CASE WHEN eventType = 'click_whatsapp'        AND createdAt >= ?   THEN 1 ELSE 0 END) AS whatsappSemana,
          SUM(CASE WHEN eventType = 'click_call'            AND createdAt >= ?   THEN 1 ELSE 0 END) AS ligarSemana,
          SUM(CASE WHEN eventType LIKE 'click_cta%'         AND createdAt >= ?   THEN 1 ELSE 0 END) AS ctaSemana,
          SUM(CASE WHEN eventType LIKE 'form_submit%'       AND createdAt >= ?   THEN 1 ELSE 0 END) AS formSemana,
          SUM(CASE WHEN eventType = 'click_email'           AND createdAt >= ?   THEN 1 ELSE 0 END) AS emailSemana,
          SUM(CASE WHEN eventType LIKE 'simulator_%'        AND createdAt >= ?   THEN 1 ELSE 0 END) AS simuladorSemana,
          SUM(CASE WHEN eventType = 'page_view'             AND createdAt >= ?      THEN 1 ELSE 0 END) AS paginasHoje,
          SUM(CASE WHEN eventType = 'page_view'             AND createdAt >= ?   THEN 1 ELSE 0 END) AS paginasSemana,
          COUNT(*) AS total
         FROM leadEvents`,
        [hoje, hoje, hoje, hoje, hoje, hoje, semanaStart, semanaStart, semanaStart, semanaStart, semanaStart, semanaStart, hoje, semanaStart],
      );

      // De que páginas vem o tráfego — a pergunta que o cartão sozinho não
      // responde. Só a semana, e só o top: é o que cabe num ecrã.
      const [paginasRows] = await conn.execute(
        `SELECT pagePath, COUNT(*) AS visitas
           FROM leadEvents
          WHERE eventType = 'page_view' AND createdAt >= ? AND pagePath IS NOT NULL
          GROUP BY pagePath
          ORDER BY visitas DESC
          LIMIT 15`,
        [semanaStart],
      );

      return {
        events: Array.isArray(eventsRows) ? eventsRows : [],
        totals: Array.isArray(totalsRows) ? (totalsRows as any[])[0] : {},
        paginas: Array.isArray(paginasRows) ? paginasRows : [],
      };
    });

    return NextResponse.json({ events, totals, paginas });
  } catch (error) {
    console.error("[api/admin/lead-events] GET error:", error);
    return NextResponse.json({ events: [], totals: {}, error: "Erro ao carregar eventos" }, { status: 500 });
  }
}
