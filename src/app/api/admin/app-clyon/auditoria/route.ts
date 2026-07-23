import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auditoria consolidada: cruza service_request_ops (operações sobre pedidos)
// e admin_audit_log (acções administrativas gerais) quando existir.
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
  const source = url.searchParams.get("source") ?? "ops"; // "ops" | "admin"

  try {
    const sb = getSupabaseAdmin();

    if (source === "admin") {
      // Log administrativo geral
      let q = sb
        .from("admin_audit_log")
        .select("id, actor_id, actor_name, action, target_type, target_id, meta, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (colabQ) q = q.ilike("actor_name", `%${colabQ}%`);
      if (actionType) q = q.eq("action", actionType);
      const { data, error, count } = await q;
      if (error) return NextResponse.json({ ops: [], total: 0, page, limit, source });
      const ops = (data ?? []).map((a: any) => ({
        id: a.id,
        request_id: a.target_type === "service_request" ? a.target_id : null,
        colab_nome: a.actor_name,
        action_type: a.action,
        status_from: null,
        status_to: null,
        reason: null,
        note: a.meta?.note ?? null,
        data_json: a.meta ?? null,
        created_at: a.created_at,
      }));
      return NextResponse.json({ ops, total: count ?? 0, page, limit, source });
    }

    // Operações sobre pedidos
    let query = sb
      .from("service_request_ops")
      .select("id, request_id, colab_nome, action_type, status_from, status_to, reason, note, data_json, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (requestId) query = query.eq("request_id", requestId);
    if (actionType) query = query.eq("action_type", actionType);
    if (colabQ) query = query.ilike("colab_nome", `%${colabQ}%`);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ ops: [], total: 0, page, limit, source });

    return NextResponse.json({ ops: data ?? [], total: count ?? 0, page, limit, source });
  } catch {
    return NextResponse.json({ ops: [], total: 0, page, limit, source });
  }
}
