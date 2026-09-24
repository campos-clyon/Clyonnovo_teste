import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { configuracaoDoEupago } from "@/lib/eupago";
import { contaDoCliente, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import {
  RECEBIMENTOS_A_MAO,
  nomeDoRecebimento,
  type ComoEntrou,
} from "@/lib/dinheiro-do-trabalho";
import { registarRecebimentoAMao } from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «O CLIENTE JÁ PAGOU» — DITO POR UMA PESSOA, QUANDO NÃO FOI PELO euPAGO.
 *
 * *«Gerir quem pagou e como pagou.»* — 24-09-2026.
 *
 * Até aqui, «o cliente pagou» era uma pergunta que só o euPago sabia
 * responder: a carteira lê a tabela `pagamentos`, e só o webhook escrevia lá.
 * Um cliente que transferisse para a conta da CLYON, ou que pagasse em
 * numerário, ou que simplesmente pagasse ao profissional no fim — que é o que
 * os ecrãs lhe prometem hoje — não tinha como ser registado. O trabalho ficava
 * «por cobrar» para sempre, e o dinheiro do profissional ficava preso atrás de
 * um desbloqueio que nunca vinha.
 *
 * ⚠️ ISTO DESBLOQUEIA DINHEIRO. Um registo aqui move o trabalho de «por
 * cobrar» para «disponível» na carteira do profissional — ou seja, autoriza
 * uma transferência. Por isso: só administrador, só métodos da lista, e o
 * índice único da base é que garante que não entra duas vezes.
 *
 * NÃO PAGA NADA A NINGUÉM. Diz o que já aconteceu. Quem paga ao profissional
 * é outro botão, noutro sítio, com outro registo.
 */

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; metodo?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  /*
   * A lista fechada, e não o que vier no corpo. Um método escrito à mão numa
   * coluna de texto é um relatório que nunca mais soma certo.
   */
  const metodo = String(corpo.metodo ?? "") as ComoEntrou;
  if (!RECEBIMENTOS_A_MAO.includes(metodo)) {
    return NextResponse.json(
      { error: "Diga como entrou: transferência, numerário, ou pago ao profissional." },
      { status: 400 },
    );
  }

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.pedidoId, n.providerId, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              n.estado, pr.name AS profissional
         FROM negociacoes n JOIN providers pr ON pr.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];

    const l = linhas[0];
    if (!l) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (l.estado !== "acordada") {
      return NextResponse.json(
        { error: `Este trabalho está «${l.estado}» — só se regista o pagamento de um trabalho fechado.` },
        { status: 409 },
      );
    }
    if (l.valorAcordado == null) {
      return NextResponse.json({ error: "Este trabalho não tem valor acordado." }, { status: 409 });
    }

    /*
     * O VALOR É O DA CONTA, e não um número escrito no ecrã. Quem regista diz
     * COMO entrou; QUANTO entrou sai das taxas gravadas nesta negociação, que
     * são as mesmas que o cliente viu. Deixar escrever o valor era deixar a
     * carteira do profissional depender de quem tem pressa.
     */
    const valor = contaDoCliente(Number(l.valorAcordado), taxasDaNegociacao(l)).total;
    const conf = configuracaoDoEupago(process.env);

    const r = await registarRecebimentoAMao({
      negociacaoId,
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      metodo,
      valor,
      quando: new Date(),
      ambiente: conf.ok ? conf.config.ambiente : "producao",
    });

    if (!r.feito) {
      return NextResponse.json({ error: r.porque }, { status: 409 });
    }

    const porQuem = colab?.nome ?? "a CLYON";
    const comoSeChama = nomeDoRecebimento(metodo);
    const emEuros = `${valor.toFixed(2).replace(".", ",")} €`;

    await appendOrderHistory(Number(l.pedidoId), {
      type: "created",
      by: null,
      message:
        `${porQuem} registou que o cliente pagou ${emEuros} — ${comoSeChama}. ` +
        "Não passou pelo euPago: é um registo à mão.",
    });

    await registarSemFalhar({
      acontecimento: "pagamento_recebido",
      pedidoId: Number(l.pedidoId),
      negociacaoId,
      providerId: Number(l.providerId),
      autorTipo: "clyon",
      autorNome: porQuem,
      resumo: `${comoSeChama}: ${emEuros} registados à mão.`,
      detalhe: { pagamentoId: r.pagamentoId, metodo, valor },
    });

    return NextResponse.json({ ok: true, valor, metodo });
  } catch (e) {
    console.error("[admin/pagamentos/recebido]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível registar o pagamento.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
