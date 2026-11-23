import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { oQueFaltaParaSeguirJa } from "@/lib/falta-para-seguir-no-simulador";

export const runtime = "nodejs";

/**
 * POST /api/simulador/o-que-falta — { order, ficheiros } → { faltam: string[] }
 *
 * d3, 23-11-2026. O passo 3 do simulador diz, sem bloquear nada, o que falta
 * para o pedido seguir já para os parceiros. Só lê: não grava nada, não envia
 * nada, e o corpo traz o pedido SEM as fotografias (só quantas são).
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "simulador-o-que-falta", 120, 300);
  if (limite.erro) return limite.erro;
  const bruto = await req.text().catch(() => "");
  if (!bruto || bruto.length > 60_000) return NextResponse.json({ faltam: [] }, { status: 400 });
  try {
    const corpo = JSON.parse(bruto) as { order?: unknown; ficheiros?: unknown };
    const order = corpo?.order;
    if (!order || typeof order !== "object" || Array.isArray(order)) return NextResponse.json({ faltam: [] }, { status: 400 });
    const ficheiros = typeof corpo.ficheiros === "number" ? corpo.ficheiros : 0;
    return NextResponse.json({ faltam: oQueFaltaParaSeguirJa(order as Record<string, unknown>, ficheiros) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ faltam: [] }, { status: 400 });
  }
}
