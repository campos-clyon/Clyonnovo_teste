import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { safeText, metaOf } from "@/lib/safe-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const sb = getSupabaseAdmin();

    let query = sb
      .from("service_requests")
      // Colunas do motor de preços incluídas: sem elas a agenda mostra 0 €
      // em pedidos cujo valor vive em estimate_min/max (NOTA-BRIDGE-MOTOR §3.1)
      .select("id, details, notes, city, region, status, urgency, scheduled_for, estimated_price, final_price, estimate_min, estimate_max, price_status, customer_id, category_slug, created_at")
      .not("scheduled_for", "is", null)
      .not("status", "in", '("canceled","rejected","completed")')
      .order("scheduled_for", { ascending: true })
      .limit(200);

    if (from) query = query.gte("scheduled_for", from);
    if (to) query = query.lte("scheduled_for", to);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    const customerIds = [...new Set(rows.map((r: any) => r.customer_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", customerIds);
      for (const p of profiles ?? []) profilesMap[p.id] = p;
    }

    const orders = rows.map((r: any) => {
      const profile = profilesMap[r.customer_id] ?? {};
      return {
        id: r.id,
        title: safeText(r.details) || safeText(r.category_slug) || "Pedido",
        // O objecto continua disponível para o detalhe, mas nunca chega ao
        // JSX como filho directo.
        details_meta: metaOf(r.details),
        city: safeText(r.city) ?? "",
        region: safeText(r.region) ?? "",
        status: r.status,
        urgency: r.urgency ?? "normal",
        scheduled_for: r.scheduled_for,
        estimated_price: r.estimated_price,
        final_price: r.final_price ?? null,
        estimate_min: r.estimate_min ?? null,
        estimate_max: r.estimate_max ?? null,
        price_status: r.price_status ?? null,
        client_name: safeText(profile.full_name),
        client_phone: safeText(profile.phone),
        created_at: r.created_at,
      };
    });

    return NextResponse.json({ orders });
  } catch (e: any) {
    console.error("[app-clyon/agenda]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
