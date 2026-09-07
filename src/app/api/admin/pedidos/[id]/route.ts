import { NextRequest, NextResponse } from "next/server";
import { getSimulatorOrderById, updateSimulatorOrder, markOrderAsViewed, deleteSimulatorOrder, TrabalhoEmCurso } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

// Administrador, ou assistente com a conta activa. O DELETE, mais abaixo,
// volta a perguntar pelo papel: apagar é só do administrador.
async function authenticate(req: NextRequest) {
  return requireAdmin(req);
}

// GET /api/admin/pedidos/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await authenticate(req);
  if (err) return err;
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Mark as viewed when opened (if not already viewed)
  if (order.viewedAt === null || order.viewedAt === undefined) {
    await markOrderAsViewed(Number(id)).catch(() => {});
  }

  return NextResponse.json({ order });
}

// PATCH /api/admin/pedidos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await authenticate(req);
  if (err) return err;
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body JSON inválido." }, { status: 400 });
  }

  // Ao tomar um pedido sem enviar assignedAt, preenche agora
  if (body.assignedToId != null && !body.assignedAt) {
    body.assignedAt = new Date().toISOString();
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
  if (colab!.papel !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem excluir pedidos." }, { status: 403 });
  }
  const { id } = await params;

  const order = await getSimulatorOrderById(Number(id));
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  try {
    await deleteSimulatorOrder(Number(id), {
      motivo: "apagado no backoffice",
      autorNome: colab!.nome ?? null,
    });
  } catch (e) {
    if (e instanceof TrabalhoEmCurso) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, message: "Pedido excluído com sucesso." });
}
