import { NextRequest, NextResponse } from "next/server";
import { getSimulatorOrderById } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import {
  isMudancaType,
  getMovingAddresses,
  generateOperationalSummary,
  buildStructuredDescription,
  buildFullCalendarDescription,
} from "@/lib/calendar-helpers";

export const runtime = "nodejs";

// GET /api/admin/pedidos/[id]/calendar/preview
// Returns the full calendar description (Gemini summary + structured data)
// that will be sent to Google Calendar. Used by the modal to pre-fill
// the editable description textarea before the user confirms scheduling.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // ⚠️ Isto verificava apenas que existia um token válido, e mais nada.
  //
  // A resposta traz a descrição completa do pedido — nome, telefone, email,
  // morada, andar, elevador e observações do cliente. Com um id na barra do
  // endereço e um token de qualquer conta, dava para percorrer 1, 2, 3… e
  // recolher os dados pessoais de todos os clientes.
  //
  // A rota irmã, GET /api/admin/pedidos/[id], já bloqueava motoristas e
  // ajudantes e limitava o assistente aos pedidos dele. Esta devolve o mesmo
  // conteúdo e não fazia nem uma coisa nem outra.
  if (colab.isAdmin !== 1 && colab.funcao !== "assistente") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getSimulatorOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  // O assistente vê os pedidos dele e os da fila geral — a mesma regra da
  // rota irmã. Sem isto, um assistente lia a ficha de qualquer cliente.
  const semAssistente = !order.assignedToId;
  if (colab.isAdmin !== 1 && order.assignedToId !== colab.id && !semAssistente) {
    return NextResponse.json({ error: "Sem permissão para ver este pedido." }, { status: 403 });
  }

  let operationalSummary = "";
  let geminiUsed = false;
  try {
    operationalSummary = await generateOperationalSummary(order as Record<string, any>);
    geminiUsed = true;
  } catch (e: any) {
    console.error("[calendar/preview] Gemini failed, using fallback:", e?.message);
  }

  const structuredPart = buildStructuredDescription(order as Record<string, any>, null, orderId);
  const calendarDescription = buildFullCalendarDescription(operationalSummary, structuredPart);

  const isMov = isMudancaType(order.serviceType);
  const { originAddress, destinationAddress } = isMov
    ? getMovingAddresses(order as Record<string, any>)
    : { originAddress: "", destinationAddress: "" };

  return NextResponse.json({
    ok: true,
    calendarDescription,
    geminiUsed,
    isMov,
    originAddress,
    destinationAddress,
  });
}
