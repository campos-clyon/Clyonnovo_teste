import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { pedidosSemPropostasNaMesa } from "@/lib/sem-propostas-ao-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS PEDIDOS SEM PROPOSTAS NA MESA — d102 (a), 24-11-2026. Os pedidos que
 * seguiram para os parceiros há mais de 24 h sem nenhuma proposta, ou que
 * ficaram «sem parceiros na zona» — todos os dos últimos 30 dias, e não só os
 * 60 que a Mesa carrega. O cartão «Do nosso lado» faz deles uma linha, com o
 * motivo e o que a Vitória já disse ao cliente. Só leitura; só números de pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ pedidos: await pedidosSemPropostasNaMesa() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/negociacoes/sem-propostas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ pedidos: [], error: "Não foi possível ler." }, { status: 500 });
  }
}
