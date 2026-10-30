import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { quemPedeAConversa } from "@/lib/quem-pede-a-conversa";
import { conversasDoCliente, conversasDoProfissional, suporteDoCliente } from "@/lib/conversas-na-base";
import { vistaDaConversa } from "@/lib/conversas-da-clyon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/conversas — as conversas de quem pede (30-10-2026, fase 1).
 *
 * Cliente: a «Suporte CLYON» (criada ao primeiro uso, uma por conta) e as
 * dos pedidos dele. Parceiro: as dele. Só a pessoa da sessão; nada do
 * endereço escolhe de quem são. Sem contas, nomes nem ids do outro lado.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conversas-lista", 120, 300);
  if (limite.erro) return limite.erro;
  try {
    const quem = await quemPedeAConversa(req);
    if (!quem) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (quem.papel === "cliente") await suporteDoCliente(quem.contaId);
    const lista =
      quem.papel === "cliente" ? await conversasDoCliente(quem.contaId) : await conversasDoProfissional(quem.providerId);
    return NextResponse.json(
      {
        ok: true,
        conversas: lista.map((c) => ({
          ...vistaDaConversa(c),
          porLer: c.porLer,
          ultimaMensagem: c.ultimaMensagem ? c.ultimaMensagem.slice(0, 160) : null,
        })),
      },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (err) {
    console.error("[conversas]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível abrir as conversas." }, { status: 500 });
  }
}
