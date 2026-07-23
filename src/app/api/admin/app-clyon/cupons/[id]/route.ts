import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;
  const allowed: Record<string, unknown> = {};

  if (typeof body.active === "boolean") allowed.active = body.active;
  if (body.starts_at !== undefined) allowed.starts_at = body.starts_at ?? null;
  if (body.ends_at !== undefined) allowed.ends_at = body.ends_at ?? null;
  if (body.usage_limit !== undefined) allowed.usage_limit = body.usage_limit != null ? Number(body.usage_limit) : null;
  if (body.per_account_limit !== undefined) allowed.per_account_limit = body.per_account_limit != null ? Number(body.per_account_limit) : null;
  if (body.minimum_order_amount !== undefined) allowed.minimum_order_amount = body.minimum_order_amount != null ? Number(body.minimum_order_amount) : null;
  if (typeof body.discount_value === "number" && body.discount_value > 0) allowed.discount_value = body.discount_value;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("cupons").update(allowed).eq("id", id).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Cupão não encontrado ou erro ao actualizar." }, { status: 404 });
    return NextResponse.json({ cupon: data });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    // Desactivar em vez de apagar para preservar histórico
    const { data, error } = await sb.from("cupons").update({ active: false }).eq("id", id).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Cupão não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
