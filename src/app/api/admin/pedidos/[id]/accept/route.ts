import { NextRequest, NextResponse } from "next/server";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
  getColaboradorById,
  getPool,
  toMySQLDateTime,
} from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/accept
 *
 * Aceitar um pedido da fila geral — administrador ou assistente.
 * Regras:
 *   - Sessão do backoffice obrigatória (`requireAdmin` decide quem entra e,
 *     no caso do assistente, confirma que a conta continua activa).
 *   - O pedido deve estar sem responsável ou já atribuído ao mesmo colaborador.
 *   - Se outra pessoa já aceitou, devolve 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { err, colab: jwt } = await requireAdmin(req);
  if (err) return err;

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

  // Quem chegou aqui passou pelo `requireAdmin`: administrador, ou assistente
  // com a conta activa. Não há uma segunda verificação de papel de propósito —
  // aceitar pedidos é trabalho dos dois.

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
    by: { id: colab.id, nome: colab.nome, role: jwt.papel },
    message: `Pedido aceite por ${colab.nome}. Status alterado para "Atribuído".`,
  });

  const updated = await getSimulatorOrderById(orderId);

  return NextResponse.json({
    ok: true,
    message: "Pedido aceite com sucesso.",
    order: updated,
  });
}
