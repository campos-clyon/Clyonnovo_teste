import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { gravarCargasDoDia } from "@/lib/varios-dias-na-base";
import { cargasFeitasNoTotal } from "@/lib/varios-dias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS CARGAS DE CADA DIA — d64 (18-11-2026). Num trabalho em vários dias, o
 * profissional regista quantas cargas fez em cada dia (`{ negociacaoId, dia:
 * "AAAA-MM-DD", cargas }`); o total sai no fim. Só num trabalho dele, ainda
 * por dar por feito. Painel web e app CLYON Pro.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  let corpo: { negociacaoId?: unknown; dia?: unknown; cargas?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const cargas = Number(String(corpo.cargas ?? "").replace(",", "."));
  try {
    const r = await gravarCargasDoDia(negociacaoId, sessao.providerId, String(corpo.dia ?? ""), cargas);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true, dias: r.dias, cargasFeitasNoTotal: cargasFeitasNoTotal(r.dias) });
  } catch (e) {
    console.error("[profissionais/cargas-do-dia]", e);
    return NextResponse.json({ error: "Não foi possível gravar as cargas." }, { status: 500 });
  }
}
