import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { withConnection, ensureLeadsExtended } from "@/lib/db";

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

// GET /api/admin/leads
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  // Garantir que a tabela leads existe (e tem todas as colunas) antes de qualquer query
  try {
    await ensureLeadsExtended();
  } catch (err) {
    console.error("[api/admin/leads] ensureLeadsExtended falhou:", err);
    // Continuar mesmo assim — a tabela pode já existir com as colunas necessárias
  }

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "30d";
    const status = searchParams.get("status") || "";
    const startDate = getPeriodStart(periodo);
    const hoje = new Date().toISOString().slice(0, 10);
    const semanaStart = getPeriodStart("semana");

    const conditions: string[] = ["createdAt >= ?"];
    const params: unknown[] = [startDate];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const { leads, totals } = await withConnection(async (conn) => {
      const [leadsRows] = await conn.execute(
        `SELECT id, nome, telefone, email, localidade, tipoServico, preferenciaContacto,
                mensagem, pagePath, utmSource, utmMedium, utmCampaign, gclid,
                origem, canal, status, notasInternas, createdAt
         FROM leads ${where}
         ORDER BY createdAt DESC
         LIMIT 200`,
        params,
      );

      const [totalsRows] = await conn.execute(
        `SELECT
          SUM(CASE WHEN DATE(createdAt) = ? THEN 1 ELSE 0 END) AS hoje,
          SUM(CASE WHEN createdAt >= ?        THEN 1 ELSE 0 END) AS semana,
          SUM(CASE WHEN status = 'novo'       THEN 1 ELSE 0 END) AS novos,
          SUM(CASE WHEN status = 'fechado'    THEN 1 ELSE 0 END) AS fechados,
          COUNT(*) AS total
         FROM leads`,
        [hoje, semanaStart],
      );

      return {
        leads: Array.isArray(leadsRows) ? leadsRows : [],
        totals: Array.isArray(totalsRows) ? (totalsRows as any[])[0] : {},
      };
    });

    return NextResponse.json({ leads, totals });
  } catch (error) {
    console.error("[api/admin/leads] GET error:", error);
    return NextResponse.json({ leads: [], totals: {}, error: "Erro ao carregar leads" }, { status: 500 });
  }
}

// PATCH /api/admin/leads
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id, status, notasInternas } = await request.json();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const validStatuses = ["novo", "contactado", "orcamento_enviado", "fechado", "perdido"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    await withConnection(async (conn) => {
      if (status !== undefined && notasInternas !== undefined) {
        await conn.execute("UPDATE leads SET status = ?, notasInternas = ? WHERE id = ?", [status, String(notasInternas), Number(id)]);
      } else if (status !== undefined) {
        await conn.execute("UPDATE leads SET status = ? WHERE id = ?", [status, Number(id)]);
      } else if (notasInternas !== undefined) {
        await conn.execute("UPDATE leads SET notasInternas = ? WHERE id = ?", [String(notasInternas), Number(id)]);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/admin/leads] PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
