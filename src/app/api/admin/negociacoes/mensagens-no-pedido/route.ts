import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { marcarMensagemNoPedidoResolvida, mensagensNoPedidoPorResponder } from "@/lib/mensagem-no-suporte-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS MENSAGENS NO PEDIDO POR RESPONDER — d140 (27-11-2026); d140b no mesmo dia
 * (dono). O cliente escreveu dentro do pedido (Suporte › «No pedido») e
 * ninguém respondeu depois (ou a Vitória passou à equipa). Já não entram no
 * «Precisa de si»: são um botão próprio na linha discreta da Mesa. Só da última
 * semana e de pedidos vivos. Só números de pedido, as datas e o motivo.
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

/** «Já está resolvido» — `{ pedidoId }`. Marca com quem e quando; a mensagem fica no pedido. */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = (await req.json().catch(() => null)) as { pedidoId?: unknown } | null;
  const pedidoId = Number(corpo?.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Falta o número do pedido." }, { status: 400 });
  }
  try {
    await marcarMensagemNoPedidoResolvida(pedidoId, { id: colab?.id ?? null, nome: colab?.nome ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/negociacoes/mensagens-no-pedido] resolver", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível marcar como resolvido." }, { status: 500 });
  }
}
