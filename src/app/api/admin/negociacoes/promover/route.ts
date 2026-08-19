import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  pedidosPorPromover,
  promoverPedidoAPlataforma,
  appendOrderHistory,
} from "@/lib/db";
import { distribuirPedido } from "@/lib/distribuir-pedido";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarLinkDoPedido } from "@/lib/email-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { validarValorDesejado } from "@/lib/pedido-valores";

export const runtime = "nodejs";

/**
 * Passar um pedido do simulador para a plataforma.
 *
 * O formulário público recolhe um pedido de orçamento: tem estimativa, não tem
 * valor pedido pelo cliente, e nunca foi distribuído a ninguém. Um profissional
 * não o vê, e não o poderia negociar mesmo que o visse — não há valor de
 * partida nem forma de o cliente responder.
 *
 * Promover resolve as três coisas de uma vez: fixa o valor de partida (o que
 * for indicado, ou a estimativa), emite o link de acesso do cliente e distribui
 * aos profissionais elegíveis.
 *
 * É uma acção de uma pessoa, e não algo que aconteça sozinho. Quem preencheu o
 * simulador pediu um orçamento à CLYON — não pediu para entrar num mercado. A
 * partir daqui passa a receber propostas de terceiros, e isso tem de ser
 * decidido, pedido a pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    return NextResponse.json({ pedidos: await pedidosPorPromover(20) });
  } catch (error) {
    console.error("[admin/negociacoes/promover GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; valor?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (pedido.valorDesejadoCliente != null) {
    return NextResponse.json(
      { error: "Este pedido já está na plataforma." },
      { status: 409 },
    );
  }

  // Sem valor indicado, vale a estimativa. É o único número que existe, e é o
  // que o cliente já viu no fim do simulador — começar a negociação noutro
  // sítio qualquer seria começá-la a mentir-lhe.
  const bruto =
    corpo.valor !== undefined && corpo.valor !== null && corpo.valor !== ""
      ? corpo.valor
      : (pedido.estimateTotal ?? pedido.estimateMax);

  const validacao = validarValorDesejado(bruto);
  if (!validacao.ok) {
    return NextResponse.json(
      { error: `Sem valor de partida: ${validacao.erros[0].mensagem}` },
      { status: 400 },
    );
  }
  const valor = validacao.valores.valorDesejadoCliente;

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
    const acesso = gerarTokenDeAcesso();
    const promovido = await promoverPedidoAPlataforma(
      pedidoId,
      valor,
      acesso.hash,
      acesso.expiraEm,
    );
    if (!promovido) {
      return NextResponse.json(
        { error: "Este pedido já tinha sido promovido." },
        { status: 409 },
      );
    }

    const baseUrl = urlDeAccaoDoPedido(req.headers);

    // O link primeiro: sem ele o cliente recebe propostas e não tem onde
    // responder, e a negociação morre ao fim das 48 horas sem ninguém saber
    // porquê. Se o email falhar, o token fica na resposta para envio à mão.
    const emailSaiu = await enviarLinkDoPedido({
      para: pedido.contactEmail ?? "",
      nomeDoCliente: pedido.contactName ?? null,
      pedidoId,
      serviceType: pedido.serviceType ?? null,
      token: acesso.token,
      valorDesejadoCliente: valor,
      baseUrl,
    });

    const r = await distribuirPedido({
      id: pedidoId,
      serviceType: pedido.serviceType ?? null,
      description: pedido.description ?? null,
      city: pedido.city ?? null,
      urgency: pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorDesejadoCliente: valor,
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      lat,
      lng,
      baseUrl,
    });

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        `Promovido a pedido de plataforma por ${valor} €. ` +
        `${r.avisados} profissional(is) avisado(s) de ${r.candidatos} activos.` +
        (emailSaiu ? "" : " O email do link ao cliente NÃO saiu."),
    });

    return NextResponse.json({
      ok: true,
      valor,
      emailSaiu,
      ...r,
      link: emailSaiu ? null : `${baseUrl}/pedido/${acesso.token}`,
    });
  } catch (error) {
    console.error("[admin/negociacoes/promover POST]", error);
    return NextResponse.json({ error: "Não foi possível promover" }, { status: 500 });
  }
}
