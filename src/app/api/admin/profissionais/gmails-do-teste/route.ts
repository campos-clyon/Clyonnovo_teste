import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { gmailsParaOTeste } from "@/lib/app-pro-no-telemovel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS GMAILS PARA PÔR NO TESTE DA CLYON PRO — 27-10-2026.
 *
 * Debaixo de /api/admin/profissionais/, e por isso só para quem tem a secção
 * Profissionais (papel-do-painel.ts). A lista geral dos profissionais, que os
 * Trabalhos CLYON também lêem, não leva estes endereços.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ gmails: await gmailsParaOTeste() });
  } catch (e) {
    console.error("[admin/profissionais/gmails-do-teste]", e);
    return NextResponse.json({ error: "Não consegui ler a lista." }, { status: 500 });
  }
}
