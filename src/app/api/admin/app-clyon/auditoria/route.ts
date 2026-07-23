import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;
  const requestId = url.searchParams.get("request_id") ?? undefined;

  try {
    const sb = getSupabaseAdmin();
    let query = sb
      .from("service_request_ops")
      .select("id, request_id, colab_nome, action_type, status_from, status_to, reason, note, data_json, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (requestId) query = query.eq("request_id", requestId);

    const { data, error, count } = await query;

    if (error) {
      // Tabela pode não existir ainda — retorna lista vazia
      return NextResponse.json({ ops: [], total: 0, page, limit });
    }

    return NextResponse.json({ ops: data ?? [], total: count ?? 0, page, limit });
  } catch {
    return NextResponse.json({ ops: [], total: 0, page, limit });
  }
}
