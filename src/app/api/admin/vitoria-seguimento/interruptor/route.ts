import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDoSeguimento, mudarInterruptorDoSeguimento } from "@/lib/seguimento-da-vitoria-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «VITÓRIA: MENSAGEM GENTIL A QUEM FICA CALADO» — d25 v2, 14-11-2026.
 *
 * DESLIGADO POR OMISSÃO: são mensagens a pessoas reais. Só o administrador
 * (`requireAdminGeral`), e para LIGAR escreve-se «LIGAR». A mudança e quem a
 * fez ficam no registo permanente, na mesma transacção.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDoSeguimento());
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
    return NextResponse.json(await mudarInterruptorDoSeguimento(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/vitoria-seguimento/interruptor]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
