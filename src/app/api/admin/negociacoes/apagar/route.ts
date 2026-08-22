import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { deleteSimulatorOrder, TrabalhoEmCurso } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Apaga vários pedidos de uma vez.
 *
 * PORQUE NÃO SÃO N CHAMADAS AO ENDPOINT DE UM SÓ
 *
 * Porque o que interessa a quem carregou no botão não é o resultado de cada
 * uma — é o resultado do conjunto. Com N chamadas do lado do browser, apagar
 * doze pedidos dos quais dois se recusam dá doze respostas e nenhuma
 * conclusão: o ecrã tem de as juntar sozinho, e se a rede falhar a meio fica
 * um estado que ninguém sabe descrever. Aqui é uma pergunta e uma resposta,
 * que diz exactamente quantos foram e quais é que ficaram, com o motivo de
 * cada um.
 *
 * CADA UM NA SUA TRANSACÇÃO
 *
 * Não há transacção que envolva os doze. É de propósito: um pedido que se
 * recusa a ser apagado — porque tem trabalho fechado e por confirmar — não
 * pode desfazer o apagamento dos outros onze que estavam bem. A recusa de um
 * é informação, não é avaria do lote.
 *
 * O LIMITE
 *
 * Cinquenta por chamada. Cada pedido abre uma ligação, lê o pedido, lê as
 * negociações, escreve no registo e apaga — num pool de cinco ligações e com
 * um limite de tempo de função em cima. Sem tecto, uma selecção de "escolher
 * todos" numa lista de trezentos rebentava a meio, e metade ficava apagada
 * sem ninguém saber qual metade.
 */

const MAXIMO_POR_CHAMADA = 50;

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { ids?: unknown; motivo?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const ids = Array.isArray(corpo.ids)
    ? [...new Set(corpo.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Indique pelo menos um pedido." }, { status: 400 });
  }
  if (ids.length > MAXIMO_POR_CHAMADA) {
    return NextResponse.json(
      { error: `No máximo ${MAXIMO_POR_CHAMADA} pedidos de cada vez. Seleccionou ${ids.length}.` },
      { status: 400 },
    );
  }

  const motivo =
    typeof corpo.motivo === "string" && corpo.motivo.trim()
      ? corpo.motivo.trim().slice(0, 120)
      : "apagado no backoffice";

  const apagados: number[] = [];
  const recusados: Array<{ id: number; motivo: string }> = [];

  for (const id of ids) {
    try {
      await deleteSimulatorOrder(id, { motivo, autorNome: colab?.nome ?? null });
      apagados.push(id);
    } catch (e) {
      if (e instanceof TrabalhoEmCurso) {
        recusados.push({ id, motivo: e.message });
        continue;
      }
      // Uma avaria a sério — base em baixo, ligação perdida — não se disfarça
      // de recusa. Pára aqui e devolve o que já tinha sido feito, para quem
      // repetir não ficar sem saber por onde ia.
      console.error("[admin/negociacoes/apagar]", id, e);
      return NextResponse.json(
        {
          error: `Erro ao apagar o pedido #${id}. ${apagados.length} já tinham sido apagados.`,
          apagados,
          recusados,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, apagados, recusados });
}
