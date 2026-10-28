import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { resumoDosErrosDasApps } from "@/lib/db";
import { DIAS_DOS_ERROS } from "@/lib/erros-da-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS ERROS DA APP CLYON PRO, PARA A EQUIPA — 25-10-2026.
 *
 * Quantos houve nos últimos 7 dias e os mais recentes, agrupados (o mesmo
 * erro no mesmo ecrã e na mesma versão conta-se uma vez, com as vezes ao
 * lado). Mostra-se no separador «Erros da app» da secção Profissionais.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    // As duas apps, com a app de cada grupo (S3, 28-10-2026).
    return NextResponse.json({ dias: DIAS_DOS_ERROS, ...(await resumoDosErrosDasApps(DIAS_DOS_ERROS)) });
  } catch (e) {
    console.error("[admin/profissionais/erros-da-app]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui ler os erros da app." }, { status: 500 });
  }
}
