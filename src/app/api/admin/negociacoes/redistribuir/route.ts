import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSimulatorOrderById, appendOrderHistory } from "@/lib/db";
import { distribuirPedido, resumoDaDistribuicao } from "@/lib/distribuir-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";

export const runtime = "nodejs";

/**
 * Voltar a distribuir um pedido aos profissionais elegíveis.
 *
 * A distribuição corre uma vez, quando o pedido é criado. Se nessa altura não
 * havia ninguém que servisse — nenhum aprovado na zona, ninguém a emitir
 * fatura, a guia por verificar — o pedido ficava publicado e sem propostas,
 * para sempre, mesmo depois de a causa ser corrigida.
 *
 * Era um beco sem saída: aprovava-se o profissional que faltava e o pedido
 * continuava parado, sem forma de o acordar.
 *
 * Correr outra vez é seguro: `criarNegociacao` tem ON DUPLICATE KEY sobre o par
 * (pedido, profissional), portanto quem já foi notificado mantém a negociação e
 * o histórico de propostas. Só entram os que faltavam.
 *
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  if (pedido.valorDesejadoCliente == null) {
    return NextResponse.json(
      { error: "Este pedido não tem valores — não é um pedido da plataforma." },
      { status: 400 },
    );
  }

  // As coordenadas do trabalho vivem no JSON do formulário, não em colunas.
  /*
   * As coordenadas, indo buscá-las se ainda não existirem.
   *
   * Era uma leitura crua do rawOrderJson: se lá não estivessem, seguia com
   * nulos e a regra caía na lista de zonas de cada profissional. O #205 —
   * uma recolha na Avenida Mouzinho de Albuquerque, em Lisboa — foi enviado
   * três vezes e as três não chegaram a ninguém, comparado contra "palmela,
   * montijo, seixal, amora, setubal", quando a 35 km havia um profissional
   * com raio de 125 km.
   *
   * Geocodificar só na criação não chegava: há mais de cem pedidos na base
   * criados antes disso, e esses não voltam a ser criados. Agora a busca
   * acontece aqui, e o resultado fica gravado — da segunda vez já não há
   * chamada nenhuma ao Google.
   */
  const geo = await coordenadasDoPedido(pedido);
  const lat = geo.lat;
  const lng = geo.lng;
  let fotos = 0;
  try {
    const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
    fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
  } catch {
    /* sem fotos */
  }

  try {
    const r = await distribuirPedido({
      id: pedidoId,
      serviceType: pedido.serviceType ?? null,
      description: pedido.description ?? null,
      city: pedido.city ?? null,
      urgency: pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorDesejadoCliente: Number(pedido.valorDesejadoCliente),
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      lat,
      lng,
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: `Redistribuído. ` + resumoDaDistribuicao(r),
    });

    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[api/admin/negociacoes/redistribuir]", error);
    return NextResponse.json({ error: "Não foi possível redistribuir" }, { status: 500 });
  }
}
