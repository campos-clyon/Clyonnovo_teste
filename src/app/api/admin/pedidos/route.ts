import { NextRequest, NextResponse } from "next/server";
import {
  getAllSimulatorOrders,
  getSimulatorOrdersByAssistant,
  updateSimulatorOrder,
  deleteSimulatorOrder,
  countSimulatorOrdersByStatus,
  getSimulatorOrderById,
  getEffectiveRole,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

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

/**
 * Verifica autenticação e retorna o colaborador.
 * Admin geral (isAdmin=1) e assistentes (funcao='assistente') podem aceder.
 * Motoristas/ajudantes são explicitamente bloqueados.
 */
async function requireAdminOrAssistant(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };

  // Admin geral passa sempre
  if (colab.isAdmin === 1) return { err: null, colab };

  // Assistente passa (funcao no JWT, ou fallback: deixar entrar com scoping)
  const funcao = colab.funcao ?? "";
  if (funcao === "assistente") return { err: null, colab };

  // Motorista/ajudante/admin sem isAdmin=1 — bloqueado
  return {
    err: NextResponse.json({ error: "Acesso negado. Esta área é restrita a administradores e assistentes." }, { status: 403 }),
    colab: null,
  };
}

// GET /api/admin/pedidos?status=pendente&search=foo
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdminOrAssistant(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const isAdmin = colab!.isAdmin === 1;

  if (isAdmin) {
    // Admin vê todos os pedidos
    const [orders, counts] = await Promise.all([
      getAllSimulatorOrders({ status: status !== "todos" ? status : undefined, search }),
      countSimulatorOrdersByStatus(),
    ]);
    return NextResponse.json({ orders: sanitizeOrders(orders), counts, role: "admin_geral" });
  } else {
    // Assistente vê pedidos atribuídos a si + pedidos da fila geral (assignedToId IS NULL)
    const orders = await getSimulatorOrdersByAssistant(colab!.id);

    // Filtrar por status e pesquisa.
    // "sem_assistente" não é um status real — é uma vista sobre assignedToId IS NULL.
    const filtered = orders.filter((o) => {
      if (status && status !== "todos") {
        if (status === "sem_assistente") {
          if (o.assignedToId !== null && o.assignedToId !== undefined) return false;
        } else {
          if (o.status !== status) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        if (
          !(o.contactName ?? "").toLowerCase().includes(s) &&
          !(o.contactPhone ?? "").toLowerCase().includes(s) &&
          !(o.address ?? "").toLowerCase().includes(s) &&
          !(o.description ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });

    // Contagens correctas: baseadas em TODOS os pedidos visíveis (sem filtro de status)
    const allVisible = orders; // lista completa (apenas filtro de pesquisa pode ter sido aplicado)
    const counts: Record<string, number> = {};
    for (const o of allVisible) counts[o.status] = (counts[o.status] ?? 0) + 1;
    counts["total"] = allVisible.length;
    // "pendente" = novos não visualizados
    counts["pendente"] = allVisible.filter((o) => !o.viewedAt).length;
    // "sem_assistente" = na fila geral
    counts["sem_assistente"] = allVisible.filter((o) => !o.assignedToId).length;

    return NextResponse.json({ orders: sanitizeOrders(filtered), counts, role: "assistente" });
  }
}

// PATCH /api/admin/pedidos  — { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdminOrAssistant(req);
  if (err) return err;

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verificar permissão por pedido se não for admin
  if (!colab!.isAdmin) {
    const order = await getSimulatorOrderById(Number(id));
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

    const isAssignedToMe = order.assignedToId === colab!.id;
    const isUnassigned = !order.assignedToId; // fila geral — qualquer assistente pode aceitar
    const isAccepting =
      fields.assignedToId === colab!.id && fields.status === "atribuido";

    if (!isAssignedToMe && !isUnassigned) {
      return NextResponse.json({ error: "Sem permissão para editar este pedido" }, { status: 403 });
    }

    // Assistente só pode reatribuir a si mesmo (ao aceitar da fila geral)
    if (fields.assignedToId && fields.assignedToId !== colab!.id) {
      return NextResponse.json({ error: "Não pode atribuir pedido a outro assistente" }, { status: 403 });
    }

    // Assistente não pode alterar status livremente — apenas ao aceitar
    if (fields.status && !isAccepting) {
      delete fields.status;
    }
  }

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
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!colab.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await deleteSimulatorOrder(Number(id));
  return NextResponse.json({ ok: true });
}
