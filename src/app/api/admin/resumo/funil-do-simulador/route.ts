import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { toMySQLDateTime, withConnection } from "@/lib/db";
import { FORA_DAS_PAGINAS_DA_EQUIPA_SQL } from "@/lib/pagina-da-equipa";
import {
  EVENTO_DO_FUNIL,
  E_PAGO_SQL,
  PASSOS_DO_FUNIL,
  funilPorSemana,
  semanasDoFunil,
  type LinhaDoFunil,
} from "@/lib/funil-do-simulador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEMANAS = 6;

/**
 * O FUNIL DO SIMULADOR, NO INÍCIO — d56, 16-11-2026.
 *
 * Debaixo de /api/admin/resumo, como o desempenho: quem vê o Início vê isto.
 * As últimas 6 semanas (segunda a domingo, hora de Lisboa): entradas
 * (`simulator_start`) → passo 2 → passo 3 → enviados (`funil_simulador`),
 * cada uma dividida em pago e orgânico. Só contagens.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const semanas = semanasDoFunil(SEMANAS);
    // A semana de cada evento: 0 para esta, 1 para a anterior… (a base está em UTC).
    const casos = semanas.map((_, i) => `WHEN createdAt >= ? THEN ${i}`).join(" ");
    const desde = semanas.map((s) => toMySQLDateTime(s.desde));
    const linhas = await withConnection(async (conn) => {
      const [rows] = await conn.execute(
        `SELECT CASE ${casos} END AS semana,
                CASE WHEN eventType = 'simulator_start' THEN 'entradas' ELSE label END AS etapa,
                CASE WHEN ${E_PAGO_SQL} THEN 1 ELSE 0 END AS pago,
                COUNT(*) AS n
           FROM leadEvents
          WHERE createdAt >= ?
            AND (eventType = 'simulator_start'
                 OR (eventType = ? AND label IN (${PASSOS_DO_FUNIL.map(() => "?").join(", ")})))
            AND ${FORA_DAS_PAGINAS_DA_EQUIPA_SQL}
          GROUP BY semana, etapa, pago`,
        [...desde, desde[desde.length - 1], EVENTO_DO_FUNIL, ...PASSOS_DO_FUNIL],
      );
      return (Array.isArray(rows) ? rows : []) as LinhaDoFunil[];
    });
    return NextResponse.json(
      { semanas: funilPorSemana(linhas, semanas) },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    console.error("[admin/resumo/funil-do-simulador]", e);
    return NextResponse.json({ error: "Não foi possível carregar o funil do simulador." }, { status: 500 });
  }
}
