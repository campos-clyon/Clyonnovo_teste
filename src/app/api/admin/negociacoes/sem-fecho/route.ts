import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { trabalhosSemFechoParaAMesa } from "@/lib/fecho-do-modelo-novo-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O FECHO DO MODELO NOVO NA MESA — d15, 13-11-2026. Os contratados do modelo de
 * 15-11 com a data passada há mais de 24 h e sem «Está feito» — todos, e não só
 * os 60 pedidos que a Mesa carrega. O cartão «Do nosso lado» faz deles uma
 * linha (`linhasDoFecho`). Só leitura. Antes de 15-11 devolve a lista vazia.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ trabalhos: await trabalhosSemFechoParaAMesa() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/negociacoes/sem-fecho]", e instanceof Error ? e.message : e);
    return NextResponse.json({ trabalhos: [], error: "Não foi possível ler." }, { status: 500 });
  }
}
