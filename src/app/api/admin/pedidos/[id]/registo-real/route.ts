import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { gravarRegistoReal, registoRealDoPedido } from "@/lib/registo-real-na-base";
import { horasFeitas, registoRealEmPalavras } from "@/lib/registo-real";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O REGISTO REAL DE UM PEDIDO — d67 (18-11-2026). GET lê-o; POST grava-o
 * (`{ dias: [{ dia: "AAAA-MM-DD", inicio: "13:00", fim: "19:00", pausa: "1 h" }] }`,
 * hora de Lisboa; `[]` apaga). Só a equipa (admin e assistentes).
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
    const dias = await registoRealDoPedido(id);
    return NextResponse.json({ dias, horas: horasFeitas(dias), texto: registoRealEmPalavras(dias) || null });
  } catch (e) {
    console.error("[admin/registo-real GET]", e);
    return NextResponse.json({ error: "Não foi possível ler o registo." }, { status: 500 });
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
    const r = await gravarRegistoReal(id, corpo.dias, colab?.nome?.trim() || "a CLYON");
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true, dias: r.dias, horas: r.horas, texto: registoRealEmPalavras(r.dias) || null });
  } catch (e) {
    console.error("[admin/registo-real POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar o registo." }, { status: 500 });
  }
}
