import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { arquivoDoPedido } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Um arquivo, para ler ou descarregar.
 *
 * Sai como JSON com `Content-Disposition: attachment`, para o browser o gravar
 * com um nome que diz o que é — `pedido-317.json` — em vez de o abrir numa
 * página de texto que ninguém consegue guardar.
 *
 * `?ver=1` devolve o mesmo sem o cabeçalho de descarga, para o ecrã o poder
 * mostrar sem obrigar a gravar primeiro.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  try {
    const arquivo = await arquivoDoPedido(id);
    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }

    const paraVer = new URL(req.url).searchParams.get("ver") === "1";
    return new NextResponse(arquivo.dados, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...(paraVer
          ? {}
          : {
              "Content-Disposition": `attachment; filename="pedido-${arquivo.pedidoId}.json"`,
            }),
      },
    });
  } catch (e) {
    console.error("[admin/arquivo/id]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler o arquivo." }, { status: 500 });
  }
}
