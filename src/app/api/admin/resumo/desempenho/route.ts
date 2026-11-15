import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { desempenhoDe, filtroValido } from "@/lib/desempenho";
import { linhasDoDesempenho } from "@/lib/desempenho-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O DESEMPENHO DO INÍCIO — d41, 15-11-2026.
 *
 * Debaixo de /api/admin/resumo de propósito: quem vê o Início (o
 * administrador, e o assistente com a secção Início) vê isto, pela mesma regra
 * (`SECCOES_QUE_ABREM`). Agrega no servidor, com 5 minutos de cache
 * (`desempenho-na-base.ts`); `?servico=` filtra por um dos quatro grupos.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const filtro = filtroValido(req.nextUrl.searchParams.get("servico"));
    const linhas = await linhasDoDesempenho();
    return NextResponse.json(desempenhoDe(linhas, { filtro }), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    console.error("[admin/resumo/desempenho]", e);
    return NextResponse.json({ error: "Não foi possível carregar o desempenho." }, { status: 500 });
  }
}
