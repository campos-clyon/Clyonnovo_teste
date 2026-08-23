import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  pedidosPorPromover,
  promoverPedidoAPlataforma,
  appendOrderHistory,
} from "@/lib/db";
import { distribuirPedido, resumoDaDistribuicao } from "@/lib/distribuir-pedido";
import { negociacoesDoPedido } from "@/lib/db";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarLinkDoPedido } from "@/lib/email-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { validarValorDesejado } from "@/lib/pedido-valores";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";

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
    /*
     * Cem, e nao vinte.
     *
     * Com vinte, o painel mostrava uma janela e calava o resto: arquivar um
     * pedido fazia aparecer outro vindo do fundo da fila, e nunca se sabia
     * quantos faltavam. O contador que agora esta no cabecalho seria uma
     * mentira do tamanho da diferenca.
     *
     * Cem cabe porque a lista deixou de ser corrida: agrupa por idade e os
     * antigos — que sao quase sempre a maioria — nascem fechados.
     */
    return NextResponse.json({ pedidos: await pedidosPorPromover(100) });
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
  /*
   * Está na plataforma quem CHEGOU a alguém, não quem tem um número.
   *
   * Esta guarda olhava para `valorDesejadoCliente != null`. A lista ao lado
   * usa outro critério — não ter negociações — e as duas discordavam:
   *
   *   1. o admin carrega em "Enviar aos profissionais";
   *   2. o valor fica gravado, mas a distribuição não chega a ninguém;
   *   3. o pedido continua na lista, porque continua sem negociações;
   *   4. carregar outra vez responde "Este pedido já está na plataforma".
   *
   * O pedido ficava preso: visível, por enviar, e impossível de enviar. Foi o
   * que aconteceu ao #202. O critério passa a ser o mesmo dos dois lados.
   */
  const jaTemNegociacoes = (await negociacoesDoPedido(pedidoId)).length > 0;
  if (jaTemNegociacoes) {
    return NextResponse.json(
      { error: "Este pedido já foi enviado aos profissionais." },
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
        resumoDaDistribuicao(r) +
        (emailSaiu ? "" : " O email do link ao cliente NÃO saiu."),
    });

    /*
     * Zero profissionais não é sucesso.
     *
     * O ecrã mostrava "enviado" e a lista mantinha o pedido lá — sem dizer
     * porquê. Quem estava do outro lado concluía que o botão não fazia nada.
     * Os motivos já eram contados pela regra; faltava alguém mostrá-los.
     */
    return NextResponse.json({
      ok: true,
      chegouAAlguem: r.receberam > 0,
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
