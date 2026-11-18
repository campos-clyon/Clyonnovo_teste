import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { contasDeDestino, guardarContasDeDestino } from "@/lib/contas-de-destino-na-base";
import { lerContasDeDestino, MAXIMO_DE_CONTAS_DE_DESTINO } from "@/lib/contas-de-destino";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CONFIGS → «CONTAS ONDE ENTRAM AS TRANSFERÊNCIAS» — d66 (18-11-2026).
 *
 * LER: as Configs, os Pagamentos e as Carteiras (quem regista ou vê de onde
 * veio o dinheiro). MUDAR: só o administrador — é para onde vai o dinheiro.
 * Só nomes e os últimos 4 dígitos; o IBAN inteiro é recusado
 * (`lerContasDeDestino`).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  return NextResponse.json({ contas: await contasDeDestino(), maximo: MAXIMO_DE_CONTAS_DE_DESTINO });
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { contas?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const lido = lerContasDeDestino(corpo.contas);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  if (lido.contas.length === 0) {
    return NextResponse.json({ error: "Deixe pelo menos uma conta: as transferências dizem sempre onde entraram." }, { status: 400 });
  }
  try {
    await guardarContasDeDestino(lido.contas, colab?.nome ?? "a CLYON");
    return NextResponse.json({ ok: true, contas: lido.contas });
  } catch (e) {
    console.error("[admin/contas-de-destino PUT]", e);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
