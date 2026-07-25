import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  verificationState, publicDescriptionState,
  validateProfilePatch, statusSideEffects,
  PARTNER_STATUSES, type PartnerStatus, toFiveStars,
} from "@/lib/partner-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detalhe e gestão de um profissional. `id` é partner_profiles.id (NÃO o
 * user_id — ver comentário na rota da listagem).
 *
 * O painel escreve directamente em partner_profiles porque não existe RPC
 * de administração de parceiros no Bridge (só admin_moderate_review, para
 * avaliações). Todas as escritas ficam registadas em admin_audit_log.
 */

async function loadPartner(sb: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data: partner, error } = await sb
    .from("partner_profiles").select("*").eq("id", id).single();
  if (error || !partner) return null;

  const p = partner as Record<string, unknown>;

  const [profileRes, servicesRes, docsRes, bookingsRes] = await Promise.all([
    p.user_id
      ? sb.from("profiles").select("id, full_name, email, phone, avatar_url, created_at").eq("id", p.user_id).single()
      : Promise.resolve({ data: null }),
    sb.from("partner_services").select("*").eq("partner_id", id).order("category_slug"),
    sb.from("partner_documents").select("*").eq("partner_id", id).order("doc_type"),
    sb.from("bookings").select("id, status, amount, scheduled_for").eq("partner_id", id),
  ]);

  const docs = (docsRes.data ?? []) as Array<Record<string, unknown>>;
  const bookings = (bookingsRes.data ?? []) as Array<Record<string, unknown>>;

  // reviews chega-se por booking_id (a tabela não tem partner_id)
  let reviews: Array<Record<string, unknown>> = [];
  const bookingIds = bookings.map((b) => String(b.id)).filter(Boolean);
  if (bookingIds.length > 0) {
    const { data } = await sb
      .from("reviews")
      .select("id, booking_id, rating, comment, status, created_at, quality_rating, punctuality_rating, communication_rating")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });
    reviews = (data ?? []) as Array<Record<string, unknown>>;
  }

  return { partner: p, profile: profileRes.data ?? null, services: servicesRes.data ?? [], docs, bookings, reviews };
}

