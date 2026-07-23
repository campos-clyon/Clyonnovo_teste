import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Contas de clientes do app CLYON = profiles - partners.
// Cruza com service_requests para contagens (pedidos, último pedido).
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "200")));

  try {
    const sb = getSupabaseAdmin();

    // Identificar partners para os excluir
    const partnerIds = new Set<string>();
    const { data: pp } = await sb.from("partner_profiles").select("id");
    for (const r of pp ?? []) if (r?.id) partnerIds.add(String(r.id));
    const { data: roles } = await sb.from("user_roles").select("user_id, role").eq("role", "partner");
    for (const r of roles ?? []) if (r?.user_id) partnerIds.add(String(r.user_id));

    // Todos os profiles
    let query = sb
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: profiles, error } = await query;
    if (error) return NextResponse.json({ accounts: [], stats: { total: 0, active_30d: 0, no_orders: 0 } });

    const clients = (profiles ?? []).filter((p) => !partnerIds.has(String(p.id)));
    const clientIds = clients.map((c) => c.id);

    // Contagem de pedidos + último pedido por cliente
    const ordersMap: Record<string, { count: number; last: string | null }> = {};
    if (clientIds.length > 0) {
      const { data: reqs } = await sb
        .from("service_requests")
        .select("customer_id, created_at")
        .in("customer_id", clientIds);
      for (const r of reqs ?? []) {
        const cid = String(r.customer_id);
        if (!ordersMap[cid]) ordersMap[cid] = { count: 0, last: null };
        ordersMap[cid].count += 1;
        if (!ordersMap[cid].last || (r.created_at && r.created_at > ordersMap[cid].last!)) {
          ordersMap[cid].last = r.created_at;
        }
      }
    }

    const now = Date.now();
    const cutoff30d = now - 30 * 86400_000;

    const accounts = clients.map((c) => {
      const o = ordersMap[c.id] ?? { count: 0, last: null };
      const active_30d = o.last ? new Date(o.last).getTime() >= cutoff30d : false;
      return {
        id: c.id,
        full_name: c.full_name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        created_at: c.created_at,
        orders_count: o.count,
        last_order_at: o.last,
        active_30d,
      };
    });

    const stats = {
      total: accounts.length,
      active_30d: accounts.filter((a) => a.active_30d).length,
      no_orders: accounts.filter((a) => a.orders_count === 0).length,
    };

    return NextResponse.json({ accounts, stats });
  } catch (e: any) {
    console.error("[app-clyon/contas]", e);
    return NextResponse.json({ accounts: [], stats: { total: 0, active_30d: 0, no_orders: 0 } });
  }
}
