import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Conciliação de pagamentos — referências emitidas pela app.
 *
 * Desde 27-07-2026 um pedido NÃO avança sozinho quando o cliente carrega em
 * "Pagar reserva": com MB WAY, Revolut e transferência o pagamento é
 * assíncrono, e nesse instante ainda não entrou dinheiro nenhum. O pedido
 * fica em `awaiting_deposit` até alguém confirmar que o dinheiro chegou —
 * e esse alguém é este ecrã.
 *
 * Confirmar é o que dispara a publicação aos profissionais. Sem isso, os
 * pedidos ficam parados para sempre.
 */

const METODO_LABEL: Record<string, string> = {
  mbway: "MB WAY", card: "Revolut", transfer: "Transferência", cash: "Dinheiro",
  M: "MB WAY", R: "Revolut", T: "Transferência", D: "Dinheiro",
};

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toUpperCase() ?? "";
  const apenasPendentes = url.searchParams.get("pendentes") === "1";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

  try {
    const sb = getSupabaseAdmin();

    // A vista já traz tudo calculado e ignora RLS (corre como dono).
    let query = sb
      .from("payment_reconciliation")
      .select("*")
      .order("emitida_em", { ascending: false })
      .limit(limit);
    if (apenasPendentes) query = query.eq("conciliada", false);

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "")) {
        return NextResponse.json({
          references: [], unavailable: true,
          notice: "A vista payment_reconciliation ainda não existe nesta base — aplica a migração 20260727100000.",
        });
      }
      console.error("[referencias]", error);
      return NextResponse.json({ error: `Erro ao carregar: ${error.message}` }, { status: 500 });
    }

    let rows = (data ?? []) as Array<Record<string, unknown>>;
    if (q) rows = rows.filter((r) => String(r.reference ?? "").toUpperCase().includes(q));

    const references = rows.map((r) => ({
      reference:        r.reference ?? null,
      method:           String(r.method ?? ""),
      method_label:     METODO_LABEL[String(r.method ?? "")] ?? String(r.method ?? ""),
      valor_esperado:   r.valor_esperado != null ? Number(r.valor_esperado) : null,
      valor_recebido:   r.valor_recebido != null ? Number(r.valor_recebido) : null,
      diferenca:        r.diferenca != null ? Number(r.diferenca) : null,
      conciliada:       r.conciliada === true,
      emitida_em:       r.emitida_em ?? null,
      paid_at:          r.paid_at ?? null,
      cliente:          r.cliente ?? null,
      account_code:     r.account_code ?? null,
      phone:            r.phone ?? null,
      request_id:       r.request_id ?? null,
      estado_do_pedido: r.estado_do_pedido ?? null,
      category_slug:    r.category_slug ?? null,
    }));

    const porConciliar = references.filter((r) => !r.conciliada);

    return NextResponse.json({
      references,
      stats: {
        total: references.length,
        conciliadas: references.length - porConciliar.length,
        por_conciliar: porConciliar.length,
        // Dinheiro à espera de confirmação — é o que trava a publicação
        valor_por_conciliar: Math.round(
          porConciliar.reduce((s, r) => s + (r.valor_esperado ?? 0), 0) * 100,
        ) / 100,
        com_divergencia: references.filter((r) => r.diferenca != null && Math.abs(r.diferenca) > 0.01).length,
      },
    });
  } catch (e) {
    console.error("[referencias]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/** Confirma que o dinheiro chegou — e é isto que publica o pedido. */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json().catch(() => ({})) as {
    reference?: string;
    valor_recebido?: number | string | null;
    pago_em?: string | null;
    nota?: string | null;
  };

  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  if (!reference) {
    return NextResponse.json({ error: "Indica a referência do extracto." }, { status: 400 });
  }

  const valor = body.valor_recebido === null || body.valor_recebido === undefined || body.valor_recebido === ""
    ? null
    : Number(body.valor_recebido);
  if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
    return NextResponse.json({ error: "O valor recebido tem de ser superior a 0 €." }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();

    // A nota leva quem confirmou: o painel autentica com JWT de colaborador
    // (MySQL), não com um utilizador Supabase — não há auth.uid() para
    // preencher `confirmed_by`. Até existir um parâmetro _admin_id, o rasto
    // fica aqui e no admin_audit_log.
    const notaBase = typeof body.nota === "string" ? body.nota.trim() : "";
    const nota = notaBase
      ? `${notaBase} — confirmado por ${colab!.nome} (#${colab!.id})`
      : `Confirmado por ${colab!.nome} (#${colab!.id})`;

    const { data, error } = await sb.rpc("admin_confirmar_pagamento", {
      p_reference: reference,
      p_valor: valor,
      p_pago_em: body.pago_em ?? null,
      p_nota: nota,
    });

    if (error) {
      const msg = error.message ?? "";

      // Bloqueio conhecido: a função exige has_role(auth.uid(), 'admin') e o
      // painel chama com service_role, onde auth.uid() é NULL.
      if (error.code === "42501" || /administrador pode confirmar|auth\.uid/i.test(msg)) {
        return NextResponse.json({
          error: "A base recusou a confirmação por falta de identidade de administrador. O painel autentica com um JWT de colaborador (não é um utilizador Supabase), por isso auth.uid() é NULL. É preciso a variante da função que aceita o id do admin por parâmetro.",
          needs_admin_id_param: true,
        }, { status: 501 });
      }

      if (error.code === "PGRST202" || /function .* does not exist/i.test(msg)) {
        return NextResponse.json({
          error: "A função admin_confirmar_pagamento ainda não existe nesta base — aplica a migração 20260727100000.",
        }, { status: 503 });
      }

      console.error("[referencias POST]", { reference, error });
      return NextResponse.json({ error: `Não foi possível confirmar: ${msg}` }, { status: 400 });
    }

    const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;

    // Rasto do lado do painel — quem confirmou dinheiro não é detalhe
    const { error: auditErr } = await sb.from("admin_audit_log").insert([{
      action: "confirmar_pagamento",
      entity_type: "payment_reference",
      entity_id: String(r?.request_id ?? reference),
      old_value: null,
      new_value: { reference, valor_recebido: valor, resultado: r, _by: `${colab!.id}:${colab!.nome}` },
      reason: notaBase || null,
    }]);
    if (auditErr) console.error("[referencias] auditoria falhou", auditErr);

    const jaConfirmado = r?.ja_confirmado === true;
    return NextResponse.json({
      ok: true,
      ja_confirmado: jaConfirmado,
      resultado: r,
      message: jaConfirmado
        ? "Este pagamento já estava confirmado — nada foi duplicado nem republicado."
        : "Pagamento confirmado. O pedido avançou para Confirmado e foi publicado aos profissionais.",
    });
  } catch (e) {
    console.error("[referencias POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
