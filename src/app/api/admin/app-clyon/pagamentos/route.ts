import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pagamentos do app CLYON — schema real Supabase.
// payments: id, request_id, customer_id, partner_id, amount, service_total, discount_amount,
//           net_service_total, platform_fee, method, status (enum), provider, provider_ref,
//           checkout_url, authorized_at, captured_at, refunded_amount, failure_reason,
//           promo_code_id, release_at, created_at, updated_at
// manual_payments: id, request_id, booking_id, method, amount, paid_at, status,
//                  internal_note, proof_url, recorded_by, created_at, updated_at
// professional_earnings: id, partner_id, request_id, booking_id, payment_id,
//                        gross_amount, partner_share_pct, partner_amount, clyon_amount,
//                        status, available_at, paid_at, payout_ref, notes, created_at, updated_at
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30")));
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  const sb = getSupabaseAdmin();

  const [paymentsRes, manualRes, earningsRes] = await Promise.all([
    sb.from("payments")
      .select("id, request_id, customer_id, partner_id, amount, service_total, discount_amount, net_service_total, platform_fee, method, status, provider, provider_ref, failure_reason, authorized_at, captured_at, refunded_amount, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("manual_payments")
      .select("id, request_id, booking_id, method, amount, paid_at, status, internal_note, proof_url, recorded_by, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("professional_earnings")
      .select("id, partner_id, request_id, booking_id, payment_id, gross_amount, partner_share_pct, partner_amount, clyon_amount, status, available_at, paid_at, payout_ref, notes, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Erro em qualquer query → devolver 502 com identificador para diagnóstico
  const errors: Record<string, string> = {};
  if (paymentsRes.error) errors.payments = paymentsRes.error.message;
  if (manualRes.error) errors.manual_payments = manualRes.error.message;
  if (earningsRes.error) errors.professional_earnings = earningsRes.error.message;
  if (Object.keys(errors).length > 0) {
    console.error("[app-clyon/pagamentos] schema/query error", errors);
    return NextResponse.json(
      { error: "Erro de integração Supabase em pagamentos.", details: errors },
      { status: 502 }
    );
  }

  const payments = paymentsRes.data ?? [];
  const manual = manualRes.data ?? [];
  const earnings = earningsRes.data ?? [];

  // "Pago" = payment com status capturado. O enum exacto pode variar — aceita variantes conhecidas.
  const paidStatuses = new Set(["captured", "paid", "succeeded", "completed"]);
  const paid = payments.filter((p: any) => paidStatuses.has(String(p.status)));
  const totalPaid = paid.reduce((s: number, p: any) => s + Number(p.net_service_total ?? p.amount ?? 0), 0);
  const totalManual = manual.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
  const totalEarnings = earnings.reduce((s: number, e: any) => s + Number(e.partner_amount ?? 0), 0);
  const totalPlatformFee = paid.reduce((s: number, p: any) => s + Number(p.platform_fee ?? 0), 0);

  return NextResponse.json({
    stats: {
      total_paid: Math.round(totalPaid * 100) / 100,
      total_manual: Math.round(totalManual * 100) / 100,
      total_earnings: Math.round(totalEarnings * 100) / 100,
      total_platform_fee: Math.round(totalPlatformFee * 100) / 100,
      count_paid: paid.length,
      count_manual: manual.length,
      count_earnings: earnings.length,
    },
    payments,
    manual,
    earnings,
    days,
  });
}
