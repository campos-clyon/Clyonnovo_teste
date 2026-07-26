import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Motor de preços — trace de decisão e conjunto de treino.
 * NOTA-BRIDGE-MOTOR §3.3 (mostrar o raciocínio) e §3.4 (pricing_outcomes).
 *
 * `quote_engine_trace` e `pricing_outcomes` são tabelas SÓ ADMIN — o piso
 * anti-prejuízo é custo interno da CLYON e nunca pode chegar ao cliente.
 * Por isso vivem nesta rota, protegida por requireAdmin, e nunca no payload
 * partilhado do pedido.
 */

type Missing = { missing: true; notice: string };

function dependencyNotice(error: { code?: string; message?: string }): string | null {
  const msg = error.message ?? "";
  if (error.code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return "As tabelas do motor (quote_engine_trace / pricing_outcomes) ainda não existem nesta base.";
  }
  if (error.code === "42703" || /column .* does not exist/i.test(msg)) {
    return "O esquema do motor está incompleto — a migração 20260724260000_ficha_do_pedido_e_motor.sql não correu por inteiro.";
  }
  return null;
}

/** Junta pedido → cotação → trace. Devolve null quando algo não existe. */
async function loadChain(sb: ReturnType<typeof getSupabaseAdmin>, requestId: string) {
  const { data: sr, error: srErr } = await sb
    .from("service_requests")
    .select("id, price_quote_id, estimated_price, final_price, estimate_min, estimate_max, price_status, request_facts, category_slug, city, region")
    .eq("id", requestId)
    .single();
  if (srErr || !sr) return { sr: null, quote: null, trace: null, notice: dependencyNotice(srErr ?? {}) };

  const quoteId = (sr as Record<string, unknown>).price_quote_id as string | null;
  if (!quoteId) return { sr, quote: null, trace: null, notice: null };

  const [{ data: quote }, { data: trace, error: trErr }] = await Promise.all([
    sb.from("price_quotes").select("*").eq("id", quoteId).single(),
    sb.from("quote_engine_trace").select("*").eq("quote_id", quoteId).single(),
  ]);

  return { sr, quote: quote ?? null, trace: trace ?? null, notice: trErr ? dependencyNotice(trErr) : null };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const { sr, quote, trace, notice } = await loadChain(sb, id);
    if (!sr) return NextResponse.json({ unavailable: true, notice: notice ?? "Pedido não encontrado." });

    const { data: outcome } = await sb
      .from("pricing_outcomes")
      .select("*")
      .eq("service_request_id", id)
      .maybeSingle();

    return NextResponse.json({
      trace: trace ?? null,
      quote: quote
        ? {
            id: quote.id, total: quote.total,
            estimate_min: quote.estimate_min, estimate_max: quote.estimate_max,
            price_status: quote.price_status, service_type: quote.service_type,
            zone_name: quote.zone_name,
          }
        : null,
      request_facts: (sr as Record<string, unknown>).request_facts ?? null,
      outcome: outcome ?? null,
      ...(notice ? { notice } : {}),
    });
  } catch (e) {
    console.error("[motor GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as {
    action?: "record_approval" | "record_execution";
    price_approved?: number | string;
    price_executed?: number | string;
    valor_cobrado_real?: number | string;
    horas_reais?: number | string;
    pessoas_reais?: number | string;
    ajustes_no_local?: string;
  };

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const sb = getSupabaseAdmin();

    // ── Aprovação: grava a linha de treino com o preço acordado ────────────
    if (body.action === "record_approval") {
      const { sr, quote, trace, notice } = await loadChain(sb, id);
      if (!sr) return NextResponse.json({ error: notice ?? "Pedido não encontrado." }, { status: 404 });

      const row = sr as Record<string, unknown>;
      const q = (quote ?? {}) as Record<string, unknown>;
      const t = (trace ?? {}) as Record<string, unknown>;

      // O preço aprovado é o acordado com o cliente; se não vier no body,
      // usa o final_price do pedido (escrito pela RPC de aceitação).
      const approved = toNum(body.price_approved) ?? toNum(row.final_price) ?? toNum(row.estimated_price);
      if (approved === null || approved <= 0) {
        return NextResponse.json({
          error: "Não há preço acordado para registar — o pedido tem de ter um valor aprovado.",
        }, { status: 400 });
      }

      const { error: upErr } = await sb.from("pricing_outcomes").upsert([{
        service_request_id: id,
        quote_id:        (q.id as string) ?? null,
        service_type:    (q.service_type as string) ?? (row.category_slug as string) ?? null,
        zone_name:       (q.zone_name as string) ?? (row.city as string) ?? null,
        request_facts:   q.request_facts ?? row.request_facts ?? null,
        engine_floor:    t.engine_floor ?? null,
        engine_ceiling:  t.engine_ceiling ?? null,
        gemini_price:    t.gemini_price ?? null,
        price_shown:     q.total ?? row.estimated_price ?? null,
        estimate_min:    q.estimate_min ?? row.estimate_min ?? null,
        estimate_max:    q.estimate_max ?? row.estimate_max ?? null,
        price_status:    q.price_status ?? row.price_status ?? null,
        price_approved:  approved,
        approved_at:     new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }], { onConflict: "service_request_id" });

      if (upErr) {
        const dep = dependencyNotice(upErr);
        console.error("[motor record_approval]", { id, upErr });
        return NextResponse.json({ error: dep ?? `Erro ao registar aprovação: ${upErr.message}` }, { status: dep ? 503 : 500 });
      }

      const belowFloor = t.engine_floor != null && approved < Number(t.engine_floor);
      return NextResponse.json({
        ok: true,
        price_approved: approved,
        below_floor: belowFloor,
        ...(belowFloor
          ? { warning: `Preço aprovado (${approved} €) abaixo do piso anti-prejuízo do motor (${t.engine_floor} €).` }
          : {}),
      });
    }

    // ── Execução: fecha a linha de treino com o que aconteceu de facto ─────
    // NOTA-BRIDGE-CALIBRACAO §1: há DUAS razões diferentes para o preço final
    // divergir, e pedem correcções opostas — negociação (o motor errou no
    // mercado) e ajuste no local (errou no tamanho). Somadas num número só,
    // um desvio de +20% não diz qual foi. Por isso o ajuste vai à parte.
    if (body.action === "record_execution") {
      const executed = toNum(body.price_executed);
      if (executed === null || executed <= 0) {
        return NextResponse.json({ error: "Indica o valor efectivamente cobrado (superior a 0 €)." }, { status: 400 });
      }

      // Só se divergir do valor do sistema (NULLIF do SQL da nota). No modelo
      // de créditos o cliente paga em mão — se não guardarmos o valor real,
      // ficamos cegos a cobranças fora da plataforma.
      const cobradoReal = toNum(body.valor_cobrado_real);
      const divergencia = cobradoReal !== null && cobradoReal !== executed ? cobradoReal : null;

      // Ajustes aprovados no local — isolam o erro de MEDIÇÃO.
      //
      // ⚠️ CORRIGIDO 26-07-2026: a fórmula SUM(suggested_amount −
      // estimated_price) que eu tinha (e que assinalei como suspeita) dá
      // sempre 0. `suggested_amount` é o TOTAL corrigido, e o ajuste
      // SOBRESCREVE estimated_price — deduzir depois é reconstruir
      // informação já deitada fora. Existe agora `amount_delta`, que é o
      // acréscimo real de cada ajuste.
      let ajustesTotal: number | null = null;
      let ajustesContagem: number | null = null;
      try {
        const { data: adjustments, error: adjErr } = await sb
          .from("service_adjustments")
          .select("amount_delta, amount_before, suggested_amount, status")
          .eq("request_id", id).eq("status", "approved");

        if (adjErr && /column .* does not exist/i.test(adjErr.message ?? "")) {
          // Colunas novas ainda não existem — não inventar um valor errado
          console.warn("[motor] amount_delta indisponível; ajustes não decompostos", { id });
        } else {
          const aprovados = (adjustments ?? []) as Array<Record<string, unknown>>;
          if (aprovados.length > 0) {
            ajustesContagem = aprovados.length;
            ajustesTotal = Math.round(
              aprovados.reduce((s, a) => s + (toNum(a.amount_delta) ?? 0), 0) * 100,
            ) / 100;
          }
        }
      } catch (e) {
        console.warn("[motor] ajustes não calculados", { id, e });
      }

      const patchBase: Record<string, unknown> = {
        price_executed:   executed,
        horas_reais:      toNum(body.horas_reais),
        pessoas_reais:    toNum(body.pessoas_reais),
        ajustes_no_local: typeof body.ajustes_no_local === "string" ? body.ajustes_no_local.trim() || null : null,
        executed_at:      new Date().toISOString(),
        updated_at:       new Date().toISOString(),
        // desvio_pct é coluna gerada — NÃO escrever (NOTA-BRIDGE-MOTOR §2.4)
      };
      const patchNovo: Record<string, unknown> = {
        ...patchBase,
        ajustes_total:      ajustesTotal,
        ajustes_contagem:   ajustesContagem,
        valor_cobrado_real: divergencia,
      };

      // As colunas novas podem ainda não existir (migração
      // 20260725150000_outcomes_decompoe_desvio.sql por correr). Nesse caso
      // grava-se o essencial e avisa-se, em vez de perder o registo todo.
      let data: Record<string, unknown> | null = null;
      let aviso: string | null = null;

      const primeira = await sb.from("pricing_outcomes").update(patchNovo)
        .eq("service_request_id", id).select("*").maybeSingle();

      if (primeira.error && /column .* does not exist/i.test(primeira.error.message ?? "")) {
        const fallback = await sb.from("pricing_outcomes").update(patchBase)
          .eq("service_request_id", id).select("*").maybeSingle();
        if (fallback.error) {
          console.error("[motor record_execution] fallback", { id, error: fallback.error });
          return NextResponse.json({ error: `Erro ao registar execução: ${fallback.error.message}` }, { status: 500 });
        }
        data = fallback.data as Record<string, unknown> | null;
        aviso = "Execução registada, mas a decomposição do desvio ficou por gravar: as colunas ajustes_total / ajustes_contagem / valor_cobrado_real ainda não existem na base.";
      } else if (primeira.error) {
        const dep = dependencyNotice(primeira.error);
        console.error("[motor record_execution]", { id, error: primeira.error });
        return NextResponse.json({ error: dep ?? `Erro ao registar execução: ${primeira.error.message}` }, { status: dep ? 503 : 500 });
      } else {
        data = primeira.data as Record<string, unknown> | null;
      }

      if (!data) {
        return NextResponse.json({
          error: "Não existe linha de aprovação para este pedido — regista primeiro o preço aprovado.",
        }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        outcome: data,
        ajustes_total: ajustesTotal,
        ajustes_contagem: ajustesContagem,
        ...(divergencia !== null ? { divergencia_cobranca: divergencia } : {}),
        ...(aviso ? { warning: aviso } : {}),
      });
    }

    return NextResponse.json({ error: "Acção inválida — usar record_approval ou record_execution." }, { status: 400 });
  } catch (e) {
    console.error("[motor POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
