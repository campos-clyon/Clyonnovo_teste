import { NextRequest, NextResponse } from "next/server";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
  getColaboradorById,
  getPool,
  toMySQLDateTime,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/accept
 *
 * Permite a uma assistente aceitar um pedido da fila geral.
 * Regras:
 *   - JWT válido obrigatório.
 *   - Colaborador tem de ser assistente activo OU admin.
 *   - O pedido deve estar sem assistente ou já atribuído ao mesmo colaborador.
 *   - Se outro assistente já aceitou, devolve 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);

  const [order, colabFromDb] = await Promise.all([
    getSimulatorOrderById(orderId),
    getColaboradorById(jwt.id),
  ]);

  if (!order) {
    return NextResponse.json({ ok: false, message: "Pedido não encontrado." }, { status: 404 });
  }

  // Usar dados da DB se disponíveis; caso contrário usar JWT como fallback
  const colab = colabFromDb ?? {
    id: jwt.id,
    nome: jwt.nome,
    isAdmin: jwt.isAdmin ?? 0,
    active: 1 as number | null,
  };

  // Só administradores entram no backoffice — as funções de assistente,
  // motorista e ajudante deixaram de existir. Toda a lógica que distinguia
  // "assistente activo" de "admin" desapareceu com elas.
  if (Number(colab.isAdmin) !== 1) {
    return NextResponse.json(
      { ok: false, message: "Sem permissão para aceitar pedidos." },
      { status: 403 }
    );
  }

  // Pedido já tomado por outra pessoa da administração
  if (order.assignedToId && order.assignedToId !== colab.id) {
    return NextResponse.json(
      { ok: false, message: `Este pedido já foi aceite por ${order.assignedToName ?? "outra pessoa"}.` },
      { status: 409 }
    );
  }

  // Formato MySQL DATETIME: 'YYYY-MM-DD HH:mm:ss'
  const nowMySQL = toMySQLDateTime();

  try {
    await updateSimulatorOrder(orderId, {
      assignedToId: colab.id,
      assignedToName: colab.nome,
      assignedAt: nowMySQL as unknown as null,
      status: "atribuido",
      acceptedAt: nowMySQL,
    });
  } catch (updateErr) {
    return NextResponse.json(
      { ok: false, message: `Erro ao actualizar pedido: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}` },
      { status: 500 }
    );
  }

  await appendOrderHistory(orderId, {
    type: "accepted",
    by: { id: colab.id, nome: colab.nome, role: "admin" },
    message: `Pedido aceite por ${colab.nome}. Status alterado para "Atribuído".`,
  });

  const updated = await getSimulatorOrderById(orderId);

  return NextResponse.json({
    ok: true,
    message: "Pedido aceite com sucesso.",
    order: updated,
  });
}
