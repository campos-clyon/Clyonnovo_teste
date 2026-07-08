import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  createSimulatorOrder,
  getSimulatorOrderById,
  appendOrderHistory,
  calculateOrderPriority,
} from "@/lib/db";
import type { InsertSimulatorOrder } from "../../../../../drizzle/schema";
import { notifyNewOrder } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/seo-data";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { order, estimate, chatHistory } = await req.json();
    if (!order) {
      return NextResponse.json({ error: "order required" }, { status: 400 });
    }

    // ── Ligação à conta do cliente ────────────────────────────────────────────
    // Se existir uma sessão de cliente autenticada, o pedido fica SEMPRE ligado
    // ao email dessa conta (normalizado), garantindo que aparece em "Os meus
    // pedidos". Caso contrário, usamos o email indicado no formulário.
    // O email do formulário fica sempre preservado dentro de rawOrderJson.
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;
    const formEmail = order.receiver?.email?.trim().toLowerCase() ?? null;
    const contactEmail = sessionEmail ?? formEmail;

    const priority = calculateOrderPriority({
      urgency: order.urgency,
      description: order.description,
      estimateTotal: estimate?.estimatedPriceWithVat?.toString() ?? null,
    });

    // ── Marcação recorrente: aplica desconto à estimativa guardada ────────────
    // Semanal = 15%, quinzenal = 10%. O assistente vê o valor já com desconto
    // e as notas internas explicam a razão, antes de definir o precoFinal.
    const recurrenceFrequency: "semanal" | "quinzenal" | null =
      order.recurrenceFrequency === "semanal" || order.recurrenceFrequency === "quinzenal"
        ? order.recurrenceFrequency
        : null;
    const recurringDiscountPercent = recurrenceFrequency === "semanal" ? 15 : recurrenceFrequency === "quinzenal" ? 10 : null;
    const applyDiscount = (value: number | null | undefined) =>
      value != null && recurringDiscountPercent != null
        ? Math.round(value * (1 - recurringDiscountPercent / 100) * 100) / 100
        : (value ?? null);

    // ── Sem atribuição automática ─────────────────────────────────────────────
    // Pedidos entram sempre na fila geral. Uma assistente deve aceitar
    // manualmente via POST /api/admin/pedidos/[id]/accept.

    const row: InsertSimulatorOrder = {
      serviceType: order.serviceType || null,
      description: order.description || null,
      filesJson: order.files?.length
        ? JSON.stringify(
            order.files.map((f: Record<string, unknown>) => ({
              id: f.id, name: f.name, size: f.size, type: f.type, mimeType: f.mimeType,
            }))
          )
        : null,
      // Morada principal: para mudança guardamos a origem; para outros o endereço único
      address:
        order.serviceType === "mudanca"
          ? (order.originAddress?.formattedAddress ?? order.address?.formattedAddress ?? null)
          : (order.address?.formattedAddress ?? null),
      city: order.city || order.address?.city || order.originAddress?.city || null,
      // postalCode: não existe como coluna separada na DB — guardado em rawOrderJson
      floor: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.floor ?? order.floor)
          : order.floor;
        return v || null;
      })(),
      // Converter "" para null — alguns clientes submetem string vazia quando não preenchido
      hasElevator: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.hasElevator ?? order.hasElevator)
          : order.hasElevator;
        return v || null;
      })(),
      parkingDistance: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.parkingDistance ?? order.parkingDistance)
          : order.parkingDistance;
        return v || null;
      })(),
      contactName: order.receiver?.name ?? session?.user?.name ?? null,
      contactPhone: order.receiver?.phone ?? null,
      // Prioridade: email da conta autenticada → email do formulário
      contactEmail,
      urgency: order.urgency || null,
      estimateMin: applyDiscount(estimate?.estimatedPriceWithoutVat)?.toString() ?? null,
      estimateMax: applyDiscount(estimate?.estimatedPriceWithVat)?.toString() ?? null,
      estimateTotal: applyDiscount(estimate?.estimatedPriceWithVat)?.toString() ?? null,
      estimateJson: estimate ? JSON.stringify(estimate) : null,
      recurrenceFrequency,
      recurringDiscountPercent: recurringDiscountPercent != null ? recurringDiscountPercent.toFixed(2) : null,
      // Guardar análise completa incluindo externalMarketEstimate, analysisSource e confidence
      // Este campo é APENAS para uso interno no backoffice — nunca exposto ao cliente
      analysisJsonExtended: estimate
        ? JSON.stringify({
            analysisSource: estimate.analysisSource ?? null,
            confidence: estimate.confidence ?? null,
            clyonEstimate: {
              status: estimate.status,
              estimatedPriceWithoutVat: estimate.estimatedPriceWithoutVat,
              vatAmount: estimate.vatAmount,
              estimatedPriceWithVat: estimate.estimatedPriceWithVat,
              difficultyLevel: estimate.difficultyLevel,
              summary: estimate.summary,
              assumptions: estimate.assumptions,
              missingFields: estimate.missingFields,
              internalNotes: estimate.internalNotes,
              labor: estimate.labor ?? null,
            },
            externalMarketEstimate: estimate.externalMarketEstimate ?? null,
            savedAt: new Date().toISOString(),
          })
        : null,
      // Distância guardada (km): mudança usa origem→destino; restantes usam base→morada.
      distanceKm: (order.movingDistance?.distanceKm ?? order.distanceFromBase?.distanceKm)?.toString() ?? null,
      // distanceText passa a guardar um resumo legível "X km · Y min" (antes só o tempo).
      distanceText: (() => {
        const src = order.movingDistance?.distanceKm ? order.movingDistance : order.distanceFromBase;
        const km = src?.distanceKm;
        if (!km) return null;
        const kmStr = `${String(km).replace(".", ",")} km`;
        return src?.durationText ? `${kmStr} · ${src.durationText}` : kmStr;
      })(),
      chatJson: chatHistory ? JSON.stringify(chatHistory) : null,
      priority,
      // Sempre sem assistente — fluxo de aceitação manual obrigatório
      status: "sem_assistente",
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      // Guardar todo o JSON do formulário para preservar dados de mudança
      // (originAddress, destinationAddress, originAccess, destinationAccess, movingDistance, heavyItems, etc.)
      rawOrderJson: JSON.stringify(order),
    };

    const id = await createSimulatorOrder(row);

    // Confirmação de escrita
    const created = await getSimulatorOrderById(id);
    if (!created) {
      console.error("[v0] POST /api/simulador/pedido: pedido #", id, " não encontrado após INSERT");
      return NextResponse.json(
        { ok: false, error: `Pedido #${id} não encontrado após criação.` },
        { status: 500 }
      );
    }

    // Histórico
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message: `Pedido criado via simulador. Fila geral (sem assistente). Serviço: ${order.serviceType ?? "—"}. Prioridade: ${priority}.`
        + (recurrenceFrequency ? ` Marcação recorrente (${recurrenceFrequency}, desconto de ${recurringDiscountPercent}% já aplicado à estimativa).` : ""),
    });

    // Notificação WhatsApp — assíncrona, não bloqueia a resposta ao cliente.
    // Se falhar, o pedido já está guardado e o erro apenas fica no log.
    notifyNewOrder({
      id,
      contactName:     row.contactName ?? null,
      serviceType:     row.serviceType ?? null,
      city:            row.city ?? null,
      address:         row.address ?? null,
      estimateWithVat: row.estimateMax ?? row.estimateTotal ?? null,
      backofficeUrl:   `${SITE_URL}/admin/pedidos/${id}`,
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      status: created.status,
      priority: created.priority,
      assignedToId: null,
      assignedToName: null,
      createdAt: created.createdAt,
      queue: "general",
      message: "Pedido enviado com sucesso. A equipa CLYON irá analisar e uma assistente aceitará o pedido em breve.",
    });
  } catch (err: any) {
    console.error("[v0] POST /api/simulador/pedido: erro:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
