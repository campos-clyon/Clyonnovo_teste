import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { listaDeParceirosNasMudancasLigada } from "@/lib/db";
import { lerPedidoDaLista, listaDosParceirosDaMudanca, respostaDaLista } from "@/lib/parceiros-da-mudanca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS PARCEIROS DISPONÍVEIS PARA UMA MUDANÇA — 10-11-2026 (fase 2).
 *
 * Pública (quem pede uma mudança ainda não tem conta), com limite por IP: cada
 * chamada pergunta percursos ao Google. O simulador do site e a app de cliente
 * chamam ESTA rota, e o pedido (`/api/simulador/pedido`) volta a fazer a mesma
 * lista para conferir a escolha.
 *
 * Com o interruptor das Configs desligado, responde `ligado: false` e o
 * simulador segue pelo caminho de antes (o pedido vai à Mesa).
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "mudancas-parceiros", 20, 300);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  if (!(await listaDeParceirosNasMudancasLigada())) {
    return NextResponse.json({ ok: true, ligado: false, parceiros: [] });
  }

  const lido = lerPedidoDaLista(corpo);
  if (!lido.ok) return NextResponse.json({ ok: false, error: lido.erro }, { status: 400 });

  try {
    const r = await listaDosParceirosDaMudanca(lido.pedido);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.erro }, { status: 422 });
    return NextResponse.json(respostaDaLista(lido.pedido, r), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[mudancas/parceiros]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Não foi possível ver os parceiros agora. Pode enviar o pedido na mesma." },
      { status: 500 },
    );
  }
}
