import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { comprovativoParaLer } from "@/lib/rasto-do-pagamento-na-base";
import { eDoBlobPublico } from "@/lib/faturas-do-trabalho-link";
import { tokenDoBlobDasFaturas } from "@/lib/faturas-do-trabalho-no-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ABRIR UM COMPROVATIVO DE PAGAMENTO — d66 (18-11-2026). Só a equipa (a
 * sessão do backoffice, com os Pagamentos, a Mesa ou as Carteiras). O
 * ficheiro passa pelo servidor: o endereço do armazenamento nunca sai daqui.
 * «Não existe» e «não pode ver» respondem igual (404).
 */
const NAO_ENCONTRADO = () => NextResponse.json({ error: "Comprovativo não encontrado." }, { status: 404 });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err.status === 403 ? NAO_ENCONTRADO() : err;
  const c = await comprovativoParaLer(Number((await ctx.params).id)).catch(() => null);
  if (!c) return NAO_ENCONTRADO();
  try {
    let corpo: ReadableStream<Uint8Array> | null = null;
    if (eDoBlobPublico(c.url)) {
      const r = await fetch(c.url, { cache: "no-store" });
      if (!r.ok || !r.body) return NAO_ENCONTRADO();
      corpo = r.body;
    } else {
      const token = tokenDoBlobDasFaturas();
      if (!token) {
        console.error("[comprovativos] comprovativo privado sem o token do armazenamento privado");
        return NextResponse.json({ error: "Não foi possível abrir o comprovativo." }, { status: 503 });
      }
      const r = await get(c.url, { access: "private", token });
      if (!r || r.statusCode !== 200 || !r.stream) return NAO_ENCONTRADO();
      corpo = r.stream;
    }
    return new NextResponse(corpo, {
      status: 200,
      headers: {
        // O tipo conferido ao subir, e não o que o armazenamento diga.
        "Content-Type": c.tipo || "application/octet-stream",
        "Content-Disposition": `inline; filename="${c.nome.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    console.error("[comprovativos]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível abrir o comprovativo." }, { status: 500 });
  }
}
