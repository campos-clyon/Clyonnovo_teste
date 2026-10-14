import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { tudoDaGestora } from "@/lib/financas-na-base";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A GESTORA DE CONTAS DA CLYON — tudo o que o ecrã precisa, de uma vez: as
 * contas, as categorias, os movimentos lançados à mão e os da plataforma.
 * Ver `financas.ts`.
 *
 * Quem tiver a secção das Carteiras vê — decisão do dono, 14-10-2026. O `hoje`
 * vai de cá, em Lisboa: o «saldo de hoje» não pode depender do relógio de
 * quem abre o ecrã.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const tudo = await tudoDaGestora();
    return NextResponse.json({ ...tudo, hoje: diaEmLisboa(new Date()) });
  } catch (e) {
    console.error("[admin/financas GET]", e);
    return NextResponse.json({ error: "Não foi possível ler as finanças." }, { status: 500 });
  }
}
