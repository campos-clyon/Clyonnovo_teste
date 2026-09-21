import { lerBase } from "@/lib/base-do-preco";
import { lerForma } from "@/lib/forma-de-pagamento";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  appendOrderHistory,
  negociacoesDoPedido,
  gravarNegociacao,
} from "@/lib/db";
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
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; reabrir?: unknown };
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

  /*
   * UM TRABALHO FECHADO NÃO ESTÁ À VENDA — 21-09-2026.
   *
   * O cron do alcance já tinha esta regra por escrito: «mandá-lo a mais um
   * seria pô-lo a orçamentar uma coisa que já não está à venda». Esta rota
   * não a tinha, e o botão passou a estar à vista em qualquer estado. Sem
   * isto, redistribuir o #355 — fechado com a Nova Recolha por 309 € — punha
   * mais sete profissionais a propor sobre um trabalho que já tem dono.
   *
   * Recusa-se com o nome e com a saída: quem quer mesmo mandar a outros tem
   * primeiro de desfazer o fecho, e isso é um gesto à parte, com registo.
   */
  const fechada = (await negociacoesDoPedido(pedidoId)).find((n) => n.estado === "acordada");
  if (fechada) {
    /*
     * REABRIR E REDISTRIBUIR — 21-09-2026, um gesto e não dois.
     *
     * "Sim quero Reabrir e redistribuir."
     *
     * O motor recusa `desistir` numa negociação acordada, e recusa bem: um
     * fecho é final para os dois lados. Desfazê-lo é um poder do BACKOFFICE,
     * não uma acção do motor — e por isso vive aqui, com o nome de quem o fez
     * no histórico, e não numa nova entrada de `accoesDisponiveis`.
     *
     * A NEGOCIAÇÃO DESFEITA FICA «DESISTIDA», e é a escolha certa entre as
     * duas mortes: «morta» é «perdeu para outro» e voltaria a receber o pedido
     * na redistribuição; «desistida» fica em paz. Quem falhou um trabalho
     * fechado não é a primeira pessoa a quem se manda o mesmo trabalho outra
     * vez.
     *
     * ⚠️ NÃO SE REABRE O QUE JÁ ACONTECEU. Trabalho enviado como feito,
     * confirmado ou pago tem dinheiro por trás — o do profissional na
     * carteira, ou o do cliente numa referência. Desfazer isso é outra
     * conversa (uma correcção de valor, um reembolso), nunca um clique.
     */
    const jaAconteceu =
      fechada.execucaoEnviadaEm != null || fechada.confirmadoEm != null || fechada.pagoEm != null;
    if (corpo.reabrir !== true || jaAconteceu) {
      return NextResponse.json(
        {
          error: jaAconteceu
            ? `Este trabalho está fechado com ${fechada.profissionalNome} e já foi dado como feito, ` +
              "confirmado ou pago. Não se reabre com um clique — corrija o valor ou trate do reembolso primeiro."
            : `Este pedido está fechado com ${fechada.profissionalNome}. Reabrir desfaz esse fecho ` +
              "em nome do cliente e manda o pedido a todos os outros.",
          fechadaCom: fechada.profissionalNome,
          podeReabrir: !jaAconteceu,
        },
        { status: 409 },
      );
    }

    await gravarNegociacao(Number(fechada.id), {
      estado: "desistida",
      valorAcordado: null,
      propostasJson: fechada.propostasJson ?? "[]",
    });
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        `CLYON (${colab?.nome ?? "a CLYON"}) desfez o fecho com ${fechada.profissionalNome} ` +
        `(negociação #${fechada.id}, ${Number(fechada.valorAcordado ?? 0).toFixed(2)} €) em nome do cliente, ` +
        "para redistribuir.",
    });
  }

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
      baseDoPreco: lerBase(pedido.baseDoPreco),
      formaDePagamento: lerForma(pedido.formaDePagamento),
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
