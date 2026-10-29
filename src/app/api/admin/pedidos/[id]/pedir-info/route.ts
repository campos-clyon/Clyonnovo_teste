import { NextRequest, NextResponse } from "next/server";
import { getSimulatorOrderById } from "@/lib/db";
import { pedirMaisDetalhes } from "@/lib/conversa-com-a-clyon";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/pedir-info
 * Body: { message: string }
 *
 * Permite ao admin enviar uma mensagem de pedido de informação ao
 * cliente. Marca o pedido como
 * "precisa_info" e guarda a mensagem em mensagemCliente para aparecer
 * na conta do cliente.
 *
 * Desde 29-10-2026 (S18) pela mesma função das outras portas
 * (`conversa-com-a-clyon.ts`): a mensagem inteira, e o aviso ao cliente —
 * na app e por email a quem tem conta, por WhatsApp a quem não tem email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { err, colab: jwt } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const orderId = Number(id);
  // Um assistente que pede informação num pedido sem responsável fica com ele.
  await assumirPedidoSeLivre(orderId, jwt);

  const body = await req.json();
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });

  const order = await getSimulatorOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  try {
    await pedirMaisDetalhes(orderId, message, { id: jwt.id, nome: jwt.nome, role: jwt.papel });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao guardar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  const updated = await getSimulatorOrderById(orderId);
  return NextResponse.json({ ok: true, order: updated });
}
