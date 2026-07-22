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

    const asString = (v: any): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      return null; // discard objects/arrays — cannot be safely rendered as text
    };

    const orders = rows.map((row: any) => {
      const profile = profilesMap[row.customer_id] ?? {};
      const cat = categoriesMap[row.category_slug] ?? {};
      return {
        id:              String(row.id ?? ""),
        title:           asString(row.details) || asString(cat.name) || asString(row.category_slug) || "Pedido",
        description:     asString(row.notes) ?? "",
        location:        asString(row.address_line) ?? "",
        district:        asString(row.region) ?? "",
        city:            asString(row.city) ?? "",
        urgency:         asString(row.urgency) ?? "normal",
        budget_range:    row.estimated_price != null ? `€${row.estimated_price}` : null,
        preferred_date:  asString(row.scheduled_for),
        status:          asString(row.status) ?? "open",
        photos:          Array.isArray(row.photos) ? row.photos.filter((p: any) => typeof p === "string") : [],
        created_at:      asString(row.created_at) ?? "",
        updated_at:      asString(row.updated_at) ?? asString(row.created_at) ?? "",
        client_name:     asString(profile.full_name),
        client_email:    asString(profile.email),
        client_phone:    asString(profile.phone),
        category_name:   asString(cat.name) ?? asString(row.category_slug),
        category_icon:   asString(cat.icon),
        responses_count: 0,
      };
    });

    return NextResponse.json({ orders, total: count ?? orders.length });
  } catch (err: any) {
    console.error("[app-pedidos] unexpected error:", err);
    return NextResponse.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 });
  }
}
