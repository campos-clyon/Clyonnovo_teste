import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { lerConta } from "@/lib/financas";
import { apagarConta, criarConta, mudarConta } from "@/lib/financas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS CONTAS DA GESTORA — o banco, a caixa, um cartão. Criar e mudar é de quem
 * tiver a secção; apagar é do administrador, e só uma conta sem movimentos e
 * que não seja uma das duas da plataforma. Ver `financas-na-base.ts`.
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
  const corpo = await corpoDe(req);
  const lido = lerConta(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  try {
    const r = await criarConta(lido.dados);
    return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/contas POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const corpo = await corpoDe(req);
  const id = Number(corpo?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Conta em falta." }, { status: 400 });
  const lido = lerConta(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  try {
    const r = await mudarConta(id, lido.dados);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/contas PATCH]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Conta em falta." }, { status: 400 });
  try {
    const r = await apagarConta(id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 409 });
  } catch (e) {
    console.error("[admin/financas/contas DELETE]", e);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 });
  }
}
