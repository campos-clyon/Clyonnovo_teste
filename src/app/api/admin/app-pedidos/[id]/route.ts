import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { quotePriceIsRequiredForStatus, validatedQuotePrice } from "@/lib/quote-approval";
import { isValidTransition, validTargets } from "@/lib/order-status-flow";

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

// Converte o conteúdo de service_requests.photos em URLs visualizáveis.
// URLs http(s) passam directamente; paths de Storage geram signed URLs (1h),
// tentando os buckets existentes (o nome do bucket não está no path guardado).
async function resolvePhotoUrls(
  sb: ReturnType<typeof getSupabaseAdmin>,
  photos: unknown,
): Promise<string[]> {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const out: string[] = [];
  let buckets: string[] | null = null;

  for (const p of photos) {
    if (typeof p !== "string" || !p.trim()) continue;
    if (/^https?:\/\//i.test(p)) { out.push(p); continue; }

    if (buckets === null) {
      const { data } = await sb.storage.listBuckets();
      const score = (n: string) =>
        /photo|foto|image|request|upload|pedido/i.test(n) ? 1 : 0;
      buckets = (data ?? []).map((b) => b.name).sort((a, b) => score(b) - score(a));
    }

    const path = p.replace(/^\/+/, "");
    for (const bucket of buckets) {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) { out.push(data.signedUrl); break; }
    }
  }
  return out;
}

