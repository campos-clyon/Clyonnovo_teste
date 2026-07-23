import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("service_request_ops")
      .select("id, action_type, status_from, status_to, reason, note, data_json, colab_nome, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Tabela pode não existir ainda (migração pendente); retorna lista vazia
      return NextResponse.json({ ops: [] });
    }
    return NextResponse.json({ ops: data ?? [] });
  } catch {
    return NextResponse.json({ ops: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return NextResponse.json({ error: "Nota obrigatória." }, { status: 400 });

  try {
    const sb = getSupabaseAdmin();

    // Verificar que o pedido existe
    const { data: exists } = await sb.from("service_requests").select("id").eq("id", id).single();
    if (!exists) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const { data, error } = await sb.from("service_request_ops").insert([{
      request_id:  id,
      colab_id:    colab!.id,
      colab_nome:  colab!.nome,
      action_type: "note",
      note,
    }]).select("*").single();

    if (error) return NextResponse.json({ error: "Erro ao guardar nota." }, { status: 500 });
    return NextResponse.json({ op: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
