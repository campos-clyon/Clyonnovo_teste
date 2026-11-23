import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { medirOEspaco, relatorioDaPurga } from "@/lib/espaco-da-base-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O ESPAÇO DA BASE — d1 (CEO e dono, 23-11-2026). Só leitura, só do
 * administrador: o que cada tabela ocupa (as cinco maiores e o total) e o que a
 * purga dos 60 dias e a anonimização já deviam ter tirado (contagens e MB dos
 * campos grandes — nunca dados de pessoas). Nada aqui apaga ou escreve.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const [espaco, purga] = await Promise.all([medirOEspaco(), relatorioDaPurga()]);
    return NextResponse.json({ espaco, purga });
  } catch (e) {
    console.error("[admin/rotinas/espaco GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível medir o espaço da base." }, { status: 500 });
  }
}
