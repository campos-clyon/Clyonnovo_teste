import { NextRequest, NextResponse } from "next/server";
import {
  getAllSimulatorOrders,
  updateSimulatorOrder,
  deleteSimulatorOrder,
  TrabalhoEmCurso,
  countSimulatorOrdersByStatus,
  getSimulatorOrderById,
} from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

function sanitizeOrders(orders: any[]): any[] {
  return orders.map((o) => {
    const safe: Record<string, unknown> = { ...o };
    for (const k of Object.keys(safe)) {
      const v = safe[k];
      if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
        safe[k] = typeof v.toString === "function" && v.toString() !== "[object Object]"
          ? v.toString()
          : JSON.stringify(v);
      }
    }
    return safe;
  });
}

// GET /api/admin/pedidos?status=pendente&search=foo
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  // Havia aqui um segundo ramo, para o assistente, que devolvia só os pedidos
  // dele mais os da fila geral. Sem a função de assistente, quem entra vê tudo.
  const [orders, counts] = await Promise.all([
    getAllSimulatorOrders({ status: status !== "todos" ? status : undefined, search }),
    countSimulatorOrdersByStatus(),
  ]);
  return NextResponse.json({ orders: sanitizeOrders(orders), counts, role: "admin_geral" });
}

// PATCH /api/admin/pedidos  — { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updateData: Record<string, unknown> = { ...fields };
  if (updateData.dataAgendada && typeof updateData.dataAgendada === "string") {
    updateData.dataAgendada = new Date(updateData.dataAgendada);
  }

  await updateSimulatorOrder(Number(id), updateData as Parameters<typeof updateSimulatorOrder>[1]);
  const order = await getSimulatorOrderById(Number(id));
  return NextResponse.json({ ok: true, order });
}

// DELETE /api/admin/pedidos?id=123  — apenas admin geral
export async function DELETE(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await deleteSimulatorOrder(Number(id), {
      motivo: searchParams.get("motivo")?.slice(0, 120) || "apagado no backoffice",
      autorNome: colab?.nome ?? null,
    });
  } catch (e) {
    // 409 e nao 500: nada correu mal: a base recusou-se, e tem razao. O texto
    // do erro nomeia o profissional e o valor, para haver o que fazer a
    // seguir em vez de so uma porta fechada.
    if (e instanceof TrabalhoEmCurso) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
