import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Arquivar/restaurar um pedido. Arquivar esconde das listas operacionais
// sem apagar dados nem histórico. Requer a migração 005 (archived_at).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const archive = body.archived !== false; // default: arquivar
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

  try {
    const sb = getSupabaseAdmin();

    const { data: current, error: fetchErr } = await sb
      .from("service_requests").select("id, status, archived_at").eq("id", id).single();
    if (fetchErr && /archived_at/.test(fetchErr.message ?? "")) {
      return NextResponse.json({
        error: "Função de arquivo indisponível — executar a migração 005_archive_requests.sql no Supabase.",
      }, { status: 400 });
    }
    if (fetchErr || !current) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const alreadyArchived = (current as Record<string, unknown>).archived_at != null;
    if (archive === alreadyArchived) {
      return NextResponse.json({ error: archive ? "O pedido já está arquivado." : "O pedido não está arquivado." }, { status: 400 });
    }

    const { data: updated, error: updErr } = await sb
      .from("service_requests")
      .update({
        archived_at: archive ? new Date().toISOString() : null,
        archived_by: archive ? colab!.nome : null,
      })
      .eq("id", id)
      .select("id, archived_at")
      .single();

    if (updErr || !updated) {
      if (updErr && /archived_at|archived_by/.test(updErr.message ?? "")) {
        return NextResponse.json({
          error: "Função de arquivo indisponível — executar a migração 005_archive_requests.sql no Supabase.",
        }, { status: 400 });
      }
      console.error("[app-pedidos/archive]", updErr);
      return NextResponse.json({ error: "Erro ao actualizar o pedido." }, { status: 500 });
    }

    // Auditoria bloqueante; em falha, reverter
    const { error: opsErr } = await sb.from("service_request_ops").insert([{
      request_id:  id,
      colab_id:    colab!.id,
      colab_nome:  colab!.nome,
      action_type: archive ? "archive" : "unarchive",
      reason,
      data_json:   { archived: archive },
    }]);
    if (opsErr) {
      await sb.from("service_requests")
        .update({ archived_at: (current as Record<string, unknown>).archived_at ?? null, archived_by: null })
        .eq("id", id);
      console.error("[app-pedidos/archive] audit failed", opsErr);
      return NextResponse.json({ error: "Auditoria não pôde ser gravada. Operação revertida." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, archived_at: (updated as Record<string, unknown>).archived_at ?? null });
  } catch (e: any) {
    console.error("[app-pedidos/archive]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
