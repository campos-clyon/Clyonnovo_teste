import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { pedidosComNegociacoes } from "@/lib/db";

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
