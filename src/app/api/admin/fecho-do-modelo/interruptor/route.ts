import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDoEmailDoFecho, mudarInterruptorDoEmailDoFecho } from "@/lib/fecho-do-modelo-novo-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR DO EMAIL «O TRABALHO JÁ FOI FEITO?» — d15, 13-11-2026.
 *
 * DESLIGADO POR OMISSÃO. Só se liga quando o dono o confirmar na conversa com o
 * CEO. Só o administrador (`requireAdminGeral`), e para LIGAR escreve-se
 * «LIGAR». Mesmo ligado, nada sai antes de 15-11. A mudança e quem a fez ficam
 * no registo permanente, na mesma transacção.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDoEmailDoFecho());
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
    return NextResponse.json(await mudarInterruptorDoEmailDoFecho(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/fecho-do-modelo/interruptor]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
