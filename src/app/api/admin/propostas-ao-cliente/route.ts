import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  ensaioDasPropostas,
  interruptorDasPropostas,
  mudarInterruptorDasPropostas,
} from "@/lib/envio-das-propostas-ao-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «ENVIAR AS PROPOSTAS AO CLIENTE», NAS CONFIGS — d88, 23-11-2026.
 *
 * GET: o interruptor e o ENSAIO — os pedidos com propostas por enviar (só o
 * número e quantas), com o que a Vitória faria a cada um: enviaria já, a que
 * horas, ou porque fica com uma pessoa. Só lê.
 *
 * POST: liga ou desliga. LIGADO POR OMISSÃO (o dono pediu). Só o
 * administrador; para LIGAR outra vez escreve-se «LIGAR». A mudança e quem a
 * fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const ensaio = await ensaioDasPropostas(new Date());
    return NextResponse.json({ ...(await interruptorDasPropostas()), ensaio });
  } catch (e) {
    console.error("[admin/propostas-ao-cliente]", e);
    return NextResponse.json({ ...(await interruptorDasPropostas()), ensaio: null });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown; confirmacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof corpo.ligar !== "boolean") {
    return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
  }
  if (corpo.ligar && String(corpo.confirmacao ?? "").trim().toUpperCase() !== "LIGAR") {
    return NextResponse.json({ error: "Para ligar, escreva LIGAR." }, { status: 400 });
  }
  try {
    return NextResponse.json(await mudarInterruptorDasPropostas(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/propostas-ao-cliente POST]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
