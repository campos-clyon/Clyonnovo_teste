import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDaValidade, mudarInterruptorDaValidade } from "@/lib/validade-do-orcamento-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «VALIDADE DOS ORÇAMENTOS» — d62, 18-11-2026.
 *
 * DESLIGADO POR OMISSÃO: são mensagens automáticas a clientes e fechos de
 * pedidos. Só o administrador (`requireAdminGeral`), e para LIGAR escreve-se
 * «LIGAR». A mudança e quem a fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDaValidade());
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
    return NextResponse.json(await mudarInterruptorDaValidade(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/interruptor-da-validade]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
