import { NextRequest, NextResponse } from "next/server";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/pedir-info
 * Body: { message: string }
 *
 * Permite a admin ou assistente (mesmo sem ter aceite o pedido) enviar
 * uma mensagem de pedido de informação ao cliente. Marca o pedido como
 * "precisa_info" e guarda a mensagem em mensagemCliente para aparecer
 * na conta do cliente.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!jwt) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const isAdmin = Number(jwt.isAdmin) === 1;
  const isAssistente = jwt.funcao === "assistente";
  if (!isAdmin && !isAssistente) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number(id);

  const body = await req.json();
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });

  const order = await getSimulatorOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  try {
    await updateSimulatorOrder(orderId, {
      status: "precisa_info",
      mensagemCliente: message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao guardar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  await appendOrderHistory(orderId, {
    type: "info_requested",
    by: { id: jwt.id, nome: jwt.nome, role: jwt.funcao ?? "assistente" },
    message: `Pedido de informação enviado ao cliente: "${message.slice(0, 200)}${message.length > 200 ? "…" : ""}"`,
  });

  const updated = await getSimulatorOrderById(orderId);
  return NextResponse.json({ ok: true, order: updated });
}
