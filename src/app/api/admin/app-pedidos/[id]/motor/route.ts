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
    if (body.action === "record_execution") {
      const executed = toNum(body.price_executed);
      if (executed === null || executed <= 0) {
        return NextResponse.json({ error: "Indica o valor efectivamente cobrado (superior a 0 €)." }, { status: 400 });
      }

      // desvio_pct é coluna gerada — NÃO escrever (NOTA-BRIDGE-MOTOR §2.4)
      const { data, error: updErr } = await sb.from("pricing_outcomes").update({
        price_executed:   executed,
        horas_reais:      toNum(body.horas_reais),
        pessoas_reais:    toNum(body.pessoas_reais),
        ajustes_no_local: typeof body.ajustes_no_local === "string" ? body.ajustes_no_local.trim() || null : null,
        executed_at:      new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }).eq("service_request_id", id).select("*").maybeSingle();

      if (updErr) {
        const dep = dependencyNotice(updErr);
        console.error("[motor record_execution]", { id, updErr });
        return NextResponse.json({ error: dep ?? `Erro ao registar execução: ${updErr.message}` }, { status: dep ? 503 : 500 });
      }
      if (!data) {
        return NextResponse.json({
          error: "Não existe linha de aprovação para este pedido — regista primeiro o preço aprovado.",
        }, { status: 400 });
      }

      return NextResponse.json({ ok: true, outcome: data });
    }

    return NextResponse.json({ error: "Acção inválida — usar record_approval ou record_execution." }, { status: 400 });
  } catch (e) {
    console.error("[motor POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