/** Registo de auditoria — não-bloqueante, mas sempre tentado. */
async function audit(
  sb: ReturnType<typeof getSupabaseAdmin>,
  action: string, partnerId: string,
  oldValue: unknown, newValue: unknown,
  colab: { id: number; nome: string }, reason?: string | null,
) {
  const { error } = await sb.from("admin_audit_log").insert([{
    action,
    entity_type: "partner_profile",
    entity_id: partnerId,
    old_value: oldValue ?? null,
    new_value: { ...(newValue as object), _by: `${colab.id}:${colab.nome}` },
    reason: reason ?? null,
  }]);
  if (error) console.error("[profissionais] auditoria falhou", { partnerId, action, error });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const data = await loadPartner(sb, id);
    if (!data) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });

    const { partner, profile, services, docs, bookings, reviews } = data;
    const verif = verificationState(partner.status as string, docs as never);
    const desc = publicDescriptionState(partner.description as string, partner.bio as string);

    const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === "number");
    // Normalizado para 5 estrelas (ver REVIEW_SCALE_MAX)
    const ratingAvg = ratings.length > 0
      ? toFiveStars(ratings.reduce((s, r) => s + r, 0) / ratings.length)
      : null;

    return NextResponse.json({
      partner,
      profile,
      services,
      documents: docs,
      reviews,
      verification: verif,
      description_state: desc,
      stats: {
        bookings_total: bookings.length,
        bookings_active: bookings.filter((b) => b.status !== "canceled").length,
        rating_avg: ratingAvg,
        rating_count: ratings.length,
      },
    });
  } catch (e) {
    console.error("[profissionais/[id] GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason : null;
  const { reason: _r, ...patchInput } = body;

  try {
    const sb = getSupabaseAdmin();

    const { data: current, error: fetchErr } = await sb
      .from("partner_profiles").select("*").eq("id", id).single();
    if (fetchErr || !current) {
      return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
    }

    const check = validateProfilePatch(patchInput);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    let updates = { ...check.allowed };

    // Mudança de estado arrasta carimbos e motivo obrigatório
    if (typeof updates.status === "string" && updates.status !== (current as Record<string, unknown>).status) {
      const side = statusSideEffects(updates.status as PartnerStatus, reason);
      if (side.error) return NextResponse.json({ error: side.error }, { status: 400 });
      updates = { ...updates, ...side.patch };
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await sb
      .from("partner_profiles").update(updates).eq("id", id).select("*").single();
    if (updErr) {
      console.error("[profissionais/[id] PATCH]", { id, updErr });
      return NextResponse.json({ error: `Erro ao guardar: ${updErr.message}` }, { status: 500 });
    }

    await audit(sb, "update_partner_profile", id, current, updates, colab!, reason);

    // Depois de gravar, dizer se o selo de verificado mudou de estado
    const { data: docs } = await sb.from("partner_documents").select("doc_type, status").eq("partner_id", id);
    const verif = verificationState((updated as Record<string, unknown>).status as string, docs as never);

    return NextResponse.json({ ok: true, partner: updated, verification: verif });
  } catch (e) {
    console.error("[profissionais/[id] PATCH]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/** Acções sobre documentos e serviços do profissional. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as {
    action?: "document" | "service" | "copy_bio";
    document_id?: string;
    status?: string;
    notes?: string;
    service_id?: string;
    active?: boolean;
    verified?: boolean;
  };

  try {
    const sb = getSupabaseAdmin();

    // ── Aprovar / rejeitar um documento ────────────────────────────────────
    if (body.action === "document") {
      if (!body.document_id) return NextResponse.json({ error: "document_id em falta." }, { status: 400 });
      if (body.status !== "approved" && body.status !== "rejected" && body.status !== "pending") {
        return NextResponse.json({ error: "Estado de documento inválido." }, { status: 400 });
      }
      if (body.status === "rejected" && !body.notes?.trim()) {
        return NextResponse.json({
          error: "Explica ao profissional porque o documento foi rejeitado — sem isso ele não sabe o que corrigir.",
        }, { status: 400 });
      }

      const agora = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status: body.status,
        notes: body.notes?.trim() || null,
        approved_at: body.status === "approved" ? agora : null,
        rejected_at: body.status === "rejected" ? agora : null,
      };

      const { data, error } = await sb
        .from("partner_documents").update(patch)
        .eq("id", body.document_id).eq("partner_id", id)
        .select("*").single();
      if (error || !data) {
        return NextResponse.json({ error: `Erro ao actualizar documento: ${error?.message ?? "não encontrado"}` }, { status: 500 });
      }

      await audit(sb, `document_${body.status}`, id, null, { document_id: body.document_id, ...patch }, colab!, body.notes);

      // O selo de verificado depende dos documentos — devolver o novo estado
      const [{ data: partner }, { data: docs }] = await Promise.all([
        sb.from("partner_profiles").select("status").eq("id", id).single(),
        sb.from("partner_documents").select("doc_type, status").eq("partner_id", id),
      ]);
      const verif = verificationState((partner as Record<string, unknown> | null)?.status as string, docs as never);

      return NextResponse.json({ ok: true, document: data, verification: verif });
    }

    // ── Activar / verificar um serviço ─────────────────────────────────────
    if (body.action === "service") {
      if (!body.service_id) return NextResponse.json({ error: "service_id em falta." }, { status: 400 });

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.active === "boolean") patch.active = body.active;
      if (typeof body.verified === "boolean") {
        patch.verified_at = body.verified ? new Date().toISOString() : null;
        patch.verified_by = body.verified ? String(colab!.id) : null;
      }
      if (Object.keys(patch).length === 1) {
        return NextResponse.json({ error: "Nada para alterar no serviço." }, { status: 400 });
      }

      const { data, error } = await sb
        .from("partner_services").update(patch)
        .eq("id", body.service_id).eq("partner_id", id)
        .select("*").single();
      if (error || !data) {
        return NextResponse.json({ error: `Erro ao actualizar serviço: ${error?.message ?? "não encontrado"}` }, { status: 500 });
      }

      await audit(sb, "update_partner_service", id, null, { service_id: body.service_id, ...patch }, colab!);
      return NextResponse.json({ ok: true, service: data });
    }

    // ── Copiar a bio para a descrição pública ──────────────────────────────
    // O app do profissional grava em `bio`, mas o ecrã do cliente lê
    // `description` e cai num texto genérico quando está vazia. Até o app
    // ser corrigido, é o painel que repara isto.
    if (body.action === "copy_bio") {
      const { data: current } = await sb
        .from("partner_profiles").select("bio, description").eq("id", id).single();
      const bio = (current as Record<string, unknown> | null)?.bio;
      if (typeof bio !== "string" || !bio.trim()) {
        return NextResponse.json({ error: "Este profissional não escreveu bio — não há nada para copiar." }, { status: 400 });
      }

      const { data, error } = await sb
        .from("partner_profiles")
        .update({ description: bio.trim(), updated_at: new Date().toISOString() })
        .eq("id", id).select("*").single();
      if (error) return NextResponse.json({ error: `Erro ao copiar: ${error.message}` }, { status: 500 });

      await audit(sb, "copy_bio_to_description", id, current, { description: bio.trim() }, colab!);
      return NextResponse.json({ ok: true, partner: data });
    }

    return NextResponse.json({ error: "Acção inválida." }, { status: 400 });
  } catch (e) {
    console.error("[profissionais/[id] POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
