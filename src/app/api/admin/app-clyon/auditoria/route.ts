import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auditoria consolidada.
// - source=ops (default): service_request_ops → operações internas em pedidos
// - source=admin: admin_audit_log → acções administrativas gerais
//
// admin_audit_log schema real:
//   id, actor_user_id, action, entity_type, entity_id,
//   old_value (jsonb), new_value (jsonb), reason, ip_address, created_at
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;
  const requestId = url.searchParams.get("request_id") ?? undefined;
  const actionType = url.searchParams.get("action_type") ?? undefined;
  const colabQ = url.searchParams.get("colab") ?? undefined;
  const source = url.searchParams.get("source") === "admin" ? "admin" : "ops";

  const sb = getSupabaseAdmin();

  if (source === "admin") {
    let q = sb
      .from("admin_audit_log")
      .select("id, actor_user_id, action, entity_type, entity_id, old_value, new_value, reason, ip_address, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (actionType) q = q.eq("action", actionType);

    const { data, error, count } = await q;
    if (error) {
      console.error("[app-clyon/auditoria] admin_audit_log error", error);
      return NextResponse.json(
        { error: "Erro ao consultar admin_audit_log.", details: error.message },
        { status: 502 }
      );
    }

    // Resolver actor_user_id → nome via profiles (best-effort)
    const rows = data ?? [];
    const actorIds = [...new Set(rows.map((r: any) => r.actor_user_id).filter(Boolean))];
    const namesMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await sb
        .from("profiles").select("id, full_name, email").in("id", actorIds);
      for (const p of profs ?? []) {
        namesMap[String(p.id)] = p.full_name || p.email || String(p.id).slice(0, 8);
      }
    }

    // Aplicar filtro por nome do actor depois de resolver
    let ops = rows.map((a: any) => ({
      id: a.id,
      request_id: a.entity_type === "service_request" ? a.entity_id : null,
      colab_nome: namesMap[String(a.actor_user_id)] ?? (a.actor_user_id ? String(a.actor_user_id).slice(0, 8) : "sistema"),
      action_type: a.action,
      status_from: (a.old_value && typeof a.old_value === "object" && "status" in a.old_value) ? a.old_value.status : null,
      status_to:   (a.new_value && typeof a.new_value === "object" && "status" in a.new_value) ? a.new_value.status : null,
      reason: a.reason,
      note: null,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      old_value: a.old_value,
      new_value: a.new_value,
      created_at: a.created_at,
    }));

    if (colabQ) {
      const needle = colabQ.toLowerCase();
      ops = ops.filter((o: any) => (o.colab_nome ?? "").toLowerCase().includes(needle));
    }

    return NextResponse.json({ ops, total: count ?? 0, page, limit, source });
  }

  // source === "ops"
  let query = sb
    .from("service_request_ops")
    .select("id, request_id, colab_nome, action_type, status_from, status_to, reason, note, data_json, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (requestId) query = query.eq("request_id", requestId);
  if (actionType) query = query.eq("action_type", actionType);
  if (colabQ) query = query.ilike("colab_nome", `%${colabQ}%`);

  const { data, error, count } = await query;

  if (error) {
    console.error("[app-clyon/auditoria] service_request_ops error", error);
    return NextResponse.json(
      { error: "Erro ao consultar service_request_ops.", details: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ops: data ?? [], total: count ?? 0, page, limit, source });
}
