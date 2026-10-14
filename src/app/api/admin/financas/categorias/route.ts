import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { lerCategoria } from "@/lib/financas";
import { apagarCategoria, criarCategoria, mudarCategoria } from "@/lib/financas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS CATEGORIAS DA GESTORA. Criar e mudar (nome, cor, ícone) é de quem tiver a
 * secção; o tipo não muda depois de criada. Apagar é do administrador, e só
 * uma categoria sem movimentos e que não seja das da plataforma.
 */

async function corpoDe(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const lido = lerCategoria(await corpoDe(req));
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  try {
    const r = await criarCategoria(lido.dados);
    return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/categorias POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  const id = Number(corpo?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Categoria em falta." }, { status: 400 });
  // O tipo vem só para a validação passar: a base não o muda.
  const lido = lerCategoria(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  try {
    const r = await mudarCategoria(id, lido.dados);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/categorias PATCH]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Categoria em falta." }, { status: 400 });
  try {
    const r = await apagarCategoria(id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/categorias DELETE]", e);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 });
  }
}
