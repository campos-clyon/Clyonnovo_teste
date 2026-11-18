import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { registosDasNegociacoes } from "@/lib/rasto-do-pagamento-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O RASTO DO DINHEIRO DE UM TRABALHO — d66 (18-11-2026). De onde veio cada
 * pagamento e os comprovativos, para o cartão do pedido (Mesa / Trabalho
 * CLYON). Só lê. A equipa com os Pagamentos, a Mesa ou as Carteiras.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  try {
    const mapa = await registosDasNegociacoes([negociacaoId]);
    return NextResponse.json({ registos: mapa.get(negociacaoId) ?? [] });
  } catch (e) {
    console.error("[admin/pagamentos/rasto]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler os pagamentos deste trabalho." }, { status: 500 });
  }
}
