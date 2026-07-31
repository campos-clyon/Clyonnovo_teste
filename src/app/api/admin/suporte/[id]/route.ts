import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { respostaDeErroSupabase } from "@/lib/erro-supabase";
import { ehEstadoValido, resolvedAtPara, ESTADOS_TICKET } from "@/lib/suporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — o ticket, quem o escreveu, e a conversa toda por ordem. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();

    const { data: ticket, error } = await sb
      .from("support_tickets")
      .select("id, user_id, user_role, subject, description, category, priority, status, request_id, assigned_to, resolved_at, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[admin/suporte/[id]] falha a ler:", error);
      return NextResponse.json({ error: "Não foi possível carregar o pedido." }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ error: "Pedido de suporte não encontrado." }, { status: 404 });
    }

    const { data: perfil } = await sb
      .from("profiles").select("id, full_name, email, phone").eq("id", ticket.user_id).maybeSingle();

    // `select("*")` de propósito: a coluna author_label é acrescentada por
    // migração e, enquanto ela não correr, nomear a coluna faz a consulta
    // inteira falhar — a lista de suporte deixava de abrir por causa de um
    // campo que ainda nem é usado. Com "*", funciona antes e depois.
    const { data: mensagens } = await sb
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ticket: {
        ...ticket,
        autorNome:  perfil?.full_name ?? null,
        autorEmail: perfil?.email ?? null,
        autorTelefone: perfil?.phone ?? null,
      },
      mensagens: mensagens ?? [],
    });
  } catch (e) {
    return respostaDeErroSupabase("admin/suporte/[id]", e);
  }
}

/**
 * PATCH — muda o estado. Body: { status }
 *
 * Só os valores combinados com a app passam daqui. A app mostra o status em
 * bruto, em maiúsculas: escrever aqui um valor fora da lista põe essa palavra
 * no ecrã do cliente, tal e qual.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const status = body.status;

  if (!ehEstadoValido(status)) {
    return NextResponse.json(
      { error: `Estado inválido. Só ${ESTADOS_TICKET.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const sb = getSupabaseAdmin();
    const agora = new Date().toISOString();

    const { data, error } = await sb
      .from("support_tickets")
      .update({
        status,
        // Fechar marca a data; reabrir limpa-a. Um ticket reaberto com data
        // de resolução faz o tempo de resposta mentir para sempre.
        resolved_at: resolvedAtPara(status, agora),
        updated_at: agora,
      })
      .eq("id", id)
      .select("id, status, resolved_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("[admin/suporte/[id]] falha a gravar estado:", error);
      return NextResponse.json({ error: "Não foi possível mudar o estado." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Pedido de suporte não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ticket: data });
  } catch (e) {
    return respostaDeErroSupabase("admin/suporte/[id]", e);
  }
}
