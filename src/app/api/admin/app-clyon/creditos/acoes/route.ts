import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Créditos: confirmar uma compra, ou dar créditos à mão.
 *
 * São dois gestos diferentes e é deliberado que sejam duas acções separadas:
 *
 *   · `confirmar_compra` — o profissional PAGOU e os créditos não entraram
 *     (callback perdido). Fecha a ordem pelo mesmo caminho do webhook, por
 *     isso é idempotente: se o callback atrasado chegar depois, encontra a
 *     ordem paga e não soma segunda vez.
 *
 *   · `creditar_manual` — não há compra nenhuma por trás. Promoção, acerto
 *     depois de uma disputa, correcção de um engano.
 *
 * Com um único botão, o operador usaria o segundo para o primeiro caso — e aí
 * a ordem fica aberta à espera de um callback que credita segunda vez.
 *
 * `admin_adjust_partner_credits` não serve aqui: exige
 * has_role(auth.uid(), 'admin'), e o admin do painel é um colaborador do
 * MySQL — auth.uid() é sempre NULL com a service_role. É a mesma parede dos
 * pagamentos, e a solução é a mesma: as variantes `painel_`, que recebem a
 * identidade de quem age como texto.
 */

/** Erros que a base escreve para quem opera — passam tal e qual. */
const CODIGOS_DE_NEGOCIO = new Set(["P0001", "P0002", "22023", "23514"]);

function erroDaBase(error: { code?: string; message?: string }, fallback: string) {
  const msg = error.message ?? "";
  if (error.code === "PGRST202" || /function .* does not exist/i.test(msg)) {
    return {
      error: "Esta função ainda não existe na base — é da migração dos créditos pelo painel (28-07-2026).",
      status: 503,
    };
  }
  if (error.code && CODIGOS_DE_NEGOCIO.has(error.code) && msg) {
    return { error: msg, status: 400 };
  }
  return { error: `${fallback}: ${msg}`, status: 400 };
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    order_id?: string;
    partner_id?: string;
    creditos?: number | string;
    motivo?: string;
    nota?: string;
  };

  // Vai para `_staff` (texto). O id do colaborador é um inteiro do MySQL e
  // não cabe num uuid — este é o rasto que fica na carteira do profissional.
  const staff = `${colab!.nome} (#${colab!.id})`;
  const sb = getSupabaseAdmin();

  try {
    // ── Confirmar uma compra que ficou por creditar ───────────────────────
    if (body.action === "confirmar_compra") {
      const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
      if (!orderId) {
        return NextResponse.json({ error: "Indica a ordem de compra a confirmar." }, { status: 400 });
      }

      const { data, error } = await sb.rpc("painel_confirmar_compra_creditos", {
        _order_id: orderId,
        _staff: staff,
        _notes: typeof body.nota === "string" && body.nota.trim() ? body.nota.trim() : null,
      });

      if (error) {
        console.error("[creditos/acoes confirmar]", { orderId, error });
        const e = erroDaBase(error, "Não foi possível confirmar a compra");
        return NextResponse.json({ error: e.error }, { status: e.status });
      }

      const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      const jaCreditado = r?.ja_creditado === true;

      await registarAuditoria(sb, {
        action: "confirmar_compra_creditos",
        entity_id: orderId,
        new_value: { ...r, _by: `${colab!.id}:${colab!.nome}` },
        reason: typeof body.nota === "string" ? body.nota.trim() || null : null,
      });

      return NextResponse.json({
        ok: true,
        resultado: r,
        message: jaCreditado
          ? "Esta compra já estava confirmada — nada foi creditado duas vezes."
          : `Compra confirmada. ${r?.creditos ?? 0} créditos entraram na carteira.`,
      });
    }

    // ── Dar créditos sem compra por trás ──────────────────────────────────
    if (body.action === "creditar_manual") {
      const partnerId = typeof body.partner_id === "string" ? body.partner_id.trim() : "";
      const creditos = Number(body.creditos);
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";

      if (!partnerId) {
        return NextResponse.json({ error: "Falta o profissional." }, { status: 400 });
      }
      if (!Number.isInteger(creditos) || creditos === 0) {
        return NextResponse.json({
          error: "Indica um número inteiro de créditos, diferente de zero. Um valor negativo reverte.",
        }, { status: 400 });
      }
      // A base também o exige; validar aqui dá uma mensagem melhor do que um
      // 22023 cru, e evita a ida à base para nada.
      if (!motivo) {
        return NextResponse.json({
          error: "O motivo é obrigatório. Dar créditos é dar dinheiro — daqui a um mês ninguém se lembra porquê.",
        }, { status: 400 });
      }

      const { data, error } = await sb.rpc("painel_creditar_manual", {
        _partner_id: partnerId,
        _creditos: creditos,
        _motivo: motivo,
        _staff: staff,
      });

      if (error) {
        console.error("[creditos/acoes manual]", { partnerId, creditos, error });
        const e = erroDaBase(error, "Não foi possível creditar");
        return NextResponse.json({ error: e.error }, { status: e.status });
      }

      const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;

      await registarAuditoria(sb, {
        action: "creditar_manual",
        entity_id: partnerId,
        new_value: { ...r, creditos, _by: `${colab!.id}:${colab!.nome}` },
        reason: motivo,
      });

      return NextResponse.json({
        ok: true,
        resultado: r,
        // O aviso vem da base quando o profissional tem compras por pagar —
        // quase sempre sinal de que o gesto certo era confirmar a compra.
        aviso: typeof r?.aviso === "string" ? r.aviso : null,
        message: creditos > 0
          ? `${creditos} créditos atribuídos. Saldo: ${r?.saldo ?? "—"}.`
          : `${Math.abs(creditos)} créditos removidos. Saldo: ${r?.saldo ?? "—"}.`,
      });
    }

    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  } catch (e) {
    console.error("[creditos/acoes]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/** Dar créditos é mover dinheiro — quem o fez não é detalhe. */
async function registarAuditoria(
  sb: ReturnType<typeof getSupabaseAdmin>,
  entry: { action: string; entity_id: string; new_value: unknown; reason: string | null },
) {
  const { error } = await sb.from("admin_audit_log").insert([{
    action: entry.action,
    entity_type: "credit_purchase_order",
    entity_id: entry.entity_id,
    old_value: null,
    new_value: entry.new_value,
    reason: entry.reason,
  }]);
  if (error) console.error("[creditos/acoes] auditoria falhou", error);
}
