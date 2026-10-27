import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { registarSemFalhar } from "@/lib/db";
import { marcarFaturaEmitida, pagamentoPorId } from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/fatura-emitida — «A FATURA JÁ SAIU». 27-10-2026 (d16).
 *
 * Tira um pagamento da fila «Faturas por emitir» dos Pagamentos. Não mexe no
 * valor nem no estado do pagamento: só anota quando a fatura foi emitida, e
 * quem o disse fica no registo. Só o administrador.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { pagamentoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pagamentoId = Number(corpo.pagamentoId);
  if (!Number.isInteger(pagamentoId) || pagamentoId <= 0) {
    return NextResponse.json({ error: "Pagamento não indicado." }, { status: 400 });
  }

  try {
    const p = await pagamentoPorId(pagamentoId);
    if (!p) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    if (p.estado !== "pago" || !p.comFactura) {
      return NextResponse.json({ error: "Este pagamento não tem fatura por emitir." }, { status: 409 });
    }
    const feito = await marcarFaturaEmitida(pagamentoId);
    if (!feito) return NextResponse.json({ ok: true, jaEstava: true });

    await registarSemFalhar({
      acontecimento: "fatura_emitida",
      pedidoId: p.pedidoId,
      negociacaoId: p.negociacaoId,
      providerId: p.providerId,
      autorTipo: "clyon",
      autorNome: colab?.nome ?? "a CLYON",
      resumo: `Fatura emitida do pagamento de ${(p.valorPago ?? p.valor).toFixed(2).replace(".", ",")} €.`,
      detalhe: { pagamentoId, faturaEmitida: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/pagamentos/fatura-emitida]", e);
    return NextResponse.json({ error: "Não foi possível anotar a fatura." }, { status: 500 });
  }
}
