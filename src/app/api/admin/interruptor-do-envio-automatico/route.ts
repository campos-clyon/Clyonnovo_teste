import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  interruptorDoEnvioAutomatico,
  mudarInterruptorDoEnvioAutomatico,
  mudarSoOsDaVitoria,
  soOsDaVitoria,
} from "@/lib/envio-automatico-aos-parceiros-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «ENVIO AUTOMÁTICO AOS PARCEIROS» — d87, 22-11-2026.
 *
 * LIGADO POR OMISSÃO (o dono pediu): os pedidos completos seguem sozinhos para
 * os parceiros, com todas as condições de `envio-automatico-aos-parceiros.ts`.
 * Desde 23-11-2026 (d88) vale para TODAS as origens — simulador, formulário,
 * WhatsApp e registado na Mesa —, e a segunda chave «Só os da Vitória»
 * (desligada por omissão) volta ao comportamento da d87. Desligar o primeiro
 * deixa tudo nos «por enviar» como antes, e os cartões dizem «enviaria a …».
 * Só o administrador (`requireAdminGeral`). Cada mudança e quem a fez ficam no
 * registo permanente.
 */
async function osDois() {
  const [principal, soDaVitoria] = await Promise.all([interruptorDoEnvioAutomatico(), soOsDaVitoria()]);
  return { ...principal, soDaVitoria };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await osDois());
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown; soDaVitoria?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const quem = colab?.nome?.trim() || "administrador";
  try {
    if (typeof corpo.soDaVitoria === "boolean") {
      await mudarSoOsDaVitoria(corpo.soDaVitoria, quem);
      return NextResponse.json(await osDois());
    }
    if (typeof corpo.ligar !== "boolean") {
      return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
    }
    await mudarInterruptorDoEnvioAutomatico(corpo.ligar, quem);
    return NextResponse.json(await osDois());
  } catch (e) {
    console.error("[admin/interruptor-do-envio-automatico]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
