import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = ["active", "sort_order", "name", "icon", "description"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { slug } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Só campos da lista de permitidos
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field as AllowedField];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  // Arquivar em vez de apagar — não permitir eliminação de categoria com histórico
  // Apenas is_active=false é o caminho seguro
  try {
    const sb = getSupabaseAdmin();

    // Verificar que a categoria existe
    const { data: existing, error: fetchErr } = await sb
      .from("service_categories")
      .select("slug, name")
      .eq("slug", slug)
      .single();
    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
    }

    const { data, error } = await sb
      .from("service_categories")
      .update(updates)
      .eq("slug", slug)
      .select("slug, name, icon, description, active, sort_order")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ category: data });
  } catch (e: any) {
    console.error("[app-clyon/catalogo/[slug]]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
