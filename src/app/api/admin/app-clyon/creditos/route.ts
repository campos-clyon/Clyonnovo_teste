import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compras de créditos pelos profissionais.
 *
 * Desde 27-07-2026 é isto a receita da CLYON: o profissional fica com 100% do
 * serviço e paga uma taxa de aceitação em créditos. O ecrã de pagamentos
 * mostra dinheiro que passa por nós a caminho do profissional; o que é
 * nosso está aqui.
 *
 * Só leitura. A confirmação é do webhook da euPago, e creditar à mão uma
 * ordem já paga dava saldo a dobrar sem deixar rasto de que foi engano.
 */

const METODO_LABEL: Record<string, string> = {
  mbway: "MB WAY", multibanco: "Multibanco",
};

const ESTADO_LABEL: Record<string, string> = {
  pending: "À espera de pagamento",
  paid: "Pago",
  failed: "Recusado pela euPago",
  canceled: "Referência caducada",
};

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30")));
  const desde = new Date(Date.now() - days * 86_400_000).toISOString();
  // Um profissional em concreto: a ficha dele mostra as suas compras, e é daí
  // que se confirma uma que ficou por creditar.
  const partner = url.searchParams.get("partner")?.trim() || null;

  try {
    const sb = getSupabaseAdmin();

    let query = sb
      .from("credit_purchase_orders")
      .select("id, partner_id, status, method, package_name, credits, price_cents, provider_entity, provider_payment_id, provider_fee, expires_at, paid_at, failure_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    // Na ficha de um profissional o histórico interessa todo, não só 30 dias
    if (partner) query = query.eq("partner_id", partner);
    else query = query.gte("created_at", desde);

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "")) {
        return NextResponse.json({
          orders: [], unavailable: true,
          notice: "A tabela credit_purchase_orders não existe nesta base — é da migração da compra de créditos pela euPago.",
        });
      }
      console.error("[creditos]", error);
      return NextResponse.json({ error: `Erro ao carregar: ${error.message}` }, { status: 500 });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;

    // Quem comprou: partner_profiles.id é a chave da ordem; o nome da pessoa
    // vive em profiles, alcançado por partner_profiles.user_id.
    const partnerIds = [...new Set(rows.map((r) => r.partner_id).filter(Boolean))];
    const parceiros: Record<string, { nome: string | null; userId: string | null }> = {};
    const pessoas: Record<string, { nome: string | null; codigo: string | null }> = {};

    if (partnerIds.length > 0) {
      const { data: pps } = await sb
        .from("partner_profiles").select("id, user_id, trade_name").in("id", partnerIds);
      for (const pp of pps ?? []) {
        parceiros[String(pp.id)] = { nome: pp.trade_name ?? null, userId: pp.user_id ?? null };
      }
      const userIds = Object.values(parceiros).map((p) => p.userId).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: perfis } = await sb
          .from("profiles").select("id, full_name, account_code").in("id", userIds);
        for (const p of perfis ?? []) {
          pessoas[String(p.id)] = { nome: p.full_name ?? null, codigo: p.account_code ?? null };
        }
      }
    }

    const orders = rows.map((r) => {
      const parceiro = parceiros[String(r.partner_id)] ?? { nome: null, userId: null };
      const pessoa = parceiro.userId ? pessoas[parceiro.userId] : undefined;
      const metodo = String(r.method ?? "");
      return {
        id: r.id,
        // Necessário para confirmar a compra e para creditar à mão
        partner_id: r.partner_id ?? null,
        estado: String(r.status ?? ""),
        estado_label: ESTADO_LABEL[String(r.status ?? "")] ?? String(r.status ?? ""),
        metodo,
        // Ordens anteriores à euPago não têm método — não inventar um
        metodo_label: metodo ? (METODO_LABEL[metodo] ?? metodo) : null,
        pacote: r.package_name ?? null,
        creditos: r.credits != null ? Number(r.credits) : null,
        euros: r.price_cents != null ? Number(r.price_cents) / 100 : null,
        entidade: r.provider_entity ?? null,
        // provider_payment_id é a referência da euPago: os 9 dígitos que o
        // profissional escreve no ATM, e por onde o callback encontra a ordem
        referencia: r.provider_payment_id ?? null,
        comissao: r.provider_fee != null ? Number(r.provider_fee) : null,
        expires_at: r.expires_at ?? null,
        paid_at: r.paid_at ?? null,
        motivo_falha: r.failure_reason ?? null,
        criada_em: r.created_at ?? null,
        profissional: parceiro.nome ?? pessoa?.nome ?? null,
        account_code: pessoa?.codigo ?? null,
      };
    });

    const pagas = orders.filter((o) => o.estado === "paid");
    const pendentes = orders.filter((o) => o.estado === "pending");
    const cent = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      orders,
      dias: days,
      stats: {
        // O que entrou mesmo. É a receita da CLYON no período.
        receita: cent(pagas.reduce((s, o) => s + (o.euros ?? 0), 0)),
        creditos_vendidos: pagas.reduce((s, o) => s + (o.creditos ?? 0), 0),
        comissao_eupago: cent(pagas.reduce((s, o) => s + (o.comissao ?? 0), 0)),
        count_pagas: pagas.length,
        count_pendentes: pendentes.length,
        valor_pendente: cent(pendentes.reduce((s, o) => s + (o.euros ?? 0), 0)),
        count_falhadas: orders.filter((o) => o.estado === "failed").length,
      },
    });
  } catch (e) {
    console.error("[creditos]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
