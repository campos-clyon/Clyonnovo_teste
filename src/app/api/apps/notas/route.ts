import { NextRequest, NextResponse } from "next/server";
import { eAppComNotas, notaDaAtualizacao } from "@/lib/notas-das-apps";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * O QUE A ATUALIZAÇÃO TRAZ — d23, 13-11-2026.
 *
 * GET /api/apps/notas?app=pro|cliente&update=<updateId>
 * → `{ app, id, nota, exacta }`; sem notas dessa app, 404 `{ nota: null }`.
 *
 * Pública e só de leitura: a app pede-a antes de reiniciar (a atualização
 * que vai entrar) e depois (o cartão «O que há de novo»), com ou sem sessão.
 * Não lê a base nem guarda nada de quem pede — a lista vem de
 * src/lib/notas-das-apps.json. Um id que não se conhece dá a nota mais
 * recente (`exacta: false`). Cache curta: uma nota nova chega em minutos.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "apps-notas", 60, 600);
  if (limite.erro) return limite.erro;

  const app = req.nextUrl.searchParams.get("app");
  if (!eAppComNotas(app)) {
    return NextResponse.json({ error: "app tem de ser «pro» ou «cliente»." }, { status: 400 });
  }
  const r = notaDaAtualizacao(app, req.nextUrl.searchParams.get("update"));
  const cache = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" };
  if (!r) return NextResponse.json({ nota: null }, { status: 404, headers: cache });
  return NextResponse.json({ app, ...r }, { headers: cache });
}
