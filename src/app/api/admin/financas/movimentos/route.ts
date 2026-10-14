import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { lerMovimento } from "@/lib/financas";
import {
  apagarMovimento,
  categoriasDaGestora,
  contasDaGestora,
  idDoMovimento,
  lancarMovimento,
  mudarMovimento,
} from "@/lib/financas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LANÇAR, MUDAR E APAGAR UM MOVIMENTO À MÃO — a despesa, a receita e a
 * transferência da gestora de contas. Ver `financas.ts`.
 *
 * Lançar e mudar é de quem tiver a secção (decisão do dono, 14-10-2026);
 * apagar é do administrador, como em todo o backoffice. Os movimentos que vêm
 * da plataforma não se mexem aqui: corrigem-se onde nasceram, nos Pagamentos
 * ou nos Levantamentos.
 */

const DA_PLATAFORMA =
  "Este movimento vem da plataforma — corrige-se nos Pagamentos ou nos Levantamentos, e a gestora acompanha.";

async function corpoDe(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function validar(corpo: Record<string, unknown>) {
  const [contas, categorias] = await Promise.all([contasDaGestora(), categoriasDaGestora()]);
  return lerMovimento(corpo, contas, categorias);
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  if (!corpo) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const lido = await validar(corpo);
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
    const id = await lancarMovimento(lido.dados, colab?.nome ?? "CLYON");
    return NextResponse.json({ ok: true, id: `m${id}` });
  } catch (e) {
    console.error("[admin/financas/movimentos POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  if (!corpo) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const id = idDoMovimento(corpo.id);
  if (id == null) return NextResponse.json({ error: DA_PLATAFORMA }, { status: 409 });
  try {
    const lido = await validar(corpo);
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
    const feito = await mudarMovimento(id, lido.dados, colab?.nome ?? "CLYON");
    if (!feito) return NextResponse.json({ error: "Este movimento já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/financas/movimentos PATCH]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const id = idDoMovimento(req.nextUrl.searchParams.get("id"));
  if (id == null) return NextResponse.json({ error: DA_PLATAFORMA }, { status: 409 });
  try {
    const feito = await apagarMovimento(id);
    if (!feito) return NextResponse.json({ error: "Este movimento já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/financas/movimentos DELETE]", e);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 });
  }
}
