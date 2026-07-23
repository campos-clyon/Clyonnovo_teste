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

    // Contagens por estado (todos os registos, sem paginação)
    const { data: allRows, error } = await sb
      .from("service_requests")
      .select("id, status, urgency, scheduled_for, created_at, customer_id")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = allRows ?? [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

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
    const scheduledToday = rows.filter((r) => {
      if (!r.scheduled_for) return false;
      return String(r.scheduled_for).slice(0, 10) === todayStr;
    }).length;

    // Pedidos recentes (últimos 10, abertos ou urgentes)
    const recent = rows
      .filter((r) => OPEN_STATUSES.includes(r.status) || r.urgency === "urgent")
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        status: r.status,
        urgency: r.urgency,
        created_at: r.created_at,
        scheduled_for: r.scheduled_for,
      }));

    return NextResponse.json({
      stats: { total, open, inProgress, completed, cancelled, urgent, unassigned, scheduledToday },
      recent,
    });
  } catch (e: any) {
    console.error("[app-clyon/visao-geral]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
