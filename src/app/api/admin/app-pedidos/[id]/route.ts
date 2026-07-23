import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "draft", "received", "in_review", "awaiting_deposit", "assignment_pending",
  "partner_selected", "confirmed", "in_route", "arrived", "in_execution",
  "extra_review_requested", "awaiting_confirmation", "completed",
  "in_dispute", "canceled", "rejected",
] as const;

const CANCEL_STATUSES = new Set(["canceled", "rejected"]);

function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
  }
  if (typeof value === "object") return null;
  return String(value);
}

function normalizeOrder(row: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...row };
  normalized.details = safeText(row.details);
  normalized.notes = safeText(row.notes);
  normalized.address_line = safeText(row.address_line);
  normalized.city = safeText(row.city);
  normalized.region = safeText(row.region);
  if (row.details !== null && typeof row.details === "object") {
    normalized.details_meta = row.details;
  }
  return normalized;
}

async function enrichOrder(sb: ReturnType<typeof getSupabaseAdmin>, row: Record<string, unknown>) {
  const safe = normalizeOrder(row);
  const customerId = safe.customer_id as string | null;
  const categorySlug = safe.category_slug as string | null;

  const [profileRes, catRes] = await Promise.all([
    customerId
      ? sb.from("profiles").select("id, full_name, email, phone").eq("id", customerId).single()
      : Promise.resolve({ data: null }),
    categorySlug
      ? sb.from("service_categories").select("slug, name, icon").eq("slug", categorySlug).single()
      : Promise.resolve({ data: null }),
  ]);

  const profile = (profileRes.data as Record<string, unknown> | null) ?? {};
  const cat = (catRes.data as Record<string, unknown> | null) ?? {};

  return {
    ...safe,
    client_name:    profile.full_name  ?? null,
    client_email:   profile.email      ?? null,
    client_phone:   profile.phone      ?? null,
    category_name:  cat.name           ?? categorySlug ?? null,
    category_icon:  cat.icon           ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("service_requests").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ order: await enrichOrder(sb, data as Record<string, unknown>) });
  } catch (e: any) {
    console.error("[app-pedidos/[id] GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: `Status inválido: ${body.status}` }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (typeof body.urgency === "string")        updates.urgency = body.urgency;
  if (body.estimated_price !== undefined)      updates.estimated_price = body.estimated_price;
  if (body.scheduled_for !== undefined)        updates.scheduled_for = body.scheduled_for;

  if (updates.status && CANCEL_STATUSES.has(updates.status as string)) {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json({ error: "Motivo obrigatório ao cancelar ou rejeitar." }, { status: 400 });
    }
  }

  const hasUpdates = Object.keys(updates).length > 0;
  const hasNote = typeof body.admin_note === "string" && (body.admin_note as string).trim().length > 0;

  if (!hasUpdates && !hasNote) {
    return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
  }

  const correlationId = `patch_${id.slice(0, 8)}_${Date.now().toString(36)}`;

  try {
    const sb = getSupabaseAdmin();

    const { data: current, error: fetchErr } = await sb
      .from("service_requests").select("*").eq("id", id).single();
    if (fetchErr || !current) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    let updated: Record<string, unknown> = current as Record<string, unknown>;
    if (hasUpdates) {
      const { data: patched, error: patchErr } = await sb
        .from("service_requests").update(updates).eq("id", id).select("*").single();
      if (patchErr || !patched) {
        console.error("[app-pedidos/[id] PATCH] update failed", { correlationId, patchErr });
        return NextResponse.json({ error: "Erro ao actualizar pedido.", correlation_id: correlationId }, { status: 500 });
      }
      updated = patched as Record<string, unknown>;
    }

    // Auditoria bloqueante: se falhar, tentar reverter e devolver erro claro.
    const actionType = updates.status ? "status_change" : hasNote ? "note" : "update";
    const opsEntry = {
      request_id:  id,
      colab_id:    colab!.id,
      colab_nome:  colab!.nome,
      action_type: actionType,
      status_from: updates.status ? (current as Record<string, unknown>).status ?? null : null,
      status_to:   updates.status ?? null,
      reason:      typeof body.reason === "string" ? body.reason.trim() || null : null,
      note:        hasNote ? (body.admin_note as string).trim() : null,
      data_json:   hasUpdates ? { changes: updates, correlation_id: correlationId } : { correlation_id: correlationId },
    };

    const { error: opsErr } = await sb.from("service_request_ops").insert([opsEntry]);
    if (opsErr) {
      console.error("[app-pedidos/[id] PATCH] audit insert failed", { correlationId, opsErr });

      if (hasUpdates) {
        const revertPayload: Record<string, unknown> = {};
        for (const k of Object.keys(updates)) {
          revertPayload[k] = (current as Record<string, unknown>)[k] ?? null;
        }
        const { error: revertErr } = await sb
          .from("service_requests").update(revertPayload).eq("id", id);
        if (revertErr) {
          console.error("[app-pedidos/[id] PATCH] REVERT ALSO FAILED", { correlationId, revertErr });
          return NextResponse.json({
            error: "Auditoria falhou e reversão da alteração também falhou. Estado inconsistente — contactar suporte.",
            correlation_id: correlationId,
          }, { status: 500 });
        }
      }

      return NextResponse.json({
        error: "Auditoria não pôde ser gravada. Alteração revertida — repete a operação.",
        correlation_id: correlationId,
        audit_error: opsErr.message,
      }, { status: 500 });
    }

    return NextResponse.json({ order: await enrichOrder(sb, updated) });
  } catch (e: any) {
    console.error("[app-pedidos/[id] PATCH]", { correlationId, error: e });
    return NextResponse.json({ error: "Erro interno.", correlation_id: correlationId }, { status: 500 });
  }
}
