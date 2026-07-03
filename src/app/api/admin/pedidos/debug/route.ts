import { NextRequest, NextResponse } from "next/server";
import {
  getAllSimulatorOrders,
  getActiveAssistants,
  countActiveOrdersByAssistant,
  getSimulatorOrdersByAssistant,
  getPool,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/pedidos/debug
 * Acessível apenas a admin (isAdmin=1).
 * Devolve informação de diagnóstico sobre os últimos pedidos,
 * assistentes activas e o que cada assistente vê na sua lista.
 */
export async function GET(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab || colab.isAdmin !== 1) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const [allOrders, assistants, orderCounts] = await Promise.all([
      getAllSimulatorOrders(),
      getActiveAssistants(),
      countActiveOrdersByAssistant(), // era chamado sem await — corrigido
    ]);

    const last10 = allOrders.slice(0, 10);

    // Para cada assistente activa, simular o que ela veria
    const assistantViews: Record<string, unknown>[] = [];
    for (const a of assistants) {
      const visible = await getSimulatorOrdersByAssistant(a.id);
      assistantViews.push({
        id: a.id,
        nome: a.nome,
        visibleOrderCount: visible.length,
        visibleOrderIds: visible.map((o) => o.id),
        last5: visible.slice(0, 5).map((o) => ({
          id: o.id,
          status: o.status,
          assignedToId: o.assignedToId,
          assignedToName: o.assignedToName,
          contactName: o.contactName,
          createdAt: o.createdAt,
        })),
      });
    }

    // Contadores globais por status
    const statusCounts: Record<string, number> = {};
    for (const o of allOrders) {
      statusCounts[o.status ?? "?"] = (statusCounts[o.status ?? "?"] ?? 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalOrders: allOrders.length,
        activeAssistants: assistants.length,
        statusCounts,
        ordersWithNoAssistant: allOrders.filter((o) => !o.assignedToId).length,
        ordersAtribuido: allOrders.filter((o) => o.status === "atribuido").length,
        ordersPendente: allOrders.filter((o) => o.status === "pendente").length,
        ordersSemAssistente: allOrders.filter((o) => o.status === "sem_assistente").length,
      },
      // Últimos 10 pedidos — os dados mais importantes para o teste
      last10Orders: last10.map((o) => ({
        id: o.id,
        contactName: o.contactName,
        serviceType: o.serviceType,
        status: o.status,
        assignedToId: o.assignedToId,
        assignedToName: o.assignedToName,
        createdAt: o.createdAt,
      })),
      // Assistentes activas e o que cada uma vê
      assistantViews,
      // Contadores de pedidos activos por assistente (para load-balance)
      activeOrderCountsByAssistant: orderCounts,
    });
  } catch (err: any) {
    console.error("[v0] DEBUG /api/admin/pedidos/debug:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
