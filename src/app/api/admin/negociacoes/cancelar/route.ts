import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  negociacoesDoPedido,
  cancelarPedido,
  appendOrderHistory,
  registarSemFalhar,
} from "@/lib/db";
import { oQueSeDesfaz, resumoDoCancelamento } from "@/lib/cancelamento";

export const runtime = "nodejs";

/**
 * Cancelar um pedido — o cliente desistiu e o trabalho não vai acontecer.
 *
 * O #225 foi exactamente isto. Duas propostas na mesa, 250 € e 350 €, e o
 * Sr. Rui a responder pelo WhatsApp que arranjou mais barato noutro sítio.
 * Não havia como o dizer ao sistema: o pedido ficava na mesa como se ainda
 * houvesse alguém a decidir, e o profissional com a proposta aberta continuava
 * à espera de uma resposta que nunca ia chegar.
 *
 * NÃO É APAGAR. O pedido fica, o histórico fica, o registo permanente fica. No
 * dia em que alguém perguntar o que aconteceu ao #225, a resposta existe — e
 * com o motivo, se quem cancelou o escreveu.
 *
 * NÃO RECUSA NADA — E ISSO É UMA CORRECÇÃO
 *
 * A primeira versão recusava com 409 quando havia trabalho contratado ou
 * executado. Ele corrigiu-me: "essa opção deve ser absoluta, tanto a CLYON
 * quanto o Rui devem ter esse direito." Tem razão. Um cliente que já foi
 * noutro sítio não deixa de o ter feito por o botão estar bloqueado; o pedido
 * é que fica na mesa a fingir que está vivo, e o profissional continua à
 * espera de uma resposta que não vem. Bloquear não protegia ninguém.
 *
 * O que muda quando há um compromisso a desfazer é o PESO: o motivo passa a
 * ser obrigatório, e fica escrito quem foi desfeito, por quanto e em que ponto
 * estava. Quando o profissional perguntar porque perdeu o trabalho, a resposta
 * tem de existir por escrito.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; motivo?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const motivo =
    typeof corpo.motivo === "string" && corpo.motivo.trim().length > 0
      ? corpo.motivo.trim().slice(0, 300)
      : null;

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  if (pedido.status === "cancelado") {
    return NextResponse.json({ error: "Este pedido já está cancelado." }, { status: 409 });
  }

  const existentes = await negociacoesDoPedido(pedidoId);
  const desfaz = oQueSeDesfaz(existentes);

  // O único travão que resta, e não é um bloqueio: é uma exigência de registo.
  if (desfaz.motivoObrigatorio && !motivo) {
    return NextResponse.json(
      {
        error:
          `Este pedido está ${desfaz.ponto} com ${desfaz.profissional}. ` +
          `Para cancelar tem de escrever porquê — fica no histórico e no registo, ` +
          `e é a resposta que ele vai querer quando perguntar porque perdeu o trabalho.`,
        precisaDeMotivo: true,
        aviso: desfaz,
      },
      { status: 422 },
    );
  }

  try {
    const r = await cancelarPedido(pedidoId);
    if (!r) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

    const porQuem = colab?.nome ?? "a equipa";
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        resumoDoCancelamento(desfaz, `CLYON (${porQuem})`, motivo) +
        ` ${r.encerradas} ${
          r.encerradas === 1 ? "negociação encerrada" : "negociações encerradas"
        }.`,
    });

    // No registo permanente fica o motivo por escrito. Um pedido cancelado sem
    // motivo é indistinguível de um pedido cancelado por engano.
    await registarSemFalhar({
      acontecimento: "pedido_cancelado",
      pedidoId,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: pedido.valorDesejadoCliente != null ? Number(pedido.valorDesejadoCliente) : null,
      resumo: resumoDoCancelamento(desfaz, `CLYON (${porQuem})`, motivo),
    });

    return NextResponse.json({ ok: true, encerradas: r.encerradas, desfez: desfaz });
  } catch (error) {
    console.error("[api/admin/negociacoes/cancelar]", error);
    return NextResponse.json({ error: "Não foi possível cancelar" }, { status: 500 });
  }
}
