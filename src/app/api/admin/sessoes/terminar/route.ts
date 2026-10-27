import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { marcaValida } from "@/lib/sessoes-do-backoffice";
import { terminarSessaoDoNavegador } from "@/lib/sessoes-do-backoffice-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sessoes/terminar — 27-10-2026 (decisão d15).
 *
 * «Terminar esta sessão»: os tokens desse navegador, dessa pessoa, passam a
 * ser recusados por `requireAdmin` — no batimento seguinte (até um minuto) o
 * navegador volta ao ecrã de entrada e tem de entrar de novo. SÓ o
 * administrador.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { colaboradorId?: unknown; navegadorId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const colaboradorId = Number(corpo.colaboradorId);
  if (!Number.isInteger(colaboradorId) || colaboradorId <= 0 || !marcaValida(corpo.navegadorId)) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  }

  try {
    const terminados = await terminarSessaoDoNavegador(colaboradorId, corpo.navegadorId, colab.nome);
    if (terminados === 0) {
      return NextResponse.json({ error: "Esta sessão já não existe." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, terminados });
  } catch (error) {
    console.error("[admin/sessoes/terminar]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível terminar a sessão." }, { status: 500 });
  }
}
