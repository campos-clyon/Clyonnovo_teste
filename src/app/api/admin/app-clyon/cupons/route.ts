import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateCupon(body: Record<string, unknown>): string | null {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code || code.length < 3 || code.length > 32) return "Código inválido (3-32 caracteres).";
  if (!/^[A-Z0-9_-]+$/.test(code)) return "Código só pode conter letras, números, _ e -.";

  const dtype = body.discount_type;
  if (dtype !== "percent" && dtype !== "fixed") return "discount_type deve ser 'percent' ou 'fixed'.";

  const dval = Number(body.discount_value);
  if (!isFinite(dval) || dval <= 0) return "discount_value deve ser positivo.";
  if (dtype === "percent" && dval > 100) return "Desconto em percentagem não pode exceder 100%.";

  if (body.usage_limit !== undefined && body.usage_limit !== null) {
    const ul = Number(body.usage_limit);
    if (!Number.isInteger(ul) || ul <= 0) return "usage_limit deve ser um inteiro positivo.";
  }
  if (body.per_account_limit !== undefined && body.per_account_limit !== null) {
    const pal = Number(body.per_account_limit);
    if (!Number.isInteger(pal) || pal <= 0) return "per_account_limit deve ser um inteiro positivo.";
  }
  if (body.minimum_order_amount !== undefined && body.minimum_order_amount !== null) {
    const moa = Number(body.minimum_order_amount);
    if (!isFinite(moa) || moa < 0) return "minimum_order_amount deve ser >= 0.";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("cupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ cupons: [] });
    return NextResponse.json({ cupons: data ?? [] });
  } catch {
    return NextResponse.json({ cupons: [] });
  }
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json() as Record<string, unknown>;
  const validationError = validateCupon(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const code = (body.code as string).trim().toUpperCase();

  const row = {
    code,
    discount_type:        body.discount_type,
    discount_value:       Number(body.discount_value),
    currency_code:        typeof body.currency_code === "string" ? body.currency_code.toUpperCase() : "EUR",
    starts_at:            body.starts_at ?? null,
    ends_at:              body.ends_at ?? null,
    usage_limit:          body.usage_limit != null ? Number(body.usage_limit) : null,
    minimum_order_amount: body.minimum_order_amount != null ? Number(body.minimum_order_amount) : null,
    per_account_limit:    body.per_account_limit != null ? Number(body.per_account_limit) : null,
    active:               body.active !== false,
  };

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("cupons").insert([row]).select("*").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Código já existe." }, { status: 409 });
      return NextResponse.json({ error: "Erro ao criar cupão." }, { status: 500 });
    }
    return NextResponse.json({ cupon: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
