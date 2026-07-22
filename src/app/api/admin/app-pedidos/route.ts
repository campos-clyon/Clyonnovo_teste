import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!colab.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const sb = getSupabaseAdmin();

    let query = sb
      .from("service_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "todos") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[app-pedidos] supabase error:", error);
      return NextResponse.json({ error: `Erro ao buscar pedidos: ${error.message}` }, { status: 500 });
    }

    const rows = data ?? [];

    // Fetch customer profiles for all unique customer_ids
    const customerIds = [...new Set(rows.map((r: any) => r.customer_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);
      for (const p of profiles ?? []) {
        profilesMap[p.id] = p;
      }
    }

    // Fetch category names for all unique category_slugs
    const categorySlugs = [...new Set(rows.map((r: any) => r.category_slug).filter(Boolean))];
    let categoriesMap: Record<string, any> = {};
    if (categorySlugs.length > 0) {
      const { data: cats } = await sb
        .from("service_categories")
        .select("slug, name, icon")
        .in("slug", categorySlugs);
      for (const c of cats ?? []) {
        categoriesMap[c.slug] = c;
      }
    }

    const orders = rows.map((row: any) => {
      const profile = profilesMap[row.customer_id] ?? {};
      const cat = categoriesMap[row.category_slug] ?? {};
      return {
        id:              row.id,
        title:           row.details || cat.name || row.category_slug || "Pedido",
        description:     row.notes ?? "",
        location:        row.address_line ?? "",
        district:        row.region ?? "",
        city:            row.city ?? "",
        urgency:         row.urgency ?? "normal",
        budget_range:    row.estimated_price ? `€${row.estimated_price}` : null,
        preferred_date:  row.scheduled_for ?? null,
        status:          row.status ?? "open",
        photos:          row.photos ?? [],
        created_at:      row.created_at,
        updated_at:      row.updated_at ?? row.created_at,
        client_name:     profile.full_name ?? null,
        client_email:    profile.email ?? null,
        client_phone:    profile.phone ?? null,
        category_name:   cat.name ?? row.category_slug ?? null,
        category_icon:   cat.icon ?? null,
        responses_count: 0,
      };
    });

    return NextResponse.json({ orders, total: count ?? orders.length });
  } catch (err: any) {
    console.error("[app-pedidos] unexpected error:", err);
    return NextResponse.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 });
  }
}
