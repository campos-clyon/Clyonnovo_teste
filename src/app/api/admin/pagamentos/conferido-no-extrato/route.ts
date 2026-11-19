import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { registarSemFalhar } from "@/lib/db";
import { eAlvoDoExtrato } from "@/lib/origem-do-pagamento";
import { marcarConferidoNoExtrato } from "@/lib/rasto-do-pagamento-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «CONFERIDO NO EXTRATO» — d1 (CEO e dono, 19-11-2026).
 *
 * Um comprovativo prova pouco; o extrato do banco prova que o dinheiro entrou.
 * Quem confere o extrato (as Finanças, uma vez por semana) marca cada
 * transferência que lá viu: uma linha paga de `pagamentos` ou uma parte da
 * cobrança ao profissional. Grava só quem e quando (nunca muda valores nem
 * estados), uma vez, e fica no registo permanente do trabalho.
 *
 * Só o administrador: é uma escrita de dinheiro (`ESCRITAS_SO_DO_ADMINISTRADOR`
 * em /api/admin/pagamentos, e `requireAdminGeral` aqui).
 * Corpo: `{ alvo: "pagamento" | "cobranca", alvoId }`.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { alvo?: unknown; alvoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!eAlvoDoExtrato(corpo.alvo)) {
    return NextResponse.json({ error: "Diga que registo conferiu: um pagamento ou uma parte da cobrança." }, { status: 400 });
  }
  const alvoId = Number(corpo.alvoId);
  const por = String(colab?.nome ?? "a CLYON");

  try {
    const r = await marcarConferidoNoExtrato({ alvo: corpo.alvo, alvoId, por, agora: new Date() });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status });
    await registarSemFalhar({
      acontecimento: "pagamento_conferido_no_extrato",
      pedidoId: r.pedidoId,
      negociacaoId: r.negociacaoId,
      autorTipo: "clyon",
      autorNome: por,
      resumo: "Transferência conferida no extrato do banco.",
      detalhe: { alvo: corpo.alvo, alvoId },
      valor: r.valor,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/pagamentos/conferido-no-extrato]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}
