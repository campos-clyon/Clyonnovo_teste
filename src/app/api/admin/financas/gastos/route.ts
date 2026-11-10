import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { lerGasto, mesValido, reactivar, suspender } from "@/lib/financas-gastos";
import { criarGasto, eliminarGasto, gastoPorId, guardarPausas, mudarGasto } from "@/lib/financas-gastos-na-base";
import { categoriasDaGestora } from "@/lib/financas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS GASTOS DA CLYON — 07-11-2026 (d21). Criar, mudar, suspender e reactivar
 * é de quem tiver a secção das Finanças, como os movimentos; ELIMINAR é só do
 * administrador, como em todo o backoffice. Ver `financas-gastos.ts`.
 *
 *   POST   { nome, valor, tipo, inicio | dia, categoriaId?, notas? } — novo
 *   PATCH  { id, ...os mesmos }                                      — mudar
 *   PATCH  { id, accao: "suspender" | "reactivar", desde: "YYYY-MM" } — pausa
 *   DELETE ?id=…                                                      — eliminar
 */

async function corpoDe(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const idDe = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  if (!corpo) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const lido = lerGasto(corpo, await categoriasDaGestora());
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
    const id = await criarGasto(lido.dados, colab?.nome ?? "CLYON");
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin/financas/gastos POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  const id = idDe(corpo?.id);
  if (!corpo || id == null) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const quem = colab?.nome ?? "CLYON";
  try {
    if (corpo.accao === "suspender" || corpo.accao === "reactivar") {
      if (!mesValido(corpo.desde)) return NextResponse.json({ error: "Escolha o mês." }, { status: 400 });
      const g = await gastoPorId(id);
      if (!g) return NextResponse.json({ error: "Este gasto já não existe." }, { status: 404 });
      const pausas = corpo.accao === "suspender" ? suspender(g, corpo.desde) : reactivar(g, corpo.desde);
      await guardarPausas(id, pausas, quem);
      return NextResponse.json({ ok: true });
    }
    const lido = lerGasto(corpo, await categoriasDaGestora());
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
    const feito = await mudarGasto(id, lido.dados, quem);
    if (!feito) return NextResponse.json({ error: "Este gasto já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/financas/gastos PATCH]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const id = idDe(req.nextUrl.searchParams.get("id"));
  if (id == null) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const feito = await eliminarGasto(id);
    if (!feito) return NextResponse.json({ error: "Este gasto já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/financas/gastos DELETE]", e);
    return NextResponse.json({ error: "Não foi possível eliminar." }, { status: 500 });
  }
}
