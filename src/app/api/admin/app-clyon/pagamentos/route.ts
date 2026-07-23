import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pagamentos do app CLYON.
// Cruza payments + manual_payments + professional_earnings quando existirem.
// Devolve totais e lista recente. Tolerante a tabelas ausentes.
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30")));
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  try {
    const sb = getSupabaseAdmin();

    // Payments (automáticos)
    const { data: payments } = await sb
      .from("payments")
      .select("id, request_id, customer_id, amount, currency, status, method, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    // Pagamentos manuais
    const { data: manual } = await sb
      .from("manual_payments")
      .select("id, request_id, amount, currency, method, note, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    // Earnings dos profissionais
    const { data: earnings } = await sb
      .from("professional_earnings")
      .select("id, partner_id, request_id, amount, currency, status, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    const paid = (payments ?? []).filter((p: any) => p.status === "paid" || p.status === "succeeded");
    const totalPaid = paid.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const totalManual = (manual ?? []).reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
    const totalEarnings = (earnings ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

    return NextResponse.json({
      stats: {
        total_paid: Math.round(totalPaid * 100) / 100,
        total_manual: Math.round(totalManual * 100) / 100,
        total_earnings: Math.round(totalEarnings * 100) / 100,
        count_paid: paid.length,
        count_manual: manual?.length ?? 0,
        count_earnings: earnings?.length ?? 0,
      },
      payments: payments ?? [],
      manual: manual ?? [],
      earnings: earnings ?? [],
      days,
    });
  } catch (e: any) {
    console.error("[app-clyon/pagamentos]", e);
    return NextResponse.json({
      stats: { total_paid: 0, total_manual: 0, total_earnings: 0, count_paid: 0, count_manual: 0, count_earnings: 0 },
      payments: [], manual: [], earnings: [], days,
    });
  }
}
