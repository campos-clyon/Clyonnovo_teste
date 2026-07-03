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

  const { id } = await params;
  const orderId = Number(id);
  const order = await getSimulatorOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

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
