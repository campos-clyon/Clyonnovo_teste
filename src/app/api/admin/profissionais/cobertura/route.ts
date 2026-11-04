import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { coberturaNaBase } from "@/lib/cobertura-na-base";

export const runtime = "nodejs";

/**
 * A COBERTURA POR CONCELHO — 04-11-2026 (d16, Fase A). Só leitura: o quadro da
 * secção Profissionais. Números agregados, sem nomes nem contactos. A conta
 * está em `cobertura-por-concelho.ts`.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json(await coberturaNaBase());
  } catch (e) {
    console.error("[api/admin/profissionais/cobertura]", e);
    return NextResponse.json({ error: "Não foi possível calcular a cobertura." }, { status: 500 });
  }
}
