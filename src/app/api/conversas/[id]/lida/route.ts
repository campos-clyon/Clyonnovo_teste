import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { quemPedeAConversa } from "@/lib/quem-pede-a-conversa";
import { conversaPorId, marcarLida } from "@/lib/conversas-na-base";
import { chaveDeLeitura, idDaConversa, pertenceAConversa } from "@/lib/conversas-da-clyon";

export const runtime = "nodejs";

/** POST /api/conversas/[id]/lida — marca como lido até agora, só para quem pertence à conversa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "conversas-lida", 240, 300);
  if (limite.erro) return limite.erro;
  const id = idDaConversa((await params).id);
  try {
    const quem = await quemPedeAConversa(req);
    if (!quem) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const c = id ? await conversaPorId(id) : null;
    if (!c || !pertenceAConversa(c, quem)) {
      return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });
    }
    await marcarLida(c.id, chaveDeLeitura(quem));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conversas/lida]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível marcar como lida." }, { status: 500 });
  }
}
