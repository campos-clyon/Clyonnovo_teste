import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const sb = getSupabaseAdmin();

    const { data: allRows, error } = await sb
      .from("service_requests")
      .select("id, status, urgency, scheduled_for, created_at, customer_id, estimated_price, category_slug")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = allRows ?? [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const cutoff7d = Date.now() - 7 * 86400_000;

    const OPEN_STATUSES = [
      "draft", "received", "in_review", "awaiting_deposit",
      "assignment_pending", "partner_selected",
    ];
    const IN_PROGRESS_STATUSES = [
      "confirmed", "in_route", "arrived", "in_execution",
      "extra_review_requested", "awaiting_confirmation",
    ];

    const total = rows.length;
    const open = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length;
    const inProgress = rows.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const cancelled = rows.filter((r) => ["canceled", "rejected", "in_dispute"].includes(r.status)).length;
    const urgent = rows.filter((r) => r.urgency === "urgent" && OPEN_STATUSES.includes(r.status)).length;
    const unassigned = rows.filter((r) => r.status === "received" || r.status === "assignment_pending").length;
    const scheduledToday = rows.filter((r) => r.scheduled_for && String(r.scheduled_for).slice(0, 10) === todayStr).length;

    // Novos pedidos nos últimos 7 dias
    const new7d = rows.filter((r) => r.created_at && new Date(r.created_at).getTime() >= cutoff7d).length;

    // Receita estimada (soma de estimated_price dos concluídos nos últimos 30 dias)
    const cutoff30d = Date.now() - 30 * 86400_000;
    const revenue30d = rows
      .filter((r) => r.status === "completed" && r.created_at && new Date(r.created_at).getTime() >= cutoff30d)
      .reduce((s, r) => s + Number(r.estimated_price ?? 0), 0);

    // Contagem de partners activos (best-effort)
    let partnersActive = 0;
    try {
      const { data: pp } = await sb
        .from("partner_profiles")
        .select("id, availability_status");
      partnersActive = (pp ?? []).filter((p: any) =>
        p.availability_status === "available" || p.availability_status === "online"
      ).length;
    } catch { /* tabela pode não existir */ }

    // Pedidos recentes (últimos 10, abertos ou urgentes)
    const recent = rows
      .filter((r) => OPEN_STATUSES.includes(r.status) || r.urgency === "urgent")
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        slug: r.category_slug,
        status: r.status,
        urgency: r.urgency,
        created_at: r.created_at,
        scheduled_for: r.scheduled_for,
      }));

    return NextResponse.json({
      stats: {
        total, open, inProgress, completed, cancelled,
        urgent, unassigned, scheduledToday, new7d,
        revenue30d: Math.round(revenue30d * 100) / 100,
        partnersActive,
      },
      recent,
    });
  } catch (e: any) {
    console.error("[app-clyon/visao-geral]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
