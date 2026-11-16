import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { withConnection } from "@/lib/db";
import { EVENTO_DA_FALHA_DA_IA, contagemDasFalhas } from "@/lib/falhas-da-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS FALHAS DA ANÁLISE COM IA, NO INÍCIO — d59, 16-11-2026.
 *
 * Quantas vezes, nos últimos 7 e 30 dias, a análise com o modelo caiu na
 * estimativa local (sem resposta a tempo, erro, sem chave, resposta ilegível).
 * Só contagens, por motivo — os eventos não guardam dados de pessoas.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const [semana, mes] = await withConnection(async (conn) => {
      const contar = async (dias: number) => {
        const [rows] = await conn.execute(
          `SELECT label AS motivo, COUNT(*) AS n
             FROM leadEvents
            WHERE eventType = ? AND createdAt >= NOW() - INTERVAL ${dias} DAY
            GROUP BY label`,
          [EVENTO_DA_FALHA_DA_IA],
        );
        return contagemDasFalhas((Array.isArray(rows) ? rows : []) as Array<{ motivo: unknown; n: unknown }>);
      };
      return [await contar(7), await contar(30)];
    });
    return NextResponse.json({ semana, mes }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    console.error("[admin/resumo/falhas-da-ia]", e);
    return NextResponse.json({ error: "Não foi possível contar as falhas da IA." }, { status: 500 });
  }
}
