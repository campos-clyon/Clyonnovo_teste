import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDaReserva, mudarInterruptorDaReserva } from "@/lib/reserva-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «RESERVA DO VALOR ÚNICO» — d101 (dono, 24-11-2026).
 *
 * DESLIGADO POR OMISSÃO e na dúvida: a reserva para imprevistos (d39) não se
 * grava e as já gravadas não contam. Ler: a equipa (a Mesa diz «reserva» só
 * com ela ligada). Mudar: só o administrador (`requireAdminGeral`), e para
 * LIGAR escreve-se «LIGAR». A mudança e quem a fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  return NextResponse.json(await interruptorDaReserva());
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
    return NextResponse.json(await mudarInterruptorDaReserva(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/reserva-do-valor-unico/interruptor]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
