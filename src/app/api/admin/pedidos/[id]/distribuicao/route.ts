import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { distribuicaoDoPedido } from "@/lib/distribuicao-do-pedido";

export const runtime = "nodejs";

/**
 * A quem este pedido chegou, e a quem não chegou — com o motivo.
 *
 * Serve o separador "Distribuição" do detalhe do pedido. A lista por
 * profissional saiu dos cartões do painel (com mil profissionais era uma
 * parede); quem quer saber abre o pedido e vê aqui os dois lados.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const r = await distribuicaoDoPedido(pedidoId);
    if (!r) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    return NextResponse.json(r);
  } catch (error) {
    console.error("[admin/pedidos/distribuicao]", error);
    return NextResponse.json({ error: "Erro ao avaliar a distribuição" }, { status: 500 });
  }
}
