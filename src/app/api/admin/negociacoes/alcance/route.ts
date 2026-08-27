import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSimulatorOrderById } from "@/lib/db";
import { avaliarAlcance, porqueFicaramDeFora } from "@/lib/distribuir-pedido";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";

export const runtime = "nodejs";

/**
 * A quem é que este pedido chega, e porque é que os outros ficam de fora.
 *
 * "Por qual motivo esse pedido foi enviado apenas para 1 parceiro?"
 *
 * A mesa dizia «1 profissional · 1 proposta» e mais nada. A resposta existia —
 * a regra que decidiu está escrita e é determinística — mas só se chegava lá
 * correndo-a à mão contra a base de dados, que foi o que eu tive de fazer para
 * lhe responder.
 *
 * PORQUE É QUE ISTO É UMA ROTA À PARTE, e não vem na lista
 *
 * Porque calcular o alcance é medir a distância de cada profissional a cada
 * pedido, e a lista tem dezenas de pedidos. Fazê-lo para todos, sempre, para
 * uma pergunta que se faz uma vez por semana, seria pagar caro por informação
 * que quase ninguém pediu naquele instante.
 *
 * Aqui responde-se a um pedido de cada vez, quando alguém pergunta.
 *
 * E RESPONDE COM A REGRA DE HOJE, não com a de quando o pedido saiu. É de
 * propósito: quem faz esta pergunta quer saber o que tem conserto agora — se
 * aprovar aquele profissional, ou se lhe pedir a fatura, o pedido passa a
 * chegar-lhe. O histórico do envio guarda o que aconteceu na altura.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const pedidoId = Number(req.nextUrl.searchParams.get("pedidoId"));
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  try {
    const geo = await coordenadasDoPedido(pedido);
    const r = await avaliarAlcance({
      serviceType: pedido.serviceType ?? null,
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      city: pedido.city ?? null,
      lat: geo.lat,
      lng: geo.lng,
    });

    return NextResponse.json({
      candidatos: r.candidatos,
      elegiveis: r.elegiveis,
      porque: porqueFicaramDeFora(r.motivos),
      motivos: r.motivos,
    });
  } catch (e) {
    console.error("[api/admin/negociacoes/alcance]", e);
    return NextResponse.json({ error: "Não foi possível calcular o alcance" }, { status: 500 });
  }
}
