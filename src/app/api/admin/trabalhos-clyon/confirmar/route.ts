import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  confirmarExecucao,
  darPorEntreguePelaClyon,
  ensureNegociacoesTable,
  getPool,
  registarSemFalhar,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * A CLYON DÁ O TRABALHO CLYON POR FEITO — e o valor fica disponível na carteira.
 *
 * Num pedido normal quem confirma é o cliente, pelo link ou pelo WhatsApp.
 * Aqui o cliente não recebe mensagens automáticas (decisão do dono a
 * 02-10-2026), e quem paga ao profissional é a CLYON: quem confirma é ela.
 *
 * SEM A PERGUNTA «como pagou o cliente», de propósito: o pagamento do cliente
 * destes trabalhos é da CLYON e passa por fora; à carteira do profissional só
 * interessa que o trabalho está feito. `confirmarExecucao` sem declaração.
 *
 * `semProva` é o caso de o profissional não ter enviado as fotografias: a
 * CLYON sabe que foi feito (esteve lá, o cliente disse-lho) e dá-o por
 * entregue antes de o confirmar — o mesmo gesto da ficha da Agenda.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; semProva?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação não indicada." }, { status: 400 });
  }

  // As colunas da oferta (`ofertaClyon`) têm de existir antes de as lermos.
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.pedidoId, n.providerId, n.estado, n.ofertaClyon, n.valorAcordado, p.name AS profissional
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [
      Array<{
        pedidoId: number;
        providerId: number;
        estado: string;
        ofertaClyon: string | null;
        valorAcordado: string | null;
        profissional: string;
      }>,
      unknown,
    ];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (!linha.ofertaClyon) {
      return NextResponse.json(
        { error: "Isto não é um trabalho CLYON de valor fixo — confirma-se pelo caminho de sempre." },
        { status: 409 },
      );
    }
    if (linha.estado !== "acordada") {
      return NextResponse.json({ error: "Este trabalho ainda não tem profissional." }, { status: 409 });
    }

    const pedidoId = Number(linha.pedidoId);
    if (corpo.semProva === true) await darPorEntreguePelaClyon(negociacaoId, pedidoId);
    const gravou = await confirmarExecucao(negociacaoId, pedidoId);
    if (!gravou) {
      return NextResponse.json(
        {
          error:
            "Não há nada para confirmar: ou o profissional ainda não o deu por feito, ou já foi confirmado.",
        },
        { status: 409 },
      );
    }

    const quem = colab?.nome ?? "a CLYON";
    const resumo =
      `CLYON (${quem}) confirmou o trabalho de ${linha.profissional}` +
      (corpo.semProva === true ? " sem as fotografias dele" : "") +
      ". O valor fica disponível na carteira dele.";
    await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "execucao_confirmada",
      pedidoId,
      negociacaoId,
      providerId: Number(linha.providerId),
      providerNome: linha.profissional,
      autorTipo: "clyon",
      autorNome: quem,
      valor: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
      resumo,
      visivelProfissional: true,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/trabalhos-clyon/confirmar]", e);
    return NextResponse.json({ error: "Não foi possível confirmar." }, { status: 500 });
  }
}
