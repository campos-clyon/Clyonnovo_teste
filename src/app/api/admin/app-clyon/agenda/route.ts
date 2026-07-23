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

    // Pedidos com data confirmada, ordenados por data ASC
    const { data, error } = await sb
      .from("service_requests")
      .select("id, details, notes, city, region, status, urgency, scheduled_for, estimated_price, customer_id, category_slug, created_at")
      .not("scheduled_for", "is", null)
      .not("status", "in", '("canceled","rejected","completed")')
      .order("scheduled_for", { ascending: true })
      .limit(100);

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
        title: r.details || r.category_slug || "Pedido",
        city: r.city ?? "",
        region: r.region ?? "",
        status: r.status,
        urgency: r.urgency ?? "normal",
        scheduled_for: r.scheduled_for,
        estimated_price: r.estimated_price,
        client_name: profile.full_name ?? null,
        client_phone: profile.phone ?? null,
        created_at: r.created_at,
      };
    });

    return NextResponse.json({ orders });
  } catch (e: any) {
    console.error("[app-clyon/agenda]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
