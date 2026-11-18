import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { diasGravadosDoPedido, gravarDiasDoPedido } from "@/lib/varios-dias-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «VÁRIOS DIAS» DE UM PEDIDO — d64 (18-11-2026). GET lê a lista; POST grava-a
 * (`{ dias: [{ inicio: "AAAA-MM-DDTHH:MM" (Lisboa), cargasPrevistas? }] }`).
 * O primeiro dia passa a ser o dia do pedido e o dia combinado de quem tem o
 * trabalho. Ver `varios-dias.ts`.
 */
function idDe(cru: string): number | null {
  const id = Number(cru);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const id = idDe((await params).id);
  if (!id) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    return NextResponse.json({ dias: await diasGravadosDoPedido(id) });
  } catch (e) {
    console.error("[admin/varios-dias GET]", e);
    return NextResponse.json({ error: "Não foi possível ler os dias." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const id = idDe((await params).id);
  if (!id) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  let corpo: { dias?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const r = await gravarDiasDoPedido(id, corpo.dias, colab?.nome?.trim() || "a CLYON");
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true, dias: r.dias });
  } catch (e) {
    console.error("[admin/varios-dias POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar os dias." }, { status: 500 });
  }
}
