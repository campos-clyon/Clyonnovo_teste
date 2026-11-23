import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { getPool, registarSemFalhar, appendOrderHistory } from "@/lib/db";
import { confirmarDadosDePagamento, negociacoesComDadosPorConfirmar } from "@/lib/dados-de-pagamento-por-confirmar-na-base";

export const runtime = "nodejs";

/**
 * «CONFIRMEI COM O PARCEIRO» — d5, 19-11-2026.
 *
 * Os dados de pagamento do parceiro mudaram depois de o cliente contratar, ou o
 * titular do IBAN não bate com o nome dele (`dados-de-pagamento-por-confirmar.ts`):
 * o cliente não os vê até alguém da CLYON confirmar por telefone com o
 * parceiro. Este botão, na Mesa, é essa confirmação. Só o administrador; fica
 * no registo permanente e no histórico do pedido, com quem e o porquê.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação inválida." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
    const [linhas] = (await pool.execute("SELECT pedidoId, providerId FROM negociacoes WHERE id = ? LIMIT 1", [
      negociacaoId,
    ])) as unknown as [Array<{ pedidoId: number; providerId: number }>, unknown];
    const n = linhas[0];
    if (!n) return NextResponse.json({ error: "Negociação não encontrada." }, { status: 404 });

    const porque = (await negociacoesComDadosPorConfirmar([negociacaoId])).get(negociacaoId) ?? null;
    const gravou = await confirmarDadosDePagamento(negociacaoId, colab.nome);
    if (!gravou) {
      return NextResponse.json({ error: "Só se confirma numa negociação contratada." }, { status: 409 });
    }
    const resumo = `Dados de pagamento do parceiro confirmados com ele por ${colab.nome} (${
      porque === "titular" ? "titular do IBAN não batia com o nome" : porque === "mudaram" ? "mudaram depois de contratar" : "sem aviso pendente"
    }). O cliente passa a vê-los.`;
    await registarSemFalhar({
      acontecimento: "dados_de_pagamento_confirmados",
      pedidoId: Number(n.pedidoId),
      negociacaoId,
      providerId: Number(n.providerId),
      autorTipo: "clyon",
      autorNome: colab.nome,
      resumo,
      detalhe: { porId: colab.id ?? null, porque },
    });
    await appendOrderHistory(Number(n.pedidoId), {
      type: "dados_de_pagamento_confirmados",
      by: colab.id != null ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: resumo,
    }).catch(() => {});
    // d5 (21-11-2026): o cliente sabe que já pode ver os dados — push na app, senão email. Nunca bloqueia a confirmação.
    let avisado: "push" | "email" | "nenhum" = "nenhum";
    try {
      const [p] = (await pool.execute("SELECT contactEmail FROM simulatorOrders WHERE id = ? LIMIT 1", [Number(n.pedidoId)])) as unknown as [
        Array<{ contactEmail: string | null }>,
        unknown,
      ];
      const { avisarClienteDosDadosConfirmados } = await import("@/lib/avisar-dados-de-pagamento-confirmados");
      avisado = await avisarClienteDosDadosConfirmados({ pedidoId: Number(n.pedidoId), email: p?.[0]?.contactEmail });
    } catch (e) {
      console.error("[api/admin/negociacoes/dados-de-pagamento] o aviso ao cliente falhou:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true, avisado });
  } catch (e) {
    console.error("[api/admin/negociacoes/dados-de-pagamento]", e);
    return NextResponse.json({ error: "Não foi possível confirmar." }, { status: 500 });
  }
}
