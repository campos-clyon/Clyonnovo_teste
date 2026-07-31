import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { respostaDeErroSupabase } from "@/lib/erro-supabase";
import { ESTADOS_POR_TRATAR, ehEstadoValido } from "@/lib/suporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/suporte
 *
 * A lista que não existia. Os pedidos de ajuda eram gravados no Supabase e
 * não havia nada, em lado nenhum, que os mostrasse a uma pessoa — quem
 * escrevia via "OPEN" no ecrã e ficava à espera de ninguém.
 *
 * Por omissão vêm os que ainda pedem trabalho, MAIS ANTIGO PRIMEIRO. Numa
 * lista de suporte, o mais recente no topo é exactamente ao contrário do que
 * interessa: quem está à espera há mais tempo é quem tem de aparecer.
 *
 * O RLS destas tabelas não nos afecta — o painel entra pelo service_role, do
 * lado do servidor, que passa ao lado das políticas. O painel não é um
 * utilizador do Supabase: é um colaborador do MySQL com JWT próprio.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado") ?? "por_tratar";
  const limite = Math.min(300, Math.max(1, Number(url.searchParams.get("limite") ?? "100")));

  try {
    const sb = getSupabaseAdmin();

    let query = sb
      .from("support_tickets")
      .select("id, user_id, user_role, subject, description, category, priority, status, request_id, resolved_at, created_at, updated_at")
      .order("created_at", { ascending: true })
      .limit(limite);

    if (estado === "por_tratar") {
      query = query.in("status", ESTADOS_POR_TRATAR);
    } else if (ehEstadoValido(estado)) {
      query = query.eq("status", estado);
    }
    // "todos" não filtra

    const { data: tickets, error } = await query;
    if (error) {
      console.error("[admin/suporte] falha a ler tickets:", error);
      return NextResponse.json({ error: "Não foi possível carregar os pedidos de suporte." }, { status: 500 });
    }

    const linhas = tickets ?? [];

    // uuid não diz nada a ninguém — o nome vem de profiles, como nas outras
    // secções do painel.
    const nomes: Record<string, { nome: string | null; email: string | null }> = {};
    const userIds = [...new Set(linhas.map((t) => t.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: perfis } = await sb
        .from("profiles").select("id, full_name, email").in("id", userIds);
      for (const p of perfis ?? []) {
        nomes[String(p.id)] = { nome: p.full_name ?? null, email: p.email ?? null };
      }
    }

    // Quantas mensagens tem cada um, para se ver de relance o que já teve
    // resposta e o que ainda está calado.
    const contagemMensagens: Record<string, number> = {};
    if (linhas.length > 0) {
      const { data: msgs } = await sb
        .from("support_ticket_messages")
        .select("ticket_id")
        .in("ticket_id", linhas.map((t) => t.id));
      for (const m of msgs ?? []) {
        const k = String(m.ticket_id);
        contagemMensagens[k] = (contagemMensagens[k] ?? 0) + 1;
      }
    }

    // O contador do menu conta sempre o total por tratar, independentemente
    // do filtro que estiver a ser visto.
    const { count: porTratar } = await sb
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ESTADOS_POR_TRATAR);

    return NextResponse.json({
      tickets: linhas.map((t) => ({
        ...t,
        autorNome:  nomes[String(t.user_id)]?.nome ?? null,
        autorEmail: nomes[String(t.user_id)]?.email ?? null,
        mensagens:  contagemMensagens[String(t.id)] ?? 0,
      })),
      porTratar: porTratar ?? 0,
    });
  } catch (e) {
    return respostaDeErroSupabase("admin/suporte", e);
  }
}
