import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { ensureRegistoTable, getPool, levantamentosDoProfissional } from "@/lib/db";
import {
  ACONTECIMENTOS_DO_HISTORICO_DO_PROFISSIONAL,
  historicoDoDinheiro,
} from "@/lib/pagamento-da-divida";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O HISTÓRICO DO DINHEIRO DE UM PROFISSIONAL — 01-11-2026 (dono).
 *
 * GET ?profissional=<id> — as duas direcções, com quem e quando: o que a CLYON
 * lhe transferiu, o que ele pagou à CLYON (à mão ou abatido), o cliente a
 * pagar-lhe em mão, e o acerto de 01-11-2026. Ver `historicoDoDinheiro`.
 *
 * SÓ LÊ. Aberta a quem tem as Carteiras, como a lista.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const providerId = Number(new URL(req.url).searchParams.get("profissional"));
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Profissional não indicado." }, { status: 400 });
  }

  try {
    await ensureRegistoTable();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

    const lista = ACONTECIMENTOS_DO_HISTORICO_DO_PROFISSIONAL.map(() => "?").join(", ");
    const [[registo], levantamentos] = await Promise.all([
      /*
       * Pelo profissional, OU pelas negociações dele: o «pago ao profissional»
       * um a um nunca levou o `providerId` na linha.
       */
      pool.execute(
        `SELECT acontecimento, ocorridoEm, autorNome, resumo, pedidoId, valor, detalheJson
           FROM registoPermanente
          WHERE acontecimento IN (${lista})
            AND (providerId = ?
                 OR negociacaoId IN (SELECT id FROM negociacoes WHERE providerId = ?))
          ORDER BY ocorridoEm DESC
          LIMIT 300`,
        [...ACONTECIMENTOS_DO_HISTORICO_DO_PROFISSIONAL, providerId, providerId],
      ) as Promise<[Array<Record<string, unknown>>, unknown]>,
      levantamentosDoProfissional(providerId),
    ]);

    return NextResponse.json({
      providerId,
      entradas: historicoDoDinheiro(levantamentos as never, registo),
    });
  } catch (e) {
    console.error("[admin/carteiras/historico]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível ler o histórico.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
