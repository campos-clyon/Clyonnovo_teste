import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { resumoDoBackoffice } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O resumo do Início — o que precisa de si, hoje.
 *
 * UMA CHAMADA, E NÃO SETE. O ecrã quer nove números que vivem em seis
 * tabelas; pedi-los um a um seria sete idas ao servidor para desenhar uma
 * página que se olha durante dez segundos. Aqui vão todos juntos, em
 * consultas paralelas.
 *
 * Ver `resumoDoBackoffice` em db.ts para o que cada número conta — e porque é
 * que um que falhe devolve null em vez de rebentar com a página.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json(await resumoDoBackoffice());
  } catch (e) {
    console.error("[admin/resumo]", e);
    return NextResponse.json({ error: "Não foi possível carregar o resumo." }, { status: 500 });
  }
}
