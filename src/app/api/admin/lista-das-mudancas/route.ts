import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { listaDeParceirosNasMudancasLigada, mudarListaDeParceirosNasMudancas } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «LISTA DE PARCEIROS NAS MUDANÇAS» — 10-11-2026 (fase 2).
 *
 * Ligado (por omissão): no fim de um pedido de mudança o cliente vê a lista
 * dos parceiros com preço e escolhe a quem pede orçamento, e o pedido vai logo
 * aos escolhidos. Desligado: as mudanças voltam ao caminho de antes (a Mesa).
 *
 * LER: quem tem as Configs (`requireAdmin`). MUDAR: só o administrador; quem
 * mudou e quando ficam na linha das Configs (`plataformaConfiguracoes.porQuem`).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  return NextResponse.json({ ligado: await listaDeParceirosNasMudancasLigada() });
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligado?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof corpo.ligado !== "boolean") {
    return NextResponse.json({ error: "Diga se fica ligado ou desligado." }, { status: 400 });
  }
  try {
    const ligado = await mudarListaDeParceirosNasMudancas(corpo.ligado, colab?.nome ?? "a CLYON");
    return NextResponse.json({ ok: true, ligado });
  } catch (error) {
    console.error("[admin/lista-das-mudancas PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
