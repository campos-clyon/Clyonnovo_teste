import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
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

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

async function enrichOrder(sb: ReturnType<typeof getSupabaseAdmin>, row: Record<string, unknown>) {
  const customerId = row.customer_id as string | null;
  const categorySlug = row.category_slug as string | null;

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
    ...row,
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
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;

  // Campos operacionais permitidos — dados originais do cliente são imutáveis
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

  // Motivo obrigatório ao cancelar ou rejeitar
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

  try {
    const sb = getSupabaseAdmin();

    // Validar existência e obter estado actual (para status_from no log)
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
        return NextResponse.json({ error: "Erro ao actualizar pedido." }, { status: 500 });
      }
      updated = patched as Record<string, unknown>;
    }

    // Registar no log de operações
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
      data_json:   hasUpdates ? { changes: updates } : null,
    };
    // Log em background; não falha o pedido principal se a tabela ainda não existir
    await sb.from("service_request_ops").insert([opsEntry]).then(() => null, () => null);

    return NextResponse.json({ order: await enrichOrder(sb, updated) });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
