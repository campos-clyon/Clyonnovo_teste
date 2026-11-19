import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { avisoPorId, dispensarAviso, pagamentoPorId } from "@/lib/pagamentos-na-base";
import { fraseDaDispensa, lerDispensa, notaDaDispensa } from "@/lib/dispensar-aviso-do-eupago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/dispensar-aviso — 19-11-2026 (d72, dono).
 *
 * Um aviso do euPago «por aplicar» que o administrador viu e sabe que não é
 * dinheiro por conciliar (uma referência de teste que expirou, por exemplo).
 * Só o administrador geral, com motivo obrigatório (até 200 caracteres). O
 * aviso fica `aplicado = 1` com «Dispensado por <quem>: <motivo>»; nunca se
 * apaga. O histórico do pedido (se o aviso for de um pagamento nosso) e o
 * registo permanente guardam quem, quando e porquê — como anular uma
 * referência. A regra é `dispensar-aviso-do-eupago.ts`.
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
  const lido = lerDispensa(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });

  try {
    const a = await avisoPorId(lido.pedido.avisoId);
    if (!a) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });
    if (a.aplicado) return NextResponse.json({ error: "Este aviso já não está por aplicar." }, { status: 409 });

    const quem = colab?.nome ?? "a CLYON";
    // Só pega num aviso ainda por aplicar (a guarda está no UPDATE).
    const feito = await dispensarAviso(a.id, notaDaDispensa(quem, lido.pedido.motivo));
    if (!feito) return NextResponse.json({ error: "Este aviso já não está por aplicar." }, { status: 409 });

    const frase = fraseDaDispensa(a, { quem, motivo: lido.pedido.motivo });
    const p = a.pagamentoId ? await pagamentoPorId(a.pagamentoId).catch(() => null) : null;
    if (p) {
      await appendOrderHistory(p.pedidoId, {
        type: "note",
        by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
        message: frase,
      });
    }
    await registarSemFalhar({
      acontecimento: "aviso_dispensado",
      pedidoId: p?.pedidoId ?? null,
      negociacaoId: p?.negociacaoId ?? null,
      providerId: p?.providerId ?? null,
      autorTipo: "clyon",
      autorNome: quem,
      resumo: frase,
      valor: a.valor,
      detalhe: {
        avisoId: a.id,
        trid: a.trid,
        estado: a.estado,
        pagamentoId: a.pagamentoId,
        notaAntes: a.nota,
        motivo: lido.pedido.motivo,
      },
    });

    return NextResponse.json({ ok: true, feito: frase });
  } catch (e) {
    console.error("[admin/pagamentos/dispensar-aviso]", e);
    return NextResponse.json({ error: "Não foi possível dispensar o aviso." }, { status: 500 });
  }
}
