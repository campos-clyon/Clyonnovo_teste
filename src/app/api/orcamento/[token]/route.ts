import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken, confirmarOrcamento, cancelarOrcamentoPeloCliente } from "@/lib/db";
import { notifyNewOrder } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/seo-data";

export const runtime = "nodejs";

// GET /api/orcamento/[token] — devolve dados públicos do pedido para a página do cliente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Só devolve dados necessários — nunca expõe notas internas nem dados de outros pedidos
  const o = order as any;
  return NextResponse.json({
    id:                    order.id,
    serviceType:           order.serviceType,
    address:               order.address,
    city:                  order.city,
    description:           order.description,
    precoFinalIva:         o.precoFinalIva,
    dataAgendada:          o.scheduledDate ?? o.dataAgendada ?? null,
    mensagemCliente:       o.mensagemCliente ?? null,
    status:                order.status,
    confirmadoPeloCliente: Boolean(o.confirmadoPeloCliente),
    confirmadoEm:          o.confirmadoEm ?? null,
    canceladoPeloCliente:  Boolean(o.canceladoPeloCliente),
  });
}

// POST /api/orcamento/[token] — { action: "confirmar" | "cancelar" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action === "confirmar") {
    const result = await confirmarOrcamento(token);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Notificar equipa via WhatsApp
    const order = await getOrderByToken(token);
    if (order) {
      const o = order as any;
      notifyNewOrder({
        id:              order.id,
        contactName:     order.contactName ?? null,
        serviceType:     order.serviceType ?? null,
        city:            order.city ?? null,
        address:         order.address ?? null,
        estimateWithVat: o.precoFinalIva?.toString() ?? null,
        backofficeUrl:   `${SITE_URL}/admin/pedidos/${order.id}`,
      });
    }
    return NextResponse.json({ ok: true, action: "confirmado" });
  }

  if (action === "cancelar") {
    const result = await cancelarOrcamentoPeloCliente(token);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Notificar equipa via WhatsApp
    const order = await getOrderByToken(token);
    if (order) {
      const o = order as any;
      const to = process.env.WHATSAPP_TO_NUMBER;
      if (to) {
        const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
        sendWhatsAppMessage({
          to,
          text: `*Cancelamento CLYON #${order.id}*\n\nO cliente ${order.contactName ?? "desconhecido"} cancelou o pedido na página de orçamento.\n\nVer: ${SITE_URL}/admin/pedidos/${order.id}`,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, action: "cancelado" });
  }

  return NextResponse.json({ error: "Acção inválida. Use 'confirmar' ou 'cancelar'." }, { status: 400 });
}
