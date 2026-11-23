import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { anexarFotosPendentesAoPedido, pendentesComPedidoAberto } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS FOTOGRAFIAS DO WHATSAPP QUE FICARAM À ESPERA COM O PEDIDO JÁ FEITO —
 * recuperação da d98 (23-11-2026).
 *
 * Até à d98, uma fotografia mandada a meio de uma conversa ficava à espera do
 * pedido mesmo quando o pedido já existia, e quem acabava o pedido no site ou
 * no formulário da página inicial nunca a via entrar. Esta rota junta-as.
 *
 * GET: quantas são — números de pedido e contagens, sem telefones nem nomes.
 * POST { confirmacao: "JUNTAR" }: junta as de cada número ao pedido aberto mais
 * recente desse número criado nos últimos 7 dias (a mesma junção atómica da
 * conversa, com a linha no histórico de cada pedido).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const lista = await pendentesComPedidoAberto();
    return NextResponse.json({
      pedidos: lista.length,
      fotografias: lista.reduce((t, l) => t + l.fotografias, 0),
      porPedido: lista.map((l) => ({ pedido: l.pedidoId, fotografias: l.fotografias })),
    });
  } catch (e) {
    console.error("[admin/fotografias-do-whatsapp] GET", e);
    return NextResponse.json({ error: "Não foi possível contar as fotografias." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { confirmacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (String(corpo.confirmacao ?? "").trim().toUpperCase() !== "JUNTAR") {
    return NextResponse.json({ error: "Para juntar, escreva JUNTAR." }, { status: 400 });
  }
  try {
    const lista = await pendentesComPedidoAberto();
    const porPedido: Array<{ pedido: number; fotografias: number }> = [];
    let falharam = 0;
    for (const l of lista) {
      const n = await anexarFotosPendentesAoPedido(l.telefone, l.pedidoId).catch((e) => {
        console.error(`[admin/fotografias-do-whatsapp] pedido #${l.pedidoId}:`, e);
        falharam++;
        return 0;
      });
      if (n > 0) porPedido.push({ pedido: l.pedidoId, fotografias: n });
    }
    const juntas = porPedido.reduce((t, l) => t + l.fotografias, 0);
    console.info(
      `[admin/fotografias-do-whatsapp] ${colab?.nome ?? "administrador"} juntou ${juntas} fotografia(s) a ${porPedido.length} pedido(s)`,
    );
    return NextResponse.json({ ok: true, juntas, pedidos: porPedido.length, porPedido, falharam });
  } catch (e) {
    console.error("[admin/fotografias-do-whatsapp] POST", e);
    return NextResponse.json({ error: "Não foi possível juntar as fotografias." }, { status: 500 });
  }
}
