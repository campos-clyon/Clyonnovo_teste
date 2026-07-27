import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { quotePriceIsRequiredForStatus, validatedQuotePrice } from "@/lib/quote-approval";
import {
  nextPhase, isTerminalStatus, isWaitingOnCustomer, CUSTOMER_APPROVAL_STATUS,
} from "@/lib/order-status-flow";
import { hasUsablePrice } from "@/lib/quote-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Avança o pedido para a fase seguinte da sequência. O servidor determina
 * o próximo estado a partir do estado actual — o cliente não escolhe.
 *
 * Body opcional: { note?: string, estimated_price?: number }
 * (estimated_price é aceite para o avanço in_review → awaiting_deposit,
 *  que exige valor de orçamento.)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const correlationId = `advance_${id.slice(0, 8)}_${Date.now().toString(36)}`;

  try {
    const sb = getSupabaseAdmin();

    const { data: current, error: fetchErr } = await sb
      .from("service_requests").select("*").eq("id", id).single();
    if (fetchErr || !current) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const fromStatus = ((current as Record<string, unknown>).status as string) ?? "";
    if (isTerminalStatus(fromStatus)) {
      return NextResponse.json({
        error: `O pedido está num estado terminal ("${fromStatus}") — não há fase seguinte.`,
      }, { status: 400 });
    }

    const phase = nextPhase(fromStatus);
    if (!phase) {
      if (isWaitingOnCustomer(fromStatus)) {
        return NextResponse.json({
          error: "A decisão está com o cliente — ele pode aceitar, contrapor ou cancelar. O admin não avança esta fase.",
        }, { status: 400 });
      }
      return NextResponse.json({
        error: `Estado desconhecido "${fromStatus}" — usa a alteração manual de estado.`,
      }, { status: 400 });
    }

    // A proposta ao cliente NÃO pode ser criada por escrita de estado: sem uma
    // linha em price_proposals o pedido ficaria "à espera do cliente" sem nada
    // para ele decidir. Tem de passar por admin_send_price_proposal.
    if (phase.next === CUSTOMER_APPROVAL_STATUS) {
      return NextResponse.json({
        error: "Para avançar daqui é preciso enviar uma proposta de preço ao cliente (com valor e justificação), no painel de negociação.",
        requires_proposal: true,
      }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status: phase.next };

    // Avanço para awaiting_deposit/confirmed exige valor de orçamento.
    // NÃO validar só por estimated_price: com o motor novo o preço pode
    // viver em estimate_min/estimate_max, e bloquear aí obrigaria o operador
    // a inventar um valor que passaria a divergir da cotação e de
    // pricing_outcomes (NOTA-BRIDGE-MOTOR §3.1).
    if (quotePriceIsRequiredForStatus(phase.next)) {
      const bodyPrice = body.estimated_price;
      const ok = bodyPrice !== undefined
        ? validatedQuotePrice(bodyPrice) !== null
        : hasUsablePrice(current as never);
      if (!ok) {
        return NextResponse.json({
          error: `Para avançar para "${phase.next}" é necessário um valor de orçamento superior a 0 €. Preenche o valor primeiro.`,
        }, { status: 400 });
      }
      if (bodyPrice !== undefined) updates.estimated_price = validatedQuotePrice(bodyPrice)!;
    }

    const auditNote = note
      ? `${phase.actionLabel} — avanço automático de fase. ${note}`
      : `${phase.actionLabel} — avanço automático de fase.`;

    const auditFields = {
      colab_id:    colab!.id,
      colab_nome:  colab!.nome,
      action_type: "status_change",
      status_from: fromStatus,
      status_to:   phase.next,
      reason:      null as string | null,
      note:        auditNote,
      data_json:   { changes: updates, correlation_id: correlationId, advance: true },
    };

    // Caminho preferido: RPC transaccional (migração 004). Fallback: duas escritas.
    const { data: rpcRows, error: rpcErr } = await sb.rpc("patch_request_with_audit", {
      p_request_id:  id,
      p_updates:     updates,
      p_colab_id:    auditFields.colab_id,
      p_colab_nome:  auditFields.colab_nome,
      p_action_type: auditFields.action_type,
      p_status_from: auditFields.status_from,
      p_status_to:   auditFields.status_to,
      p_reason:      auditFields.reason,
      p_note:        auditFields.note,
      p_data_json:   auditFields.data_json,
    });

    if (!rpcErr) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row) {
        return NextResponse.json({ error: "Pedido não encontrado.", correlation_id: correlationId }, { status: 404 });
      }
      // Publicação aos parceiros: automática via trigger auto_match ao entrar
      // em confirmed/assignment_pending (CONTRATO.md §4) — não duplicar aqui.
      return NextResponse.json({
        ok: true,
        status: phase.next,
        action: phase.actionLabel,
        order: row,
      });
    }

    const rpcMissing = rpcErr.code === "PGRST202" || /function .* does not exist/i.test(rpcErr.message ?? "");
    if (!rpcMissing) {
      console.error("[app-pedidos/advance] rpc failed", { correlationId, rpcErr });

      // As regras de negócio da base vêm com uma mensagem escrita para quem
      // opera — ex.: um pedido em dinheiro sem telemóvel do cliente. Engolir
      // essa frase deixa o operador com "erro ao avançar" e nada para fazer.
      // P0001 é o RAISE EXCEPTION de um gatilho; 23514 é um CHECK.
      const daRegra = rpcErr.code === "P0001" || rpcErr.code === "23514";
      return NextResponse.json({
        error: daRegra && rpcErr.message
          ? rpcErr.message
          : "Erro ao avançar a fase (transacção revertida).",
        correlation_id: correlationId,
      }, { status: daRegra ? 400 : 500 });
    }

    // Fallback de compensação (migração 004 pendente)
    const { data: patched, error: patchErr } = await sb
      .from("service_requests").update(updates).eq("id", id).select("*").single();
    if (patchErr || !patched) {
      console.error("[app-pedidos/advance] update failed", { correlationId, patchErr });
      return NextResponse.json({ error: "Erro ao avançar a fase.", correlation_id: correlationId }, { status: 500 });
    }

    const { error: opsErr } = await sb.from("service_request_ops").insert([{ request_id: id, ...auditFields }]);
    if (opsErr) {
      // Reverter para manter consistência com a auditoria
      await sb.from("service_requests").update({ status: fromStatus }).eq("id", id);
      return NextResponse.json({
        error: "Auditoria não pôde ser gravada. Avanço revertido — repete a operação.",
        correlation_id: correlationId,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: phase.next,
      action: phase.actionLabel,
      order: patched,
    });
  } catch (e) {
    console.error("[app-pedidos/advance]", { correlationId, error: e });
    return NextResponse.json({ error: "Erro interno.", correlation_id: correlationId }, { status: 500 });
  }
}
