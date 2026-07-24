import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gestão das regras de custo em créditos por trabalho aceite
 * (tabela credit_fee_rules do CLYON Bridge).
 *
 * Contrato (NOTA do Bridge, 24-07-2026):
 * - O painel edita DADOS desta tabela; calculate_job_credit_cost continua a
 *   ser a única fonte do custo — NÃO duplicar a lógica de bandas no painel.
 * - Validações obrigatórias no ecrã:
 *   · fee_credits > 0
 *   · bandas activas não se podem sobrepor (a função ordena por
 *     min_job_amount_cents DESC e escolhe a primeira — sobreposição torna
 *     o resultado imprevisível para quem edita)
 *   · impedir zero regras activas (deixaria de se cobrar em silêncio)
 */

type FeeRule = {
  id: string;
  min_job_amount_cents: number;
  max_job_amount_cents: number | null;
  fee_credits: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

function rangesOverlap(a: FeeRule, b: FeeRule): boolean {
  const aMax = a.max_job_amount_cents ?? Number.POSITIVE_INFINITY;
  const bMax = b.max_job_amount_cents ?? Number.POSITIVE_INFINITY;
  return a.min_job_amount_cents < bMax && b.min_job_amount_cents < aMax;
}

function validateRule(rule: Partial<FeeRule>): string | null {
  const fee = Number(rule.fee_credits);
  if (!Number.isInteger(fee) || fee <= 0) {
    return "O custo em créditos tem de ser um número inteiro superior a 0.";
  }
  const min = Number(rule.min_job_amount_cents ?? 0);
  if (!Number.isInteger(min) || min < 0) {
    return "O valor mínimo da banda tem de ser um número inteiro ≥ 0 (em cêntimos).";
  }
  if (rule.max_job_amount_cents !== null && rule.max_job_amount_cents !== undefined) {
    const max = Number(rule.max_job_amount_cents);
    if (!Number.isInteger(max) || max <= min) {
      return "O valor máximo da banda tem de ser superior ao mínimo (ou vazio para 'sem limite').";
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("credit_fee_rules")
      .select("*")
      .order("active", { ascending: false })
      .order("min_job_amount_cents", { ascending: true });
    if (error) {
      return NextResponse.json({ error: `Erro ao carregar regras: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ rules: data ?? [] });
  } catch (e: any) {
    console.error("[credit-fee-rules GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json().catch(() => ({})) as {
    action?: "create" | "update";
    id?: string;
    min_job_amount_cents?: number;
    max_job_amount_cents?: number | null;
    fee_credits?: number;
    active?: boolean;
  };

  try {
    const sb = getSupabaseAdmin();

    const { data: existingRaw, error: listErr } = await sb
      .from("credit_fee_rules").select("*");
    if (listErr) {
      return NextResponse.json({ error: `Erro ao carregar regras: ${listErr.message}` }, { status: 500 });
    }
    const existing = (existingRaw ?? []) as FeeRule[];

    if (body.action === "create") {
      const candidate: FeeRule = {
        id: "novo",
        min_job_amount_cents: body.min_job_amount_cents ?? 0,
        max_job_amount_cents: body.max_job_amount_cents ?? null,
        fee_credits: body.fee_credits ?? 0,
        active: body.active !== false,
      };
      const vErr = validateRule(candidate);
      if (vErr) return NextResponse.json({ error: vErr }, { status: 400 });

      if (candidate.active) {
        const clash = existing.find((r) => r.active && rangesOverlap(r, candidate));
        if (clash) {
          return NextResponse.json({
            error: `A banda sobrepõe-se a uma regra activa existente (${clash.min_job_amount_cents / 100}€ → ${clash.max_job_amount_cents != null ? clash.max_job_amount_cents / 100 + "€" : "sem limite"}). Desactiva-a primeiro ou ajusta os limites.`,
          }, { status: 400 });
        }
      }

      const { data, error } = await sb.from("credit_fee_rules").insert([{
        min_job_amount_cents: candidate.min_job_amount_cents,
        max_job_amount_cents: candidate.max_job_amount_cents,
        fee_credits: candidate.fee_credits,
        active: candidate.active,
      }]).select("*").single();
      if (error) {
        return NextResponse.json({ error: `Erro ao criar regra: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, rule: data });
    }

    if (body.action === "update") {
      if (!body.id) return NextResponse.json({ error: "id em falta." }, { status: 400 });
      const current = existing.find((r) => r.id === body.id);
      if (!current) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });

      const updated: FeeRule = {
        ...current,
        min_job_amount_cents: body.min_job_amount_cents ?? current.min_job_amount_cents,
        max_job_amount_cents: body.max_job_amount_cents !== undefined ? body.max_job_amount_cents : current.max_job_amount_cents,
        fee_credits: body.fee_credits ?? current.fee_credits,
        active: body.active ?? current.active,
      };
      const vErr = validateRule(updated);
      if (vErr) return NextResponse.json({ error: vErr }, { status: 400 });

      // Impedir zero regras activas — deixaria de se cobrar em silêncio
      const activeAfter = existing.filter((r) => (r.id === updated.id ? updated.active : r.active));
      if (activeAfter.length === 0) {
        return NextResponse.json({
          error: "Tem de existir pelo menos uma regra activa — sem regras, os trabalhos deixam de ser cobrados em silêncio. Activa outra regra antes de desactivar esta.",
        }, { status: 400 });
      }

      // Sobreposição entre bandas activas
      if (updated.active) {
        const clash = existing.find((r) => r.id !== updated.id && r.active && rangesOverlap(r, updated));
        if (clash) {
          return NextResponse.json({
            error: `A banda sobrepõe-se a outra regra activa (${clash.min_job_amount_cents / 100}€ → ${clash.max_job_amount_cents != null ? clash.max_job_amount_cents / 100 + "€" : "sem limite"}).`,
          }, { status: 400 });
        }
      }

      const { data, error } = await sb.from("credit_fee_rules").update({
        min_job_amount_cents: updated.min_job_amount_cents,
        max_job_amount_cents: updated.max_job_amount_cents,
        fee_credits: updated.fee_credits,
        active: updated.active,
        updated_at: new Date().toISOString(),
      }).eq("id", body.id).select("*").single();
      if (error) {
        return NextResponse.json({ error: `Erro ao actualizar regra: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, rule: data });
    }

    return NextResponse.json({ error: "Acção inválida — usar create ou update." }, { status: 400 });
  } catch (e: any) {
    console.error("[credit-fee-rules POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
