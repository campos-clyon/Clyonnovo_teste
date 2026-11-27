import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { trabalhosSemDiaParaAMesa } from "@/lib/trabalho-sem-dia-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS TRABALHOS SEM DIA — d138 (27-11-2026). Para o «Precisa de si» da Mesa:
 * os contratados por fazer sem dia (ou sem hora) marcado, há quantos dias, do
 * mais antigo para o mais recente. Só números — o resto está no cartão.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ trabalhos: await trabalhosSemDiaParaAMesa() });
  } catch (e) {
    console.error("[api/admin/trabalhos-sem-dia]", e);
    return NextResponse.json({ error: "Não foi possível ler os trabalhos sem dia." }, { status: 500 });
  }
}
