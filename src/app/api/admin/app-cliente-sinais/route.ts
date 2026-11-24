import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { DIAS_DOS_SINAIS } from "@/lib/sinais-da-app-de-cliente";
import { sinaisParaOBackoffice } from "@/lib/sinais-da-app-de-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/app-cliente-sinais — 24-11-2026 (d108). Para Contas ›
 * Programa da app: as primeiras aberturas da app de cliente (sem
 * identificador) ao lado das aberturas com sessão, e o «Algo não funciona?»
 * dos últimos 30 dias. Só o administrador (`requireAdminGeral`, como o resto
 * do Programa da app): os problemas podem trazer o email da conta.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const r = await sinaisParaOBackoffice(DIAS_DOS_SINAIS);
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/app-cliente-sinais]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler os sinais da app." }, { status: 500 });
  }
}
