import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDoSeguimento, mudarInterruptorDoSeguimento } from "@/lib/seguimento-do-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «SEGUIMENTO DO CLIENTE» — d83, 21-11-2026.
 *
 * LIGADO POR OMISSÃO: só entram os pedidos que a equipa marca à mão com «Falei
 * com o cliente». Desligar pára tudo (nada sai e nada fecha; a Mesa mostra
 * «enviaria a …»). Só o administrador (`requireAdminGeral`). A mudança e quem
 * a fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDoSeguimento());
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
    return NextResponse.json(await mudarInterruptorDoSeguimento(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/interruptor-do-seguimento]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
