import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Propostas de horário (tabela schedule_proposals do Bridge).
 *
 * Depois de aceitar um trabalho, o profissional pode propor outra hora. Antes
 * disto a única via era o chat — e a data no sistema ficava errada, que é a
 * data que o painel mostra, que a agenda usa e que gera os lembretes.
 *
 * Uma proposta `pending` significa que o pedido está à espera do CLIENTE.
 * Não há tolerância automática como nos ajustes de preço: uma hora ou serve
 * ou não serve, e só a pessoa sabe. `scheduled_for` só muda com um accept.
 */

type Proposal = {
  id: string;
  request_id: string;
  partner_id: string;
  previous_for: string | null;
  proposed_for: string;
  reason: string | null;
  status: "pending" | "accepted" | "rejected" | "canceled";
  created_at: string;
  responded_at: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();

    const { data, error } = await sb
      .from("schedule_proposals")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      // A tabela só existe depois da migração 20260726110000 — até lá o
      // painel ignora a secção em vez de mostrar um erro ao operador.
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "")) {
        return NextResponse.json({ proposals: [], unavailable: true });
      }
      console.error("[horario GET]", { id, error });
      return NextResponse.json({ error: `Erro ao carregar propostas de horário: ${error.message}` }, { status: 500 });
    }

    const proposals = (data ?? []) as Proposal[];
    const pending = proposals.find((p) => p.status === "pending") ?? null;

    // Nome comercial de quem propôs — a tabela só guarda o id
    const partnerIds = [...new Set(proposals.map((p) => p.partner_id).filter(Boolean))];
    const nomes: Record<string, string> = {};
    if (partnerIds.length > 0) {
      const { data: parceiros } = await sb
        .from("partner_profiles").select("id, trade_name").in("id", partnerIds);
      for (const p of (parceiros ?? []) as Array<Record<string, unknown>>) {
        nomes[String(p.id)] = String(p.trade_name ?? "Profissional");
      }
    }

    return NextResponse.json({
      proposals: proposals.map((p) => ({ ...p, partner_name: nomes[p.partner_id] ?? null })),
      pending: pending ? { ...pending, partner_name: nomes[pending.partner_id] ?? null } : null,
      awaitingCustomer: pending !== null,
    });
  } catch (e) {
    console.error("[horario GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
