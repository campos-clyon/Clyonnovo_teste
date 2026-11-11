import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { listaDeParceirosNasMudancasLigada } from "@/lib/db";
import { lerPedidoDaLista, listaDosParceirosDaMudanca, respostaDaLista } from "@/lib/parceiros-da-mudanca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantas vezes por dia a mesma máquina pode ver a lista (11-11-2026). */
const LISTAS_POR_DIA = 100;

/**
 * OS PARCEIROS DISPONÍVEIS PARA UMA MUDANÇA — 10-11-2026 (fase 2).
 *
 * Pública (quem pede uma mudança ainda não tem conta), com dois limites por IP
 * (de 5 em 5 minutos e por dia): cada chamada pergunta percursos ao Google, e
 * quem preenche um pedido não precisa de a chamar centenas de vezes. O
 * simulador do site e a app de cliente chamam ESTA rota, e o pedido
 * (`/api/simulador/pedido`) volta a fazer a mesma lista para conferir a
 * escolha — e é só aí que a forma de pagamento conta.
 *
 * Com o interruptor das Configs desligado, responde `ligado: false` e o
 * simulador segue pelo caminho de antes (o pedido vai à Mesa).
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "mudancas-parceiros", 20, 300);
  if (limite.erro) return limite.erro;
  const porDia = await limitarRotaPublica(req, "mudancas-parceiros-dia", LISTAS_POR_DIA, 86400);
  if (porDia.erro) return porDia.erro;

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
    const r = await listaDosParceirosDaMudanca(lido.pedido, new Date(), undefined, { comNotaDoGoogle: true });
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
