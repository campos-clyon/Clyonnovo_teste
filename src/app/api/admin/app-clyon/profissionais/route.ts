import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista profissionais: cruza profiles + partner_profiles + user_roles.
// Um profissional é qualquer profile com registo em partner_profiles ou user_roles.role='partner'.
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

  try {
    const sb = getSupabaseAdmin();

    // Ids de profissionais: quem tem partner_profiles OU user_roles.role='partner'
    const partnerIds = new Set<string>();

    const { data: pp } = await sb.from("partner_profiles").select("id");
    for (const r of pp ?? []) if (r?.id) partnerIds.add(String(r.id));

    const { data: roles } = await sb.from("user_roles").select("user_id, role").eq("role", "partner");
    for (const r of roles ?? []) if (r?.user_id) partnerIds.add(String(r.user_id));

    if (partnerIds.size === 0) {
      // Fallback: se ainda não há partner_profiles nem user_roles, devolve profiles vazio
      return NextResponse.json({ profiles: [], stats: { total: 0, active: 0, docs_pending: 0 } });
    }

    const ids = [...partnerIds];

    // Perfis base
    let query = sb
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: profiles, error } = await query;
    if (error) return NextResponse.json({ profiles: [] });

    const profileIds = (profiles ?? []).map((p) => p.id);

    // Dados de partner_profiles (rating, availability_status, etc.) — colunas opcionais
    const partnerMap: Record<string, any> = {};
    if (profileIds.length > 0) {
      const { data: partnerRows } = await sb
        .from("partner_profiles")
        .select("*")
        .in("id", profileIds);
      for (const p of partnerRows ?? []) partnerMap[String(p.id)] = p;
    }

    // Serviços por profissional
    const servicesMap: Record<string, string[]> = {};
    if (profileIds.length > 0) {
      const { data: services } = await sb
        .from("partner_services")
        .select("partner_id, category_slug")
        .in("partner_id", profileIds);
      for (const s of services ?? []) {
        const pid = String(s.partner_id);
        if (!servicesMap[pid]) servicesMap[pid] = [];
        if (s.category_slug) servicesMap[pid].push(s.category_slug);
      }
    }

    // Documentos por profissional (contagem por estado)
    const docsMap: Record<string, { total: number; verified: number; pending: number }> = {};
    if (profileIds.length > 0) {
      const { data: docs } = await sb
        .from("partner_documents")
        .select("partner_id, status")
        .in("partner_id", profileIds);
      for (const d of docs ?? []) {
        const pid = String(d.partner_id);
        if (!docsMap[pid]) docsMap[pid] = { total: 0, verified: 0, pending: 0 };
        docsMap[pid].total += 1;
        if (d.status === "verified" || d.status === "approved") docsMap[pid].verified += 1;
        else docsMap[pid].pending += 1;
      }
    }

    // Reviews / rating (agregado)
    const reviewsMap: Record<string, { avg: number; count: number }> = {};
    if (profileIds.length > 0) {
      const { data: reviews } = await sb
        .from("reviews")
        .select("partner_id, rating")
        .in("partner_id", profileIds);
      const acc: Record<string, { sum: number; count: number }> = {};
      for (const r of reviews ?? []) {
        const pid = String(r.partner_id);
        if (!acc[pid]) acc[pid] = { sum: 0, count: 0 };
        if (typeof r.rating === "number") { acc[pid].sum += r.rating; acc[pid].count += 1; }
      }
      for (const [pid, v] of Object.entries(acc)) {
        reviewsMap[pid] = { avg: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0, count: v.count };
      }
    }

    const enriched = (profiles ?? []).map((p) => {
      const pd = partnerMap[p.id] ?? {};
      const svc = servicesMap[p.id] ?? [];
      const docs = docsMap[p.id] ?? { total: 0, verified: 0, pending: 0 };
      const rv = reviewsMap[p.id] ?? { avg: 0, count: 0 };
      return {
        id: p.id,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        created_at: p.created_at,
        availability_status: pd.availability_status ?? pd.status ?? null,
        onboarding_status: pd.onboarding_status ?? null,
        services: svc,
        docs_total: docs.total,
        docs_verified: docs.verified,
        docs_pending: docs.pending,
        rating_avg: rv.avg,
        rating_count: rv.count,
      };
    });

    const stats = {
      total: enriched.length,
      active: enriched.filter((p) => p.availability_status === "available" || p.availability_status === "online").length,
      docs_pending: enriched.filter((p) => p.docs_pending > 0).length,
    };

    return NextResponse.json({ profiles: enriched, stats });
  } catch (e: any) {
    console.error("[app-clyon/profissionais]", e);
    return NextResponse.json({ profiles: [], stats: { total: 0, active: 0, docs_pending: 0 } });
  }
}
