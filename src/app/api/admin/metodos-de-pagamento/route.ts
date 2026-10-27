import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  guardarMetodosDePagamentoDaAdjudicacao,
  metodosDePagamentoDaAdjudicacao,
} from "@/lib/db";
import { MAXIMO_DOS_METODOS_DE_PAGAMENTO } from "@/lib/metodos-de-pagamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS MÉTODOS DE PAGAMENTO DA ADJUDICAÇÃO — ver e mudar. 27-10-2026.
 *
 * LER: quem prepara a mensagem de adjudicação — as Configs e a Mesa
 * (`requireAdmin` exige uma dessas secções, ver papel-do-painel.ts).
 * MUDAR: só o administrador (`requireAdminGeral`) — para onde vai o dinheiro
 * do cliente é dinheiro.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const metodos = await metodosDePagamentoDaAdjudicacao();
    return NextResponse.json({ metodos, maximo: MAXIMO_DOS_METODOS_DE_PAGAMENTO });
  } catch (error) {
    console.error("[admin/metodos-de-pagamento GET]", error);
    return NextResponse.json({ error: "Não foi possível ler os métodos de pagamento." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { metodos?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.metodos != null && typeof corpo.metodos !== "string") {
    return NextResponse.json({ error: "Escreva os métodos como texto." }, { status: 400 });
  }

  try {
    const metodos = await guardarMetodosDePagamentoDaAdjudicacao(corpo.metodos ?? "", colab?.nome ?? "a CLYON");
    return NextResponse.json({ ok: true, metodos });
  } catch (error) {
    console.error("[admin/metodos-de-pagamento PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
