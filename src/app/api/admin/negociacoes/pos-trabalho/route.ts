import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { fecharOPosTrabalho, lerPosTrabalhoDosPedidos } from "@/lib/pos-trabalho-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEPOIS DO TRABALHO — d147 (27-11-2026, dono). Nos Concluídos «por ver»: a
 * pergunta de pós-trabalho e a resposta do cliente, lidas da conversa do
 * WhatsApp (GET `?ids=1,2`), e o fecho do «por ver» (POST). Na Mesa e nos
 * Trabalhos CLYON. Só o número do pedido, as datas e os textos da conversa.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const ids = String(req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return NextResponse.json({ itens: [] });
  try {
    const itens = await lerPosTrabalhoDosPedidos(ids);
    return NextResponse.json(
      {
        itens: itens.map((i) => ({
          pedidoId: i.pedidoId,
          canal: i.canal,
          pergunta: i.pergunta ? { texto: i.pergunta.texto, em: i.pergunta.em.toISOString() } : null,
          resposta: i.resposta ? { texto: i.resposta.texto, em: i.resposta.em.toISOString() } : null,
          estrelas: i.estrelas,
          comoDisse: i.comoDisse,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/negociacoes/pos-trabalho]", e instanceof Error ? e.message : e);
    return NextResponse.json({ itens: [], error: "Não foi possível ler a conversa." }, { status: 500 });
  }
}

/** `{ pedidoId, accao: "guardada" | "sem_resposta" }` — tira o «por ver». «sem_resposta» deixa só uma nota interna. */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = (await req.json().catch(() => null)) as { pedidoId?: unknown; accao?: unknown } | null;
  const pedidoId = Number(corpo?.pedidoId);
  const accao = corpo?.accao;
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Falta o número do pedido." }, { status: 400 });
  }
  if (accao !== "guardada" && accao !== "sem_resposta") {
    return NextResponse.json({ error: "Falta dizer como se fecha." }, { status: 400 });
  }
  try {
    await fecharOPosTrabalho(pedidoId, accao, colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/negociacoes/pos-trabalho] fechar", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível fechar." }, { status: 500 });
  }
}
