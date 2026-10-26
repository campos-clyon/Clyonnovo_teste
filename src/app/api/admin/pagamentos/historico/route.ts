import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { ensureSimulatorOrdersTable, getPool, registoParaOBackoffice } from "@/lib/db";
import { entradasDoHistorico, marcasDoDinheiro } from "@/lib/historico-do-pedido";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O HISTÓRICO DE UM TRABALHO, ABERTO NOS PAGAMENTOS — 26-10-2026 (d25).
 *
 * GET ?pedido=<id>&negociacao=<id> — quem marcou o quê e quando no dinheiro
 * (o registo permanente) e o histórico do pedido (o mesmo da ficha). Ver
 * `historico-do-pedido.ts`.
 *
 * SÓ LÊ. Aberta a quem tem a secção Pagamentos (`papel-do-painel.ts`), como a
 * lista: o assistente que vê o trabalho vê também como ele chegou aqui. Não
 * marca o pedido como visto, ao contrário da ficha — abrir um trabalho pago
 * para o conferir não é abrir um pedido novo.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const q = new URL(req.url).searchParams;
  const pedidoId = Number(q.get("pedido"));
  const negociacaoCru = q.get("negociacao");
  const negociacaoId = negociacaoCru ? Number(negociacaoCru) : null;
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido não indicado." }, { status: 400 });
  }
  if (negociacaoId != null && (!Number.isInteger(negociacaoId) || negociacaoId <= 0)) {
    return NextResponse.json({ error: "Trabalho inválido." }, { status: 400 });
  }

  try {
    await ensureSimulatorOrdersTable();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

    const [[linhas], registo] = await Promise.all([
      pool.execute("SELECT historyJson FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId]) as Promise<
        [Array<{ historyJson: string | null }>, unknown]
      >,
      // O registo falhar não apaga o histórico: fica sem as marcas, e diz-se.
      registoParaOBackoffice({ pedidoId, limite: 200 }).catch((e) => {
        console.error("[admin/pagamentos/historico] registo", e);
        return null;
      }),
    ]);

    const pedido = linhas[0];
    return NextResponse.json({
      pedidoId,
      existe: Boolean(pedido),
      marcas: registo ? marcasDoDinheiro(registo, negociacaoId) : [],
      registoLido: registo != null,
      historico: pedido ? entradasDoHistorico(pedido.historyJson) : [],
    });
  } catch (e) {
    console.error("[admin/pagamentos/historico]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível ler o histórico.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
