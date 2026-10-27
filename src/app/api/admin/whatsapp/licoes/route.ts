import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { painelDaSemana } from "@/lib/licoes-da-vitoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS LIÇÕES DA VITÓRIA, no backoffice — 27-10-2026 (decisão d11).
 *
 * GET: as lições (as por rever primeiro), quantas estão por rever, o painel
 * da semana (esta contra a anterior, em hora de Lisboa) e as últimas
 * passagens da rotina. POST: aprovar, corrigir ou recusar uma lição.
 *
 * Só para quem tem a secção WhatsApp: a rota fica debaixo de
 * `/api/admin/whatsapp`, que `papel-do-painel.ts` só abre a essa secção.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const base = await import("@/lib/licoes-da-vitoria-na-base");
    const [licoes, mensagens, passagens] = await Promise.all([
      base.listarLicoes(300),
      base.mensagensParaOPainel().catch(() => []),
      base.ultimasPassagens("licoes-da-vitoria", 3),
    ]);
    const painel = painelDaSemana(
      mensagens,
      licoes.map((l) => ({ estado: l.estado, revistaEm: l.revistaEm ? new Date(l.revistaEm) : null })),
    );
    const porRever = licoes.filter((l) => l.estado === "por_rever").length;
    return NextResponse.json({ licoes, porRever, painel, passagens });
  } catch (e) {
    console.error("[admin/whatsapp/licoes GET]", e);
    return NextResponse.json({ error: "As lições não carregaram." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { id?: unknown; accao?: unknown; resposta?: unknown; pergunta?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const id = Number(corpo.id);
  const accao = String(corpo.accao ?? "");
  if (!Number.isInteger(id) || id <= 0 || !["aprovar", "corrigir", "recusar"].includes(accao)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const { decidirLicao } = await import("@/lib/licoes-da-vitoria-na-base");
    const r = await decidirLicao(
      id,
      accao === "corrigir"
        ? {
            accao: "corrigir",
            resposta: String(corpo.resposta ?? ""),
            pergunta: typeof corpo.pergunta === "string" ? corpo.pergunta : undefined,
          }
        : { accao: accao as "aprovar" | "recusar" },
      colab?.nome ?? "backoffice",
    );
    if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: 422 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/whatsapp/licoes POST]", e);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
