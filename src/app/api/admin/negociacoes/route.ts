import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { marcarConcluidoComoVisto, pedidosComNegociacoes } from "@/lib/db";

export const runtime = "nodejs";

/** Pedidos da plataforma e as negociações de cada um, para o painel. */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    return NextResponse.json({ pedidos: await pedidosComNegociacoes(30) });
  } catch (error) {
    console.error("[api/admin/negociacoes GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

/**
 * O carimbo de "já vi": um pedido concluído fica em destaque na mesa até o
 * admin o ABRIR — abrir é ver, e é o ecrã que o diz, não um botão à parte.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; pedidoId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.accao !== "concluido_visto" || !Number.isInteger(Number(corpo.pedidoId))) {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  await marcarConcluidoComoVisto(Number(corpo.pedidoId));
  return NextResponse.json({ ok: true });
}
