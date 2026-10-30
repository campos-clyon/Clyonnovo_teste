import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { suportePorLerDaEquipa, suportesDosClientes } from "@/lib/conversas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/suporte/clientes — o separador «Suporte — clientes» (30-10-2026).
 *
 * As «Suporte CLYON» dos clientes que já escreveram, com as mensagens por ler
 * da equipa. `?so=contagem` dá só o número, para o selo do menu. Só a equipa
 * com a secção do Suporte (`requireAdmin`, prefixo /api/admin/suporte).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    if (req.nextUrl.searchParams.get("so") === "contagem") {
      return NextResponse.json({ porLer: await suportePorLerDaEquipa() }, { headers: { "Cache-Control": "no-store" } });
    }
    const conversas = await suportesDosClientes();
    return NextResponse.json(
      {
        conversas: conversas.map((c) => ({
          id: c.id,
          estado: c.estado,
          atendidaPor: c.atendidaPor,
          ultimaMensagemEm: c.ultimaMensagemEm,
          ultimaMensagem: c.ultimaMensagem ? c.ultimaMensagem.slice(0, 160) : null,
          porLer: c.porLer,
          clienteNome: c.clienteNome,
          clienteEmail: c.clienteEmail,
        })),
        porLer: conversas.reduce((s, c) => s + c.porLer, 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/suporte/clientes]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler as conversas." }, { status: 500 });
  }
}
