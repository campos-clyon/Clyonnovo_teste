import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDoEnvioAutomatico, mudarInterruptorDoEnvioAutomatico } from "@/lib/envio-automatico-aos-parceiros-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «ENVIO AUTOMÁTICO AOS PARCEIROS» — d87, 22-11-2026.
 *
 * LIGADO POR OMISSÃO (o dono pediu): os pedidos que a Vitória deixa completos
 * seguem sozinhos para os parceiros, com todas as condições de
 * `envio-automatico-aos-parceiros.ts`. Desligar deixa tudo nos «por enviar»
 * como antes, e os cartões dizem «enviaria a …». Só o administrador
 * (`requireAdminGeral`). A mudança e quem a fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDoEnvioAutomatico());
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof corpo.ligar !== "boolean") {
    return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
  }
  try {
    return NextResponse.json(await mudarInterruptorDoEnvioAutomatico(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/interruptor-do-envio-automatico]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
