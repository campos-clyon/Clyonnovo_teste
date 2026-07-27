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

    // O histórico do painel só via as operações dos colaboradores. Há coisas
    // que acontecem sem ninguém carregar em nada — o webhook da euPago a
    // confirmar um pagamento, o agendador a cancelar uma reserva por pagar ao
    // fim de 7 dias. Sem estas linhas, o pedido parecia cancelar-se sozinho.
    const { data: eventos } = await sb
      .from("request_events")
      .select("id, event_type, actor_role, note, created_at")
      .eq("request_id", id)
      .eq("actor_role", "system")
      .order("created_at", { ascending: false })
      .limit(50);

    const doSistema = (eventos ?? []).map((e: Record<string, unknown>) => ({
      id: `evt:${String(e.id)}`,
      action_type: String(e.event_type ?? "system"),
      status_from: null,
      status_to: null,
      reason: null,
      note: typeof e.note === "string" ? e.note : null,
      data_json: null,
      colab_nome: "Sistema",
      created_at: e.created_at,
    }));

    if (error) {
      // Tabela pode não existir ainda (migração pendente)
      return NextResponse.json({ ops: doSistema });
    }

    const ops = [...(data ?? []), ...doSistema].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    );
    return NextResponse.json({ ops });
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
