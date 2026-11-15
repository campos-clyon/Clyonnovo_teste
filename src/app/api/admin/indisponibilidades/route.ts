import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { cruzamentosDoPedido } from "@/lib/indisponibilidades-na-base";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QUEM ESTÁ INDISPONÍVEL NO DIA DESTE PEDIDO — d35, 15-11-2026. Para o
 * «Atribuir directamente a…» e para a lista de quem recebeu o pedido. Só
 * informa: no backoffice a indisponibilidade nunca bloqueia.
 *
 * GET ?pedidoId=N → { porProfissional: { "<providerId>": { estado, texto, periodos } } }
 * `estado` é «indisponivel» (data certa dentro do período) ou «nota» (cruza, mas não bloquearia).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const pedidoId = Number(req.nextUrl.searchParams.get("pedidoId"));
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
  try {
    const [linhas] = (await pool.execute(
      "SELECT id FROM providers WHERE isActive = 1 AND estado = 'aprovado' LIMIT 2000",
    )) as [Array<{ id: number }>, unknown];
    const mapa = await cruzamentosDoPedido(
      pedidoId,
      linhas.map((l) => Number(l.id)),
    );
    const porProfissional: Record<string, { estado: string; texto: string; periodos: string[] }> = {};
    for (const [id, c] of mapa) {
      if (c.estado !== "livre") porProfissional[String(id)] = { estado: c.estado, texto: c.texto, periodos: c.periodos };
    }
    return NextResponse.json({ porProfissional });
  } catch (e) {
    console.error("[api/admin/indisponibilidades]", e);
    return NextResponse.json({ error: "Não foi possível ler as indisponibilidades." }, { status: 500 });
  }
}
