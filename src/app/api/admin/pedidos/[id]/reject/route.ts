import { NextRequest, NextResponse } from "next/server";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/reject
 *
 * Arquiva um pedido — passa o status a "arquivado" e liberta a
 * atribuição. Deixa de aparecer na vista "Todos" do backoffice;
 * fica disponível no filtro "Arquivados".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);

  const order = await getSimulatorOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const isAdmin = Number(jwt.isAdmin) === 1;

  if (!isAdmin && order.assignedToId !== jwt.id) {
    return NextResponse.json({ error: "Sem permissão para rejeitar este pedido." }, { status: 403 });
  }

  try {
    await updateSimulatorOrder(orderId, {
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      status: "arquivado",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao rejeitar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  await appendOrderHistory(orderId, {
    type: "archived",
    by: { id: jwt.id, nome: jwt.nome, role: jwt.funcao ?? "assistente" },
    message: `Pedido arquivado por ${jwt.nome}.`,
  });

  const updated = await getSimulatorOrderById(orderId);

  return NextResponse.json({ ok: true, order: updated });
}
