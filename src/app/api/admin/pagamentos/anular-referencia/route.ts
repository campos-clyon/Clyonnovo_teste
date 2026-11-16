import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { fecharSemPagar, pagamentoPorId } from "@/lib/pagamentos-na-base";
import { fraseDaAnulacao, lerAnulacao, motivoDaAnulacao, porqueNaoSeAnula } from "@/lib/anular-a-referencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/anular-referencia — 16-11-2026 (d52, dono).
 *
 * Uma referência Multibanco ou um MB WAY do cliente, por pagar, deixa de valer
 * na plataforma. Só o administrador geral, com motivo obrigatório. A linha
 * fica `cancelado` (nunca se apaga), com o motivo; o histórico do pedido e o
 * registo permanente guardam quem, quando e porquê — como a correcção de um
 * pagamento.
 *
 * O euPago não é avisado (a integração não tem forma documentada de anular):
 * se o cliente a pagar mesmo assim, o aviso entra e fica para devolver
 * (`pagamentoForaDeVigor`). A regra é `anular-a-referencia.ts`.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const lido = lerAnulacao(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });

  try {
    const p = await pagamentoPorId(lido.pedido.pagamentoId);
    if (!p) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    const porque = porqueNaoSeAnula(p);
    if (porque) return NextResponse.json({ error: porque }, { status: 409 });

    const quem = colab?.nome ?? "a CLYON";
    // Só sai de `pendente` (a guarda está no UPDATE): um pago a meio não se desfaz.
    const r = await fecharSemPagar(p.id, "cancelado", { motivo: motivoDaAnulacao(quem, lido.pedido.motivo) });
    if (!r.feito) {
      return NextResponse.json({ error: "Esta referência já não está por pagar." }, { status: 409 });
    }

    const frase = fraseDaAnulacao(p, { quem, motivo: lido.pedido.motivo });
    await appendOrderHistory(p.pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: frase,
    });
    await registarSemFalhar({
      acontecimento: "referencia_anulada",
      pedidoId: p.pedidoId,
      negociacaoId: p.negociacaoId,
      providerId: p.providerId,
      autorTipo: "clyon",
      autorNome: quem,
      resumo: frase,
      valor: p.valor,
      detalhe: {
        pagamentoId: p.id,
        metodo: p.metodo,
        referencia: p.referencia,
        motivo: lido.pedido.motivo,
        euPagoAvisado: false,
      },
    });

    return NextResponse.json({ ok: true, feito: frase });
  } catch (e) {
    console.error("[admin/pagamentos/anular-referencia]", e);
    return NextResponse.json({ error: "Não foi possível anular." }, { status: 500 });
  }
}
