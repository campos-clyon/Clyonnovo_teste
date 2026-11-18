import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { lembrarAgora, validadeNaMesa } from "@/lib/validade-do-orcamento-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A VALIDADE DOS ORÇAMENTOS NA MESA — d62, 18-11-2026.
 *
 * GET: o passo de cada pedido com o orçamento no cliente («orçamento enviado
 * 17/11 · lembrete 1 a 18/11 · … · fecha a 21/11 às 18h», ou «fecharia» com o
 * interruptor desligado). POST `{ pedidoId }`: o «Lembrar agora» — o próximo
 * lembrete, já, uma vez (só com o interruptor ligado).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json(await validadeNaMesa(new Date()));
  } catch (e) {
    console.error("[admin/validade-dos-orcamentos GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler a validade dos orçamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { pedidoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const r = await lembrarAgora(pedidoId, colab?.nome?.trim() || "a CLYON", new Date());
    if (!r.ok) return NextResponse.json({ error: r.porque }, { status: 409 });
    return NextResponse.json({ ok: true, feito: `#${pedidoId}: ${r.feito}` });
  } catch (e) {
    console.error("[admin/validade-dos-orcamentos POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível enviar o lembrete." }, { status: 500 });
  }
}
