import { NextRequest, NextResponse } from "next/server";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
} from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

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
  // Administrador, ou assistente com a conta activa. Arquivar é a acção
  // normal do dia a dia dos dois — o que o assistente não faz é apagar.
  const { err, colab: jwt } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const orderId = Number(id);

  const order = await getSimulatorOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
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
    by: { id: jwt.id, nome: jwt.nome, role: jwt.papel },
    message: `Pedido arquivado por ${jwt.nome}.`,
  });

  const updated = await getSimulatorOrderById(orderId);

  return NextResponse.json({ ok: true, order: updated });
}
