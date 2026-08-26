import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  negociacoesDoPedido,
  cancelarPedido,
  appendOrderHistory,
  registarSemFalhar,
} from "@/lib/db";

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
 * O QUE ELE RECUSA
 *
 * Um trabalho já contratado, executado, confirmado ou pago. Cancelar isso não
 * é cancelar um pedido, é desfazer um compromisso entre duas pessoas com
 * dinheiro pelo meio — e há um caminho próprio para isso, que é desistir da
 * negociação, que fala com quem está do outro lado. Recusa, e diz com quem.
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
          `. Cancelar o pedido não desfaz isso — desista dessa negociação primeiro, ` +
          `para que ele saiba, e só depois cancele.`,
      },
      { status: 409 },
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
        `Pedido cancelado pela CLYON (${porQuem})` +
        (motivo ? ` — ${motivo}` : "") +
        `. ${r.encerradas} ${
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
      resumo: motivo
        ? `Pedido cancelado pela CLYON (${porQuem}): ${motivo}`
        : `Pedido cancelado pela CLYON (${porQuem})`,
    });

    return NextResponse.json({ ok: true, encerradas: r.encerradas });
  } catch (error) {
    console.error("[api/admin/negociacoes/cancelar]", error);
    return NextResponse.json({ error: "Não foi possível cancelar" }, { status: 500 });
  }
}
