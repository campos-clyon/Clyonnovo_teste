import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { avaliacoesAoClienteDoPedido, removerAvaliacaoAoCliente } from "@/lib/avaliacoes-do-cliente";

export const runtime = "nodejs";

/**
 * As avaliações que os parceiros deram ao cliente deste pedido — 01-11-2026
 * (decisão do dono). Ver e remover, SÓ o administrador: um assistente não
 * apaga o que um parceiro escreveu. Remover fica no registo permanente
 * (`removerAvaliacaoAoCliente`).
 *
 * GET    → { avaliacoes: [...] }
 * DELETE ?avaliacao=<id> → { ok: true }
 */
function idDoPedido(texto: string): number | null {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const pedidoId = idDoPedido((await params).id);
  if (!pedidoId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    return NextResponse.json({ avaliacoes: await avaliacoesAoClienteDoPedido(pedidoId) });
  } catch (e) {
    console.error("[avaliacao-ao-cliente] GET", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não deu para ler as avaliações." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  const pedidoId = idDoPedido((await params).id);
  const avaliacaoId = idDoPedido(req.nextUrl.searchParams.get("avaliacao") ?? "");
  if (!pedidoId || !avaliacaoId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const removida = await removerAvaliacaoAoCliente({ avaliacaoId, pedidoId, quem: colab?.nome || "Administrador" });
    if (!removida) return NextResponse.json({ error: "Esta avaliação já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[avaliacao-ao-cliente] DELETE", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não deu para remover a avaliação." }, { status: 500 });
  }
}
