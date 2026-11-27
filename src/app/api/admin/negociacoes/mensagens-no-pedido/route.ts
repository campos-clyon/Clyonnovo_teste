import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { mensagensNoPedidoPorResponder } from "@/lib/mensagem-no-suporte-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS MENSAGENS NO PEDIDO POR RESPONDER — d140 (27-11-2026). O cliente escreveu
 * dentro do pedido (Suporte › «No pedido») e ninguém respondeu (ou a Vitória
 * passou à equipa): a Mesa põe-nos em «Precisa de si», com «Mensagem no pedido
 * por responder há N». Só leitura; só números de pedido, a data e o motivo.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ pedidos: await mensagensNoPedidoPorResponder() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/negociacoes/mensagens-no-pedido]", e instanceof Error ? e.message : e);
    return NextResponse.json({ pedidos: [], error: "Não foi possível ler." }, { status: 500 });
  }
}
