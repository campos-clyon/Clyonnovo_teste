import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reconciliação de pagamentos — referências emitidas pela app.
 *
 * O cliente escreve a referência na descrição da transferência ou do MB WAY,
 * e ela aparece no extracto bancário. O operador cola-a aqui e cai no pedido.
 *
 * Formato: <account_code><método><contador>  ex: AAABD07
 *   AAAB = código da conta · D = método · 07 = 7.º pagamento daquela conta
 *
 * ⚠️ Não existe coluna "conciliado" (decisão do processo, ainda por fechar).
 * Enquanto não existir, esta rota DERIVA o estado a partir de `payments`:
 * uma referência conta como conciliada quando há um pagamento do mesmo
 * pedido já capturado/pago. É uma aproximação honesta — melhor do que
 * inventar uma coluna que depois não corresponde ao processo real.
 */

const METODO_LABEL: Record<string, string> = {
  M: "MB WAY", R: "Revolut", T: "Transferência", D: "Dinheiro",
  mbway: "MB WAY", revolut: "Revolut", transfer: "Transferência", cash: "Dinheiro",
};

const PAGO = new Set(["captured", "paid", "succeeded", "completed"]);

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toUpperCase() ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

  try {
    const sb = getSupabaseAdmin();

    const { data, error } = await sb
      .from("payment_references")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // A tabela só existe depois da migração das referências
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "")) {
        return NextResponse.json({
          references: [], unavailable: true,
          notice: "A tabela payment_references ainda não existe nesta base.",
        });
      }
      console.error("[referencias] ", error);
      return NextResponse.json({ error: `Erro ao carregar referências: ${error.message}` }, { status: 500 });
    }

    let refs = (data ?? []) as Array<Record<string, unknown>>;

    // Pesquisa pela referência — é o que vem no extracto bancário
    if (q) {
      refs = refs.filter((r) => String(r.reference ?? "").toUpperCase().includes(q));
    }
    if (refs.length === 0) {
      return NextResponse.json({ references: [], stats: { total: 0, conciliadas: 0, por_conciliar: 0 } });
    }

    const requestIds = [...new Set(refs.map((r) => r.request_id).filter(Boolean).map(String))];
    const customerIds = [...new Set(refs.map((r) => r.customer_id).filter(Boolean).map(String))];

    const [pedidosRes, perfisRes, pagamentosRes] = await Promise.all([
      requestIds.length
        ? sb.from("service_requests").select("id, status, estimated_price, final_price, scheduled_for").in("id", requestIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      customerIds.length
        ? sb.from("profiles").select("id, full_name, phone, account_code").in("id", customerIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      requestIds.length
        ? sb.from("payments").select("request_id, status, amount, provider_ref, captured_at, created_at").in("request_id", requestIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

    const pedidos: Record<string, Record<string, unknown>> = {};
    for (const p of (pedidosRes.data ?? []) as Array<Record<string, unknown>>) pedidos[String(p.id)] = p;

    const perfis: Record<string, Record<string, unknown>> = {};
    for (const p of (perfisRes.data ?? []) as Array<Record<string, unknown>>) perfis[String(p.id)] = p;

    // Pagamentos já liquidados, por pedido
    const pagoPorPedido: Record<string, { amount: number | null; at: string | null; ref: string | null }> = {};
    for (const p of (pagamentosRes.data ?? []) as Array<Record<string, unknown>>) {
      if (!PAGO.has(String(p.status ?? ""))) continue;
      const rid = String(p.request_id);
      pagoPorPedido[rid] = {
        amount: p.amount != null ? Number(p.amount) : null,
        at: (p.captured_at ?? p.created_at) as string | null,
        ref: (p.provider_ref as string | null) ?? null,
      };
    }

    const references = refs.map((r) => {
      const rid = String(r.request_id ?? "");
      const pedido = pedidos[rid] ?? {};
      const perfil = perfis[String(r.customer_id ?? "")] ?? {};
      const pago = pagoPorPedido[rid] ?? null;
      const metodo = String(r.method ?? "");
      const valorRef = r.amount != null ? Number(r.amount) : null;

      // Divergência de valor: o cliente transferiu diferente do que devia
      const divergencia = pago?.amount != null && valorRef != null && Math.abs(pago.amount - valorRef) > 0.01
        ? Math.round((pago.amount - valorRef) * 100) / 100
        : null;

      return {
        id: r.id ?? null,
        reference: r.reference ?? null,
        method: metodo,
        method_label: METODO_LABEL[metodo] ?? metodo,
        amount: valorRef,
        created_at: r.created_at ?? null,
        request_id: rid || null,
        request_status: pedido.status ?? null,
        client_name: perfil.full_name ?? null,
        client_phone: perfil.phone ?? null,
        account_code: perfil.account_code ?? null,
        // Estado derivado — ver comentário no topo
        conciliado: pago !== null,
        pago_em: pago?.at ?? null,
        valor_recebido: pago?.amount ?? null,
        divergencia_valor: divergencia,
      };
    });

    const conciliadas = references.filter((r) => r.conciliado).length;

    return NextResponse.json({
      references,
      stats: {
        total: references.length,
        conciliadas,
        por_conciliar: references.length - conciliadas,
        com_divergencia: references.filter((r) => r.divergencia_valor !== null).length,
      },
    });
  } catch (e) {
    console.error("[referencias]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
