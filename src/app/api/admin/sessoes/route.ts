import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { marcaValida } from "@/lib/sessoes-do-backoffice";
import { sessoesParaOAdministrador } from "@/lib/sessoes-do-backoffice-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sessoes — 27-10-2026 (decisão d15).
 *
 * As sessões abertas no backoffice, por pessoa e por navegador, e as últimas
 * entradas. SÓ o administrador (`requireAdminGeral`; nem está na lista das
 * rotas do assistente).
 *
 * `?navegador=<marca>` — a marca do navegador de quem pede, para o cartão
 * dizer «este navegador».
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const meu = req.nextUrl.searchParams.get("navegador");
  try {
    const dados = await sessoesParaOAdministrador(marcaValida(meu) ? meu : null);
    return NextResponse.json({ ...dados, agora: new Date().toISOString() });
  } catch (error) {
    console.error("[admin/sessoes GET]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível ler as sessões." }, { status: 500 });
  }
}
