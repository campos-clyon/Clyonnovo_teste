import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper: date boundaries
function getPeriodBounds(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === "personalizado" && from && to) {
    return { start: new Date(from + "T00:00:00"), end: new Date(to + "T23:59:59") };
  }
  if (period === "semana") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // segunda-feira
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // mes (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function toSQL(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "mes";
    const from   = searchParams.get("from") ?? undefined;
    const to     = searchParams.get("to")   ?? undefined;

    const { start, end } = getPeriodBounds(period, from, to);
    const startSQL = toSQL(start);
    const endSQL   = toSQL(end);

    const data = await withConnection(async (conn) => {
      // 1 — Totais base do período
      const [[totals]] = await conn.query<any>(`
        SELECT
          COUNT(*) AS total,
          SUM(status IN ('aprovado','confirmado','em_execucao','concluido')) AS aprovados,
          SUM(CAST(COALESCE(NULLIF(precoFinalIva,''), NULLIF(estimateMin,''), '0') AS DECIMAL(10,2)))
            FILTER_NOTA AS receitaTotal
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
      `, [startSQL, endSQL]) as any;

      // 2 — Receita dos aprovados (precoFinalIva ou estimateMin)
      const [receitaRows] = await conn.query<any>(`
        SELECT COALESCE(NULLIF(precoFinalIva,''), NULLIF(estimateMin,''), '0') AS preco
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
          AND status IN ('aprovado','confirmado','em_execucao','concluido')
      `, [startSQL, endSQL]) as any;

      const receitaTotal = receitaRows.reduce((sum: number, r: any) => {
        const v = parseFloat(r.preco ?? "0");
        return sum + (isNaN(v) ? 0 : v);
      }, 0);

      // 3 — Por tipo de serviço
      const [servicoRows] = await conn.query<any>(`
        SELECT serviceType, COUNT(*) AS total
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
          AND serviceType IS NOT NULL AND serviceType != ''
        GROUP BY serviceType
        ORDER BY total DESC
      `, [startSQL, endSQL]) as any;

      // 4 — Por localidade
      const [localidadeRows] = await conn.query<any>(`
        SELECT COALESCE(NULLIF(city,''), 'Não informado') AS zona, COUNT(*) AS total
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
        GROUP BY zona
        ORDER BY total DESC
        LIMIT 10
      `, [startSQL, endSQL]) as any;

      // 5 — Pedidos por semana dentro do período (para gráfico de barras)
      const [semanalRows] = await conn.query<any>(`
        SELECT
          YEARWEEK(createdAt, 1) AS semana,
          MIN(DATE(createdAt)) AS semanaInicio,
          COUNT(*) AS total,
          SUM(status IN ('aprovado','confirmado','em_execucao','concluido')) AS aprovados
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
        GROUP BY semana
        ORDER BY semana ASC
      `, [startSQL, endSQL]) as any;

      // 6 — Tempo médio de resposta (primeira acção no historyJson)
      const [historyRows] = await conn.query<any>(`
        SELECT historyJson, createdAt
        FROM simulator_orders
        WHERE createdAt BETWEEN ? AND ?
          AND historyJson IS NOT NULL AND historyJson != '' AND historyJson != '[]'
      `, [startSQL, endSQL]) as any;

      let somaMinutos = 0;
      let countComResposta = 0;
      for (const row of historyRows) {
        try {
          const hist = JSON.parse(row.historyJson ?? "[]");
          if (!Array.isArray(hist) || hist.length === 0) continue;
          // primeira entrada que tenha createdAt (acção da equipa)
          const primeira = hist.find((h: any) => h.createdAt && h.by);
          if (!primeira) continue;
          const criado    = new Date(row.createdAt).getTime();
          const respondido = new Date(primeira.createdAt).getTime();
          const diffMin   = (respondido - criado) / 60000;
          if (diffMin > 0 && diffMin < 60 * 24 * 30) { // ignorar outliers >30 dias
            somaMinutos += diffMin;
            countComResposta++;
          }
        } catch { /* ignorar */ }
      }
      const tempoMedioMin = countComResposta > 0 ? Math.round(somaMinutos / countComResposta) : null;

      // 7 — Total aprovados para taxa
      const totalPedidos  = Number(totals?.total ?? 0);
      const totalAprovados = receitaRows.length;
      const taxaAprovacao  = totalPedidos > 0 ? Math.round((totalAprovados / totalPedidos) * 100) : 0;

      return {
        periodo: { start: start.toISOString(), end: end.toISOString() },
        resumo: {
          totalPedidos,
          totalAprovados,
          taxaAprovacao,
          receitaTotal: Math.round(receitaTotal * 100) / 100,
          tempoMedioMin,
        },
        porServico:    servicoRows,
        porLocalidade: localidadeRows,
        semanal:       semanalRows.map((r: any) => ({
          semana:    r.semanaInicio,
          total:     Number(r.total),
          aprovados: Number(r.aprovados ?? 0),
        })),
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[metricas] erro:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}
