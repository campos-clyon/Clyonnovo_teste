import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { diasPedidos } from "@/lib/o-que-a-vitoria-fez";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O QUE A VITÓRIA FEZ — d102 (CEO e dono, 24-11-2026). Só leitura, só do
 * administrador, como o resto do painel «Rotinas».
 *
 * As últimas 24 h e, com `?dias=7` (1 a 7), dia a dia em hora de Lisboa: para
 * cada rotina, quantas passagens, quantas a vermelho e a soma de cada número
 * do `detalhe` de `passagensDasRotinas`. Só números — nunca nomes, telefones
 * nem as linhas do detalhe. Nada aqui escreve na base.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const dias = diasPedidos(req.nextUrl.searchParams.get("dias"));
    const { lerOQueAVitoriaFez } = await import("@/lib/o-que-a-vitoria-fez-na-base");
    return NextResponse.json(await lerOQueAVitoriaFez(new Date(), dias));
  } catch (e) {
    console.error("[admin/rotinas/o-que-a-vitoria-fez GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível somar as passagens das rotinas." }, { status: 500 });
  }
}
