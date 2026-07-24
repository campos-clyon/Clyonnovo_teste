import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ENTRY_STATUSES, ANALYSIS_STATUS, isApprovedStatus } from "@/lib/order-status-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Promoção automática à entrada: pedidos submetidos pelo cliente chegam
 * como "open" (app móvel) ou "received" — passam automaticamente a
 * "in_review" (Em análise) assim que entram no painel, com auditoria.
 * Não-bloqueante: uma falha aqui nunca impede a listagem.
 */
async function autoPromoteEntryOrders(
  sb: ReturnType<typeof getSupabaseAdmin>,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  // Pedidos aprovados na app (final_price > 0) mas ainda em fase de entrada/
  // análise: o estado deve reflectir a aprovação — avançam para "confirmed",
  // o estado canónico de aprovação (CONTRATO.md §3). O trigger auto_match
  // publica aos parceiros e avança para assignment_pending sozinho.
  const PRE_APPROVAL = new Set([...(ENTRY_STATUSES as readonly string[]), ANALYSIS_STATUS]);
  const toPromote = rows
    .map((row) => {
      const status = (row.status as string) ?? "";
      const finalPrice = typeof row.final_price === "number" ? row.final_price : Number(row.final_price ?? 0);
      if (PRE_APPROVAL.has(status) && finalPrice > 0) {
        return {
          row,
          target: "confirmed",
          note: "Orçamento aprovado na app — estado actualizado automaticamente para Confirmado (publicação aos parceiros é automática).",
        };
      }
      if ((ENTRY_STATUSES as readonly string[]).includes(status)) {
        return {
          row,
          target: ANALYSIS_STATUS,
          note: "Entrada automática em análise — pedido submetido pelo cliente.",
        };
      }
      return null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (toPromote.length === 0) return;

  await Promise.allSettled(toPromote.map(async ({ row, target, note }) => {
    const id = row.id as string;
    const fromStatus = row.status as string;

    const { error: updErr } = await sb
      .from("service_requests")
      .update({ status: target })
      .eq("id", id)
      .eq("status", fromStatus); // condicional — evita corrida com outra alteração
    if (updErr) {
      console.error("[app-pedidos] auto-promote falhou", { id, updErr });
      return;
    }

    // Reflectir na resposta desta listagem
    row.status = target;

    const { error: opsErr } = await sb.from("service_request_ops").insert([{
      request_id:  id,
      colab_id:    0,
      colab_nome:  "Sistema",
      action_type: "status_change",
      status_from: fromStatus,
      status_to:   target,
      reason:      null,
      note,
      data_json:   { auto: true },
    }]);
    if (opsErr) console.error("[app-pedidos] auto-promote audit falhou", { id, opsErr });
  }));
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const showArchived = searchParams.get("archived") === "1";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const sb = getSupabaseAdmin();

    const buildQuery = (withArchiveFilter: boolean) => {
      let query = sb
        .from("service_requests")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status && status !== "todos") query = query.eq("status", status);
      if (withArchiveFilter) {
        query = showArchived
          ? query.not("archived_at", "is", null)
          : query.is("archived_at", null);
      }
      return query;
    };

    let { data, error, count } = await buildQuery(true);

    // Coluna archived_at pode não existir (migração 005 pendente) — repetir sem filtro
    if (error && /archived_at/.test(error.message ?? "")) {
      if (showArchived) {
        return NextResponse.json({ orders: [], total: 0, archive_unavailable: true });
      }
      ({ data, error, count } = await buildQuery(false));
    }

    if (error) {
      console.error("[app-pedidos] supabase error:", error);
      return NextResponse.json({ error: `Erro ao buscar pedidos: ${error.message}` }, { status: 500 });
    }

    const rows = data ?? [];

    // Novos pedidos entram automaticamente em análise
    await autoPromoteEntryOrders(sb, rows as Array<Record<string, unknown>>);

    // Fetch customer profiles for all unique customer_ids
    const customerIds = [...new Set(rows.map((r: any) => r.customer_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);
      for (const p of profiles ?? []) {
        profilesMap[p.id] = p;
      }
    }

    // Fetch category names for all unique category_slugs
    const categorySlugs = [...new Set(rows.map((r: any) => r.category_slug).filter(Boolean))];
    let categoriesMap: Record<string, any> = {};
    if (categorySlugs.length > 0) {
      const { data: cats } = await sb
        .from("service_categories")
        .select("slug, name, icon")
        .in("slug", categorySlugs);
      for (const c of cats ?? []) {
        categoriesMap[c.slug] = c;
      }
    }

    const asString = (v: any): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      return null; // discard objects/arrays — cannot be safely rendered as text
    };

    const orders = rows.map((row: any) => {
      const profile = profilesMap[row.customer_id] ?? {};
      const cat = categoriesMap[row.category_slug] ?? {};
      return {
        id:              String(row.id ?? ""),
        title:           asString(row.details) || asString(cat.name) || asString(row.category_slug) || "Pedido",
        description:     asString(row.notes) ?? "",
        location:        asString(row.address_line) ?? "",
        district:        asString(row.region) ?? "",
        city:            asString(row.city) ?? "",
        urgency:         asString(row.urgency) ?? "normal",
        budget_range:    (row.estimated_price ?? row.final_price) != null ? `€${row.estimated_price ?? row.final_price}` : null,
        preferred_date:  asString(row.scheduled_for),
        status:          asString(row.status) ?? "open",
        approved:        isApprovedStatus(asString(row.status)) || Number(row.final_price ?? 0) > 0,
        photos:          Array.isArray(row.photos) ? row.photos.filter((p: any) => typeof p === "string") : [],
        created_at:      asString(row.created_at) ?? "",
        updated_at:      asString(row.updated_at) ?? asString(row.created_at) ?? "",
        client_name:     asString(profile.full_name),
        client_email:    asString(profile.email),
        client_phone:    asString(profile.phone),
        category_name:   asString(cat.name) ?? asString(row.category_slug),
        category_icon:   asString(cat.icon),
        archived_at:     asString(row.archived_at),
        responses_count: 0,
      };
    });

    return NextResponse.json({ orders, total: count ?? orders.length });
  } catch (err: any) {
    console.error("[app-pedidos] unexpected error:", err);
    return NextResponse.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 });
  }
}
