import { NextRequest, NextResponse } from "next/server";

import { ensureSimulatorOrdersTable, withConnection } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const dynamic = "force-dynamic";

const APPROVED_STATUSES = ["aprovado", "confirmado", "em_execucao", "concluido"];
const ALLOWED_PERIODS = new Set(["semana", "mes", "personalizado"]);

function getPeriodBounds(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === "personalizado" && from && to) {
    return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59`) };
  }
  if (period === "semana") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function toSQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isValidDateInput(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()));
}

export async function GET(request: NextRequest) {
  try {
    const colaborador = await verifyColaboradorAuthHeader(request.headers.get("authorization"));
    if (!colaborador) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (Number(colaborador.isAdmin) !== 1) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "mes";
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    if (!ALLOWED_PERIODS.has(period)) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    if (period === "personalizado" && (!isValidDateInput(from) || !isValidDateInput(to) || from! > to!)) {
      return NextResponse.json({ error: "Indique um intervalo de datas válido." }, { status: 400 });
    }

    await ensureSimulatorOrdersTable();
    const { start, end } = getPeriodBounds(period, from, to);
    const startSQL = toSQL(start);
    const endSQL = toSQL(end);
    const approvedPlaceholders = APPROVED_STATUSES.map(() => "?").join(", ");
    const approvedParams = [...APPROVED_STATUSES];

    const data = await withConnection(async (connection) => {
      const [[totals]] = await connection.query<any>(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status IN (${approvedPlaceholders}) THEN 1 ELSE 0 END), 0) AS aprovados,
           COALESCE(SUM(
             CASE WHEN status IN (${approvedPlaceholders}) THEN
               CAST(COALESCE(
                 NULLIF(precoFinalIva, ''),
                 NULLIF(precoFinal, ''),
                 NULLIF(estimateTotal, ''),
                 NULLIF(estimateMin, ''),
                 '0'
               ) AS DECIMAL(12, 2))
             ELSE 0 END
           ), 0) AS receitaTotal
         FROM simulatorOrders
         WHERE createdAt BETWEEN ? AND ?`,
        [...approvedParams, ...approvedParams, startSQL, endSQL],
      ) as any;

      const [serviceRows] = await connection.query<any>(
        `SELECT serviceType, COUNT(*) AS total
         FROM simulatorOrders
         WHERE createdAt BETWEEN ? AND ?
           AND serviceType IS NOT NULL AND serviceType != ''
         GROUP BY serviceType
         ORDER BY total DESC`,
        [startSQL, endSQL],
      ) as any;

      const [localityRows] = await connection.query<any>(
        `SELECT COALESCE(NULLIF(city, ''), 'Não informado') AS zona, COUNT(*) AS total
         FROM simulatorOrders
         WHERE createdAt BETWEEN ? AND ?
         GROUP BY zona
         ORDER BY total DESC
         LIMIT 10`,
        [startSQL, endSQL],
      ) as any;

      const [weeklyRows] = await connection.query<any>(
        `SELECT
           YEARWEEK(createdAt, 1) AS semana,
           MIN(DATE(createdAt)) AS semanaInicio,
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status IN (${approvedPlaceholders}) THEN 1 ELSE 0 END), 0) AS aprovados
         FROM simulatorOrders
         WHERE createdAt BETWEEN ? AND ?
         GROUP BY semana
         ORDER BY semana ASC`,
        [...approvedParams, startSQL, endSQL],
      ) as any;

      const [historyRows] = await connection.query<any>(
        `SELECT historyJson, createdAt
         FROM simulatorOrders
         WHERE createdAt BETWEEN ? AND ?
           AND historyJson IS NOT NULL AND historyJson != '' AND historyJson != '[]'`,
        [startSQL, endSQL],
      ) as any;

      let totalMinutes = 0;
      let responsesWithTime = 0;
      for (const row of historyRows) {
        try {
          const history = JSON.parse(row.historyJson ?? "[]");
          if (!Array.isArray(history) || history.length === 0) continue;
          const firstResponse = history.find((entry: { createdAt?: string; by?: unknown }) => entry.createdAt && entry.by);
          if (!firstResponse?.createdAt) continue;

          const createdAt = new Date(row.createdAt).getTime();
          const respondedAt = new Date(firstResponse.createdAt).getTime();
          const differenceMinutes = (respondedAt - createdAt) / 60_000;
          if (differenceMinutes > 0 && differenceMinutes < 60 * 24 * 30) {
            totalMinutes += differenceMinutes;
            responsesWithTime += 1;
          }
        } catch {
          // Ignorar registos históricos malformados sem comprometer as restantes métricas.
        }
      }

      const totalPedidos = Number(totals?.total ?? 0);
      const totalAprovados = Number(totals?.aprovados ?? 0);
      return {
        periodo: { start: start.toISOString(), end: end.toISOString() },
        resumo: {
          totalPedidos,
          totalAprovados,
          taxaAprovacao: totalPedidos > 0 ? Math.round((totalAprovados / totalPedidos) * 100) : 0,
          receitaTotal: Math.round(Number(totals?.receitaTotal ?? 0) * 100) / 100,
          tempoMedioMin: responsesWithTime > 0 ? Math.round(totalMinutes / responsesWithTime) : null,
        },
        porServico: serviceRows.map((row: { serviceType: string; total: number | string }) => ({
          serviceType: row.serviceType,
          total: Number(row.total),
        })),
        porLocalidade: localityRows.map((row: { zona: string; total: number | string }) => ({
          zona: row.zona,
          total: Number(row.total),
        })),
        semanal: weeklyRows.map((row: { semanaInicio: string; total: number | string; aprovados: number | string }) => ({
          semana: row.semanaInicio,
          total: Number(row.total),
          aprovados: Number(row.aprovados ?? 0),
        })),
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/admin/metricas] erro:", error);
    return NextResponse.json({ error: "Não foi possível carregar as métricas." }, { status: 500 });
  }
}
