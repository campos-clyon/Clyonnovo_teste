import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { validatedQuotePrice, validateProposal } from "@/lib/quote-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Negociação de preço com o cliente — lado do backoffice (plano §8).
 *
 * Toda a escrita passa pelas RPCs do Bridge; este painel NUNCA escreve
 * `status` nem `final_price` para estas acções:
 *   · admin_send_price_proposal(_request_id, _amount, _message)
 *   · admin_accept_counter_proposal(_request_id)
 *
 * A contagem de contrapropostas do cliente é DERIVADA da tabela
 * price_proposals (plano §5) e usada só para mostrar; o limite de 2 é
 * imposto pela RPC customer_counter_proposal, não aqui.
 */

/** Dependências do Bridge que este ecrã precisa (fases 1–2 do plano). */
function bridgeDependencyError(error: { code?: string; message?: string }): string | null {
  const msg = error.message ?? "";
  if (error.code === "PGRST202" || /function .* does not exist/i.test(msg)) {
    return "A negociação de preço ainda não está disponível: as funções do Bridge (admin_send_price_proposal / admin_accept_counter_proposal) ainda não foram criadas na base de dados.";
  }
  if (error.code === "42P01" || /relation .*price_proposals.* does not exist/i.test(msg)) {
    return "A tabela price_proposals ainda não existe na base de dados — aguarda a fase 1 do Bridge.";
  }
  // Bloqueio conhecido: as RPCs admin_* validam has_role(auth.uid(), 'admin'),
  // e auth.uid() é NULL quando se usa a chave service_role.
  if (error.code === "42501" || /permission|not authorized|apenas admin|auth\.uid/i.test(msg)) {
    return "A função recusou a chamada por falta de identidade de administrador. É o bloqueio conhecido auth.uid() vs service_role — o painel autentica com service_role, e as RPCs admin_* exigem um utilizador admin real. Decisão pendente no CONTRATO.md.";
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("price_proposals")
      .select("*")
      .eq("request_id", id)
      .order("round", { ascending: false });

    if (error) {
      const dep = bridgeDependencyError(error);
      if (dep) return NextResponse.json({ rounds: [], unavailable: true, notice: dep });
      return NextResponse.json({ error: `Erro ao carregar propostas: ${error.message}` }, { status: 500 });
    }

    const rounds = data ?? [];
    // Derivada, nunca guardada (plano §5)
    const customerCounters = rounds.filter((r: { actor?: string }) => r.actor === "customer").length;
    const pending = rounds.find((r: { status?: string }) => r.status === "pending") ?? null;

    return NextResponse.json({
      rounds,
      pending,
      customerCounters,
      counterLimit: 2,
      // A bola está do lado do admin quando a proposta viva é do cliente
      awaitingAdmin: pending?.actor === "customer",
    });
  } catch (e) {
    console.error("[proposta GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as {
    action?: "send" | "accept_counter";
    amount?: number | string;
    message?: string;
  };

  try {
    const sb = getSupabaseAdmin();

    if (body.action === "accept_counter") {
      const { data, error } = await sb.rpc("admin_accept_counter_proposal", { _request_id: id });
      if (error) {
        const dep = bridgeDependencyError(error);
        console.error("[proposta accept_counter]", { id, error });
        return NextResponse.json({ error: dep ?? `Não foi possível aceitar a contraproposta: ${error.message}` }, { status: dep ? 503 : 400 });
      }
      return NextResponse.json({
        ok: true,
        result: data,
        message: "Contraproposta aceite. O cliente avança para o pagamento da reserva; o pedido só é publicado depois disso.",
      });
    }

    if (body.action === "send") {
      // Validação partilhada com a UI (justificação obrigatória — plano §9)
      const check = validateProposal(body.amount, body.message);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      const amount = validatedQuotePrice(body.amount)!;
      const message = String(body.message).trim();

      const { data, error } = await sb.rpc("admin_send_price_proposal", {
        _request_id: id,
        _amount: amount,
        _message: message,
      });
      if (error) {
        const dep = bridgeDependencyError(error);
        console.error("[proposta send]", { id, error });
        return NextResponse.json({ error: dep ?? `Não foi possível enviar a proposta: ${error.message}` }, { status: dep ? 503 : 400 });
      }
      return NextResponse.json({
        ok: true,
        result: data,
        message: "Proposta enviada ao cliente. O pedido fica à espera da decisão dele e não é visível aos profissionais.",
      });
    }

    return NextResponse.json({ error: "Acção inválida — usar send ou accept_counter." }, { status: 400 });
  } catch (e) {
    console.error("[proposta POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