async function enrichOrder(sb: ReturnType<typeof getSupabaseAdmin>, row: Record<string, unknown>) {
  const safe = normalizeOrder(row);
  const customerId = safe.customer_id as string | null;
  const categorySlug = safe.category_slug as string | null;

  const [profileRes, catRes, photoUrls] = await Promise.all([
    customerId
      ? sb.from("profiles").select("id, full_name, email, phone").eq("id", customerId).single()
      : Promise.resolve({ data: null }),
    categorySlug
      ? sb.from("service_categories").select("slug, name, icon").eq("slug", categorySlug).single()
      : Promise.resolve({ data: null }),
    resolvePhotoUrls(sb, row.photos),
  ]);
  safe.photos = photoUrls;

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
  if (typeof body.urgency === "string") updates.urgency = body.urgency;
  if (body.estimated_price !== undefined) {
    if (body.estimated_price === null) {
      updates.estimated_price = null;
    } else {
      const rawPrice = body.estimated_price;
      if (typeof rawPrice !== "number" && typeof rawPrice !== "string") {
        return NextResponse.json({ error: "O valor do orçamento deve ser um número igual ou superior a 0 €." }, { status: 400 });
      }
      const normalizedPrice = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
      if ((typeof rawPrice === "string" && rawPrice.trim() === "") || !Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
        return NextResponse.json({ error: "O valor do orçamento deve ser um número igual ou superior a 0 €." }, { status: 400 });
      }
      updates.estimated_price = normalizedPrice;
    }
  }
  if (body.scheduled_for !== undefined) updates.scheduled_for = body.scheduled_for;

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

    // Máquina de estados: a transição tem de respeitar a sequência de fases
    // (in_review → awaiting_deposit → … → completed). Override manual
    // explícito com force: true fica registado como tal na auditoria.
    const isForced = body.force === true;
    if (updates.status && !isForced) {
      const from = ((current as Record<string, unknown>).status as string) ?? "";
      const to = updates.status as string;
      if (!isValidTransition(from, to)) {
        return NextResponse.json({
          error: `Transição inválida: "${from}" → "${to}". A sequência de fases permite: ${validTargets(from).join(", ") || "nenhuma (estado terminal)"}. Usa o override manual para forçar.`,
          valid_targets: validTargets(from),
        }, { status: 400 });
      }
    }

    // "Aguarda depósito" é o estado de orçamento aprovado; "Confirmado" é
    // a etapa seguinte. Ambos exigem que exista um valor positivo, mesmo se a
    // chamada vier de outra interface administrativa.
    if (quotePriceIsRequiredForStatus(updates.status as string | undefined)) {
      const effectivePrice = updates.estimated_price !== undefined
        ? updates.estimated_price
        : (current as Record<string, unknown>).estimated_price;
      if (validatedQuotePrice(effectivePrice) === null) {
        return NextResponse.json({
          error: "Indique um valor de orçamento superior a 0 € antes de colocar o pedido a aguardar depósito ou confirmá-lo.",
        }, { status: 400 });
      }
    }

    const actionType = updates.status ? "status_change" : hasNote ? "note" : "update";
    const auditFields = {
      colab_id:    colab!.id,
      colab_nome:  colab!.nome,
      action_type: actionType,
      status_from: updates.status ? ((current as Record<string, unknown>).status as string | null) ?? null : null,
      status_to:   (updates.status as string | undefined) ?? null,
      reason:      typeof body.reason === "string" ? body.reason.trim() || null : null,
      note:        hasNote ? (body.admin_note as string).trim() : null,
      data_json:   hasUpdates
        ? { changes: updates, correlation_id: correlationId, ...(isForced && updates.status ? { forced: true } : {}) }
        : { correlation_id: correlationId },
    };

    // Caminho preferido: RPC transaccional (migração 004) — update + auditoria
    // no mesmo commit, com lock de linha. Fallback: compensação em duas escritas.
    const { data: rpcRows, error: rpcErr } = await sb.rpc("patch_request_with_audit", {
      p_request_id:  id,
      p_updates:     hasUpdates ? updates : {},
      p_colab_id:    auditFields.colab_id,
      p_colab_nome:  auditFields.colab_nome,
      p_action_type: auditFields.action_type,
      p_status_from: auditFields.status_from,
      p_status_to:   auditFields.status_to,
      p_reason:      auditFields.reason,
      p_note:        auditFields.note,
      p_data_json:   auditFields.data_json,
    });

    if (!rpcErr) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row) {
        return NextResponse.json({ error: "Pedido não encontrado.", correlation_id: correlationId }, { status: 404 });
      }
      // Publicação aos parceiros: automática via trigger auto_match ao entrar
      // em confirmed/assignment_pending (CONTRATO.md §4) — não duplicar aqui.
      return NextResponse.json({ order: await enrichOrder(sb, row as Record<string, unknown>) });
    }

    // RPC inexistente (migração 004 ainda não executada) → fallback.
    // Qualquer outro erro da RPC é falha real e devolve 500 sem escrever nada
    // (a transacção reverteu tudo do lado do Postgres).
    const rpcMissing = rpcErr.code === "PGRST202" || /function .* does not exist/i.test(rpcErr.message ?? "");
    if (!rpcMissing) {
      console.error("[app-pedidos/[id] PATCH] rpc failed", { correlationId, rpcErr });
      return NextResponse.json({
        error: "Erro ao actualizar pedido (transacção revertida).",
        correlation_id: correlationId,
        details: rpcErr.message,
      }, { status: 500 });
    }
    console.warn("[app-pedidos/[id] PATCH] RPC patch_request_with_audit ausente — usar fallback de compensação. Executar supabase/migrations/004_patch_request_with_audit.sql.", { correlationId });

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
    const { error: opsErr } = await sb.from("service_request_ops").insert([{ request_id: id, ...auditFields }]);
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

// Eliminação definitiva de um pedido. Irreversível: o histórico em
// service_request_ops é removido em cascata, por isso um instantâneo
// completo é gravado primeiro em admin_audit_log (sem FK, sobrevive).
// Se esse registo falhar, a eliminação é abortada.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "Motivo obrigatório para eliminar um pedido." }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();

    const { data: current, error: fetchErr } = await sb
      .from("service_requests").select("*").eq("id", id).single();
    if (fetchErr || !current) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const { error: logErr } = await sb.from("admin_audit_log").insert([{
      action:      "delete_request",
      entity_type: "service_request",
      entity_id:   id,
      old_value:   { ...current, _deleted_by: `${colab!.id}:${colab!.nome}` },
      reason,
    }]);
    if (logErr) {
      console.error("[app-pedidos/[id] DELETE] audit log failed — abort", logErr);
      return NextResponse.json({
        error: "Não foi possível registar a eliminação em auditoria. Operação abortada.",
      }, { status: 500 });
    }

    const { error: delErr } = await sb.from("service_requests").delete().eq("id", id);
    if (delErr) {
      console.error("[app-pedidos/[id] DELETE]", delErr);
      return NextResponse.json({ error: "Erro ao eliminar o pedido." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[app-pedidos/[id] DELETE]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
