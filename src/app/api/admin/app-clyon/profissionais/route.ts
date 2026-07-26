import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificationState, publicDescriptionState, toFiveStars, isSystemPartner } from "@/lib/partner-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista de profissionais.
 *
 * ⚠️ CORRIGIDO em 25-07-2026: a versão anterior tratava `partner_profiles.id`
 * como se fosse o id do utilizador. Não é — o utilizador está em `user_id`.
 * Consequência: os joins a partner_services / partner_documents (que apontam
 * a partner_profiles.id) recebiam ids de `profiles` e devolviam sempre vazio,
 * e a query a `reviews.partner_id` referia uma coluna que não existe.
 * O painel mostrava toda a gente sem serviços, sem documentos e sem
 * avaliações — sem erro nenhum.
 *
 * Relações reais:
 *   partner_profiles.id       → PK do profissional
 *   partner_profiles.user_id  → profiles.id (nome, email, telefone)
 *   partner_documents.partner_id → partner_profiles.id
 *   partner_services.partner_id  → partner_profiles.id
 *   reviews                   → sem partner_id; via booking_id → bookings.partner_id
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const statusFilter = url.searchParams.get("status")?.trim() ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

  try {
    const sb = getSupabaseAdmin();

    let pq = sb
      .from("partner_profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (statusFilter && statusFilter !== "todos") pq = pq.eq("status", statusFilter);

    const { data: partners, error } = await pq;
    if (error) {
      console.error("[profissionais] partner_profiles", error);
      return NextResponse.json({ error: `Erro ao carregar profissionais: ${error.message}` }, { status: 500 });
    }

    // A linha técnica "CLYON — por atribuir" NÃO é um profissional: é o
    // titular das reservas criadas no checkout antes de haver profissional
    // atribuído. Se aparecesse aqui, entrava na fila de aprovação e o
    // administrador levava um erro sem contexto do gatilho que a protege.
    const rows = ((partners ?? []) as Array<Record<string, unknown>>)
      .filter((r) => !isSystemPartner(r));
    if (rows.length === 0) {
      return NextResponse.json({ profiles: [], stats: { total: 0, approved: 0, pending: 0, docs_pending: 0, sem_descricao: 0 } });
    }

    const partnerIds = rows.map((r) => String(r.id));
    const userIds = rows.map((r) => r.user_id).filter(Boolean).map(String);

    const [profilesRes, servicesRes, docsRes, bookingsRes] = await Promise.all([
      userIds.length
        ? sb.from("profiles").select("id, full_name, email, phone, avatar_url, created_at").in("id", userIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      sb.from("partner_services").select("*").in("partner_id", partnerIds),
      sb.from("partner_documents").select("*").in("partner_id", partnerIds),
      sb.from("bookings").select("id, partner_id").in("partner_id", partnerIds),
    ]);

    const profileMap: Record<string, Record<string, unknown>> = {};
    for (const p of (profilesRes.data ?? []) as Array<Record<string, unknown>>) {
      profileMap[String(p.id)] = p;
    }

    const servicesMap: Record<string, Array<Record<string, unknown>>> = {};
    for (const s of (servicesRes.data ?? []) as Array<Record<string, unknown>>) {
      const pid = String(s.partner_id);
      (servicesMap[pid] ??= []).push(s);
    }

    const docsMap: Record<string, Array<Record<string, unknown>>> = {};
    for (const d of (docsRes.data ?? []) as Array<Record<string, unknown>>) {
      const pid = String(d.partner_id);
      (docsMap[pid] ??= []).push(d);
    }

    // reviews não tem partner_id — chega-se por booking_id → bookings.partner_id
    const bookingToPartner: Record<string, string> = {};
    for (const b of (bookingsRes.data ?? []) as Array<Record<string, unknown>>) {
      if (b?.id && b?.partner_id) bookingToPartner[String(b.id)] = String(b.partner_id);
    }
    const reviewsMap: Record<string, { sum: number; count: number }> = {};
    const bookingIds = Object.keys(bookingToPartner);
    if (bookingIds.length > 0) {
      const { data: reviews } = await sb
        .from("reviews")
        .select("booking_id, rating, status")
        .in("booking_id", bookingIds);
      for (const r of (reviews ?? []) as Array<Record<string, unknown>>) {
        const pid = bookingToPartner[String(r.booking_id)];
        if (!pid || typeof r.rating !== "number") continue;
        (reviewsMap[pid] ??= { sum: 0, count: 0 });
        reviewsMap[pid].sum += r.rating;
        reviewsMap[pid].count += 1;
      }
    }

    let enriched = rows.map((p) => {
      const pid = String(p.id);
      const prof = profileMap[String(p.user_id ?? "")] ?? {};
      const svc = servicesMap[pid] ?? [];
      const docs = docsMap[pid] ?? [];
      const rv = reviewsMap[pid];

      const verif = verificationState(p.status as string, docs as never);
      const desc = publicDescriptionState(p.description as string, p.bio as string);

      return {
        id: pid,
        user_id: p.user_id ?? null,
        trade_name: p.trade_name ?? null,
        legal_name: p.legal_name ?? null,
        kind: p.kind ?? null,
        status: p.status ?? null,
        tier: p.tier ?? null,
        trust_score: p.trust_score ?? null,
        earning_share: p.earning_share ?? null,
        jobs_completed: p.jobs_completed ?? null,
        // Nome/contacto vivem em profiles, não em partner_profiles
        full_name: prof.full_name ?? null,
        email: prof.email ?? null,
        phone: prof.phone ?? null,
        avatar_url: prof.avatar_url ?? null,
        created_at: p.created_at ?? null,
        regions: Array.isArray(p.regions) ? p.regions : [],
        service_categories: Array.isArray(p.service_categories) ? p.service_categories : [],
        services: svc.map((s) => String(s.category_slug)).filter(Boolean),
        services_active: svc.filter((s) => s.active === true).length,
        docs_total: docs.length,
        docs_approved: docs.filter((d) => d.status === "approved").length,
        docs_pending: docs.filter((d) => d.status === "pending").length,
        docs_rejected: docs.filter((d) => d.status === "rejected").length,
        verified: verif.verified,
        verification_reason: verif.reason,
        missing_badge_docs: verif.missingDocs,
        description_needs_attention: desc.needsAttention,
        // Normalizado para 5 estrelas — reviews.rating passa a 0-10 quando a
        // migração das avaliações correr (ver REVIEW_SCALE_MAX)
        rating_avg: rv && rv.count > 0
          ? (toFiveStars(rv.sum / rv.count) ?? 0)
          : (typeof p.rating === "number" ? (toFiveStars(p.rating) ?? 0) : 0),
        rating_count: rv?.count ?? 0,
        has_vehicle: p.has_vehicle ?? null,
      };
    });

    if (search) {
      enriched = enriched.filter((p) =>
        [p.trade_name, p.legal_name, p.full_name, p.email, p.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search)),
      );
    }

    const stats = {
      total: enriched.length,
      approved: enriched.filter((p) => p.status === "approved").length,
      pending: enriched.filter((p) => p.status === "pending" || p.status === "in_review").length,
      docs_pending: enriched.filter((p) => p.docs_pending > 0).length,
      // Profissionais cuja apresentação o cliente não vê (bug bio vs description)
      sem_descricao: enriched.filter((p) => p.description_needs_attention).length,
    };

    return NextResponse.json({ profiles: enriched, stats });
  } catch (e) {
    console.error("[app-clyon/profissionais]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
