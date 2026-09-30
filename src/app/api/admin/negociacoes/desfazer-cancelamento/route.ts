import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { appendOrderHistory, registarSemFalhar, reabrirPedidoCancelado } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DESFAZER UM CANCELAMENTO — o pedido volta a como estava.
 *
 * «Esse pedido está nos cancelados por engano, como restauro ele?» —
 * 30-09-2026, sobre o #320: nove profissionais, três propostas, e um botão de
 * cancelar carregado quando não devia. Cancelar era a única acção desta mesa
 * sem caminho de volta; a regra de como se volta está em
 * `reabrirPedidoCancelado`.
 *
 * FICA ESCRITO, como o cancelamento ficou: quem desfez, e o que voltou e em
 * que estado. Quando o estado teve de ser deduzido — cancelamentos anteriores
 * a haver memória deles —, a frase di-lo, para quem ler o histórico saber que
 * é uma reconstrução e não uma cópia.
 */
const EM_PALAVRAS: Record<string, string> = {
  aberta: "a negociar",
  aguarda_contratacao: "à espera de o cliente contratar",
  acordada: "fechada",
  desistida: "recusada",
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const r = await reabrirPedidoCancelado(pedidoId);
    if (!r.ok) {
      return r.porque === "nao_existe"
        ? NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
        : NextResponse.json({ error: "Este pedido não está cancelado." }, { status: 409 });
    }

    const porQuem = colab?.nome ?? "a equipa";
    const lista = r.reabertas
      .map((n) => `${n.profissionalNome || `negociação #${n.negociacaoId}`} (${EM_PALAVRAS[n.estado] ?? n.estado})`)
      .join(", ");
    const resumo =
      `Cancelamento desfeito por CLYON (${porQuem}). ` +
      (r.reabertas.length > 0
        ? `${r.reabertas.length} ${r.reabertas.length === 1 ? "negociação voltou" : "negociações voltaram"}: ${lista}.`
        : "Não havia negociações para repor.") +
      (r.reconstruido && r.reabertas.length > 0
        ? " O estado de cada uma foi deduzido das propostas — o cancelamento era anterior a ficar guardado."
        : "");

    await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "pedido_reaberto",
      pedidoId,
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: "cancelado",
      estadoDepois: r.statusDeVolta,
      resumo: resumo.slice(0, 500),
    });

    return NextResponse.json({ ...r, resumo });
  } catch (error) {
    console.error("[api/admin/negociacoes/desfazer-cancelamento]", error);
    return NextResponse.json({ error: "Não foi possível reabrir o pedido." }, { status: 500 });
  }
}
