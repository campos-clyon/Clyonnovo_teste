import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSimulatorOrderById } from "@/lib/db";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";

export const runtime = "nodejs";

/**
 * Localizar a morada de um pedido, a pedido de quem está a olhar para ele.
 *
 * O pedido #217 parecia completo no admin — morada, código postal, distância,
 * preço — e não tinha coordenadas nenhumas. A diferença é invisível no ecrã e
 * decide tudo na distribuição: com coordenadas conta o RAIO de cada
 * profissional; sem elas conta a lista de zonas escrita à mão, e "Penha de
 * frança" não estava na de ninguém. Quatro profissionais activos, zero
 * alcançados, e o pedido de volta à lista como se nunca tivesse sido enviado.
 *
 * Este endpoint usa exactamente o mesmo caminho da promoção
 * (`coordenadasDoPedido`): Google primeiro, Nominatim pela freguesia como
 * recurso, e grava no pedido. O que se vê ao carregar no botão é o que vai
 * acontecer quando se carregar em "Enviar aos profissionais".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    const r = await coordenadasDoPedido(pedido);
    if (r.lat == null || r.lng == null) {
      return NextResponse.json({
        ok: false,
        // O motivo vai por extenso: "REQUEST_DENIED" é a chave no Google
        // Cloud, "ZERO_RESULTS" é a morada. Confundi-los custou três pedidos
        // de teste a reescrever uma morada certa.
        motivo: r.motivo ?? "desconhecido",
      });
    }

    return NextResponse.json({
      ok: true,
      lat: r.lat,
      lng: r.lng,
      descobertasAgora: r.descobertasAgora,
    });
  } catch (error) {
    console.error("[admin/pedidos/localizar]", error);
    return NextResponse.json({ error: "Erro ao localizar" }, { status: 500 });
  }
}
