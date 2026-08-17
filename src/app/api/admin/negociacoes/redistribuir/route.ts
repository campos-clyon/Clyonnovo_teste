import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSimulatorOrderById, appendOrderHistory } from "@/lib/db";
import { distribuirPedido } from "@/lib/distribuir-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

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

  if (pedido.valorMinimoCliente == null) {
    return NextResponse.json(
      { error: "Este pedido não tem valores — não é um pedido da plataforma." },
      { status: 400 },
    );
  }

  // As coordenadas do trabalho vivem no JSON do formulário, não em colunas.
  let lat: number | null = null;
  let lng: number | null = null;
  let fotos = 0;
  try {
    const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
    lat = typeof cru?.address?.lat === "number" ? cru.address.lat : null;
    lng = typeof cru?.address?.lng === "number" ? cru.address.lng : null;
    fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
  } catch {
    /* sem coordenadas, a regra cai nas zonas */
  }

  try {
    const r = await distribuirPedido({
      id: pedidoId,
      serviceType: pedido.serviceType ?? null,
      description: pedido.description ?? null,
      city: pedido.city ?? null,
      urgency: pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorMinimoCliente: Number(pedido.valorMinimoCliente),
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      lat,
      lng,
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        r.avisados > 0
          ? `Redistribuído: ${r.avisados} profissional(is) avisado(s) de ${r.candidatos} activos.`
          : `Redistribuído sem resultado (${r.candidatos} activos). Motivos: ${JSON.stringify(r.motivos)}`,
    });

    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[api/admin/negociacoes/redistribuir]", error);
    return NextResponse.json({ error: "Não foi possível redistribuir" }, { status: 500 });
  }
}
