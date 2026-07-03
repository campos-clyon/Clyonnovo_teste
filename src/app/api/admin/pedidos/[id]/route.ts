import { NextRequest, NextResponse } from "next/server";
import { getSimulatorOrderById, updateSimulatorOrder, markOrderAsViewed, deleteSimulatorOrder } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

async function authenticate(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };

  // Admin geral passa sempre; assistente passa; motorista/ajudante são bloqueados
  if (colab.isAdmin !== 1 && colab.funcao !== "assistente") {
    return {
      err: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
      colab: null,
    };
  }

  return { err: null, colab };
}

// GET /api/admin/pedidos/[id]
// Admin vê qualquer pedido; assistente vê apenas os seus.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await authenticate(req);
  if (err) return err;
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Assistente pode ver: (1) pedidos atribuídos a si, (2) pedidos da fila geral (sem assistente)
  const isUnassigned = !order.assignedToId;
  if (!colab!.isAdmin && order.assignedToId !== colab!.id && !isUnassigned) {
    return NextResponse.json({ error: "Sem permissão para ver este pedido" }, { status: 403 });
  }

  // Mark as viewed when opened (if not already viewed)
  if (order.viewedAt === null || order.viewedAt === undefined) {
    await markOrderAsViewed(Number(id)).catch(() => {});
  }

  return NextResponse.json({ order });
}

// PATCH /api/admin/pedidos/[id]
// Admin pode alterar qualquer campo; assistente só pode alterar campos permitidos dos seus pedidos.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await authenticate(req);
  if (err) return err;
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Assistente pode editar: pedidos atribuídos a si. Pedidos da fila geral são editados
  // apenas via /accept — aqui bloqueamos para evitar race conditions.
  if (!colab!.isAdmin && order.assignedToId !== colab!.id) {
    return NextResponse.json({ error: "Sem permissão para editar este pedido. Use o botão 'Aceitar' primeiro." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body JSON inválido." }, { status: 400 });
  }

  // Assistente não pode alterar atribuição nem aprovar
  if (!colab!.isAdmin) {
    delete body.assignedToId;
    delete body.assignedToName;
    delete body.assignedAt;
    delete body.precoFinal;
    delete body.precoFinalIva;
    // Assistente pode marcar como em_analise ou precisa_info
    const allowedStatuses = ["em_analise", "precisa_info"];
    if (body.status && !allowedStatuses.includes(body.status as string)) {
      delete body.status;
    }
  }

  try {
    await updateSimulatorOrder(Number(id), body as Parameters<typeof updateSimulatorOrder>[1]);
  } catch (err: any) {
    console.error("[v0] PATCH /api/admin/pedidos/[id] updateSimulatorOrder error:", err?.message);
    return NextResponse.json(
      { ok: false, message: "Não foi possível atualizar o pedido. " + (err?.message ?? "") },
      { status: 500 }
    );
  }

  const updated = await getSimulatorOrderById(Number(id));
  return NextResponse.json({ ok: true, order: updated, message: "Pedido atualizado com sucesso." });
}

// DELETE /api/admin/pedidos/[id]
// Apenas admin geral pode excluir pedidos.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await authenticate(req);
  if (err) return err;
  if (colab!.isAdmin !== 1) {
    return NextResponse.json({ error: "Apenas administradores podem excluir pedidos." }, { status: 403 });
  }
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  await deleteSimulatorOrder(Number(id));
  return NextResponse.json({ ok: true, message: "Pedido excluído com sucesso." });
}
