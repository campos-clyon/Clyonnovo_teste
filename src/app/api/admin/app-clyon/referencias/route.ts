import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Conciliação de pagamentos — referências emitidas pela app.
 *
 * Um pedido NÃO avança sozinho quando o cliente carrega em "Pagar reserva":
 * o pagamento é assíncrono e nesse instante ainda não entrou dinheiro nenhum.
 * O pedido fica em `awaiting_deposit` até alguém confirmar que chegou — e
 * confirmar é o que dispara a publicação aos profissionais.
 *
 * Desde 27-07-2026 há euPago: MB WAY e Multibanco confirmam-se sozinhos por
 * webhook. Sobra a transferência bancária, que ninguém vê senão no extracto —
 * é essa que este ecrã existe para destravar.
 */

const METODO_LABEL: Record<string, string> = {
  mbway: "MB WAY", card: "Revolut", transfer: "Transferência", cash: "Dinheiro",
  multibanco: "Multibanco", mb: "Multibanco",
  M: "MB WAY", R: "Revolut", T: "Transferência", D: "Dinheiro",
};

/** Métodos que a euPago fecha sozinha — aqui só aparecem para consulta. */
const METODOS_AUTOMATICOS = new Set(["mbway", "multibanco", "mb", "M"]);

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
          notice: "A vista payment_reconciliation não existe nesta base. A migração 20260727100000 cria-a — confirma que foi aplicada neste ambiente e não só noutro.",
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
      confirmado_por:   r.confirmado_por ?? null,
      provider:         r.provider ?? null,
      entidade:         r.entidade ?? null,
      referencia_mb:    r.referencia_mb ?? null,
      comissao:         r.comissao != null ? Number(r.comissao) : null,
      expires_at:       r.expires_at ?? null,
      // NULL = o lembrete das 24 h ainda não saiu
      reminded_at:      r.reminded_at ?? null,
      // Quem tem provider fecha-se por webhook. O método é só a intenção do
      // cliente; o provider é quem de facto vai confirmar — e manda.
      automatico:       r.provider != null
        ? String(r.provider) === "eupago"
        : METODOS_AUTOMATICOS.has(String(r.method ?? "")),
    }));

    const porConciliar = references.filter((r) => !r.conciliada);
    // O que realmente exige trabalho humano: pendentes que a euPago não fecha
    const manuais = porConciliar.filter((r) => !r.automatico);

    // Desde 27-07-2026 um pedido por pagar é cancelado ao fim de 7 dias pelo
    // agendador. Uma linha por conciliar mais velha do que isso significa que
    // o agendador não correu — é um sintoma, não uma referência antiga.
    const LIMITE_DIAS = 7;
    const agora = Date.now();
    const encalhadas = porConciliar.filter((r) => {
      if (!r.emitida_em) return false;
      const t = new Date(String(r.emitida_em)).getTime();
      if (Number.isNaN(t)) return false;
      return (agora - t) / 86_400_000 > LIMITE_DIAS;
    }).length;

    return NextResponse.json({
      references,
      stats: {
        total: references.length,
        conciliadas: references.length - porConciliar.length,
        por_conciliar: porConciliar.length,
        a_aguardar_operador: manuais.length,
        encalhadas,
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

/**
 * A função é `painel_confirmar_pagamento` — a variante que não precisa de
 * `auth.uid()`, porque o admin do painel é um colaborador do MySQL e não um
 * utilizador Supabase. Não está concedida a `authenticated`: quem verifica a
 * identidade somos nós, aqui no servidor, antes de chegar a este ponto.
 *
 * Assinatura confirmada em pg_proc — o PostgREST só aceita argumentos por
 * nome, e estes começam por underscore, não por `p_`:
 *   _reference text, _staff text, _amount numeric,
 *   _paid_at timestamptz, _notes text
 */
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

    const notaBase = typeof body.nota === "string" ? body.nota.trim() : "";
    // Vai para `confirmed_by_staff` (texto). O id do colaborador é um inteiro
    // do MySQL e não cabe no `confirmed_by` uuid — este é o rasto que fica.
    const staff = `${colab!.nome} (#${colab!.id})`;

    const { data, error } = await sb.rpc("painel_confirmar_pagamento", {
      _reference: reference,
      _staff: staff,
      _amount: valor,
      _paid_at: body.pago_em ?? null,
      _notes: notaBase || null,
    });

    if (error) {
      const msg = error.message ?? "";

      if (error.code === "PGRST202" || /function .* does not exist/i.test(msg)) {
        return NextResponse.json({
          error: "A função painel_confirmar_pagamento não existe nesta base — confirma que a migração 20260727100000 foi aplicada neste ambiente.",
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
