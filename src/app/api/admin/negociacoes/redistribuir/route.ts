import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  appendOrderHistory,
  negociacoesDoPedido,
  matarNegociacoesDoPedido,
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
 * ── RECOMEÇAR DO ZERO ──────────────────────────────────────────────────────
 *
 * Guardar o histórico é o que se quer quase sempre. Mas há um caso em que é
 * precisamente o problema: o pedido saiu com o valor errado.
 *
 * Aconteceu no #228. Uma cómoda para recolher, o cliente com 30 € de
 * orçamento, e o pedido a sair com 121 € porque foi esse o valor que o
 * formulário calculou. Um profissional aceitou os 121 € — e a partir daí a
 * negociação já não aceita propostas de ninguém: está à espera de ser
 * fechada. Corrigir o valor do pedido não mudava nada, porque a proposta
 * aceite continuava lá. Ele disse-o assim: "ele deveria sumir e reaparecer
 * para todos dentro do raio e da categoria como um novo pedido".
 *
 * Com `recomecar`, é isso que acontece: as negociações de todos morrem, o
 * pedido é distribuído de novo, e quem for elegível hoje recebe-o com o valor
 * de partida novo e um link novo, sem rasto das propostas antigas.
 *
 * O QUE ELE NÃO FAZ, e não deve fazer: mexer num trabalho já fechado. Se
 * alguém já foi contratado, já executou ou já foi pago, recomeçar apagaria um
 * compromisso a sério — de um lado o profissional que contava com o trabalho,
 * do outro o dinheiro. Nesse caso recusa e diz porquê, para o admin decidir
 * (desistir daquela negociação primeiro) em vez de descobrir depois.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; recomecar?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const recomecar = corpo.recomecar === true;

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // O guarda do recomeço: fechado é fechado.
  if (recomecar) {
    const existentes = await negociacoesDoPedido(pedidoId);
    const fechada = existentes.find(
      (n) =>
        n.estado === "acordada" ||
        n.confirmadoEm != null ||
        n.pagoEm != null ||
        n.execucaoEnviadaEm != null,
    );
    if (fechada) {
      return NextResponse.json(
        {
          error:
            `Este trabalho já está fechado com ${fechada.profissionalNome}` +
            (fechada.valorAcordado != null
              ? ` por ${Number(fechada.valorAcordado).toFixed(2).replace(".", ",")} €`
              : "") +
            `. Recomeçar apagaria esse compromisso. Desista dessa negociação primeiro, ` +
            `e só depois recomece.`,
        },
        { status: 409 },
      );
    }
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
    // Matar antes de distribuir: quem deixou de ser elegível — mudou o
    // serviço, saiu do raio — fica morto e desaparece do painel dele. Quem
    // continuar elegível é REPOSTO já a seguir, com valor e link novos.
    const mortas = recomecar ? await matarNegociacoesDoPedido(pedidoId) : 0;

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
    }, { reabrir: recomecar });

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: recomecar
        ? `Recomeçado do zero com ${Number(pedido.valorDesejadoCliente)
            .toFixed(2)
            .replace(".", ",")} € de partida — ${mortas} ${
            mortas === 1 ? "negociação anterior encerrada" : "negociações anteriores encerradas"
          }. ` + resumoDaDistribuicao(r)
        : `Redistribuído. ` + resumoDaDistribuicao(r),
    });

    return NextResponse.json({ ok: true, recomecado: recomecar, ...r });
  } catch (error) {
    console.error("[api/admin/negociacoes/redistribuir]", error);
    return NextResponse.json(
      { error: recomecar ? "Não foi possível recomeçar" : "Não foi possível redistribuir" },
      { status: 500 },
    );
  }
}
