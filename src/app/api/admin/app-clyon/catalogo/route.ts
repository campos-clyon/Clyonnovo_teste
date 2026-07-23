import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!colab.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("service_categories")
      .select("slug, name, icon, description, is_active, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Contar pedidos por categoria para saber se tem histórico
    const slugs = (data ?? []).map((c: any) => c.slug);
    let countMap: Record<string, number> = {};
    if (slugs.length > 0) {
      const { data: counts } = await sb
        .from("service_requests")
        .select("category_slug")
        .in("category_slug", slugs);
      for (const r of counts ?? []) {
        countMap[r.category_slug] = (countMap[r.category_slug] ?? 0) + 1;
      }
    }

    const categories = (data ?? []).map((c: any) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon ?? null,
      description: c.description ?? null,
      is_active: c.is_active !== false, // default true se campo não existir
      sort_order: c.sort_order ?? null,
      request_count: countMap[c.slug] ?? 0,
    }));

    return NextResponse.json({ categories });
  } catch (e: any) {
    console.error("[app-clyon/catalogo]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
