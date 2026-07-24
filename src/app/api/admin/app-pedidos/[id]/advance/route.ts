import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { quotePriceIsRequiredForStatus, validatedQuotePrice } from "@/lib/quote-approval";
import { nextPhase, isTerminalStatus } from "@/lib/order-status-flow";

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
      return NextResponse.json({
        error: `Estado desconhecido "${fromStatus}" — usa a alteração manual de estado.`,
      }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status: phase.next };

    // Avanço para awaiting_deposit/confirmed exige valor de orçamento —
    // aceita o valor enviado no body ou o já existente no pedido.
    if (quotePriceIsRequiredForStatus(phase.next)) {
      const bodyPrice = body.estimated_price;
      const effectivePrice = bodyPrice !== undefined
        ? bodyPrice
        : (current as Record<string, unknown>).estimated_price;
      const price = validatedQuotePrice(effectivePrice);
      if (price === null) {
        return NextResponse.json({
          error: `Para avançar para "${phase.next}" é necessário um valor de orçamento superior a 0 €. Preenche o valor primeiro.`,
        }, { status: 400 });
      }
      if (bodyPrice !== undefined) updates.estimated_price = price;
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
      return NextResponse.json({
        error: "Erro ao avançar a fase (transacção revertida).",
        correlation_id: correlationId,
      }, { status: 500 });
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
