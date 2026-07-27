import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Passa a vassoura às reservas por pagar, agora em vez de esperar pela hora.
 *
 * O agendador (`pg_cron`, `clyon_reservas_por_pagar`) corre de hora a hora e
 * faz três coisas: lembra o cliente às 24 h, caduca a referência manual aos 3
 * dias e cancela o pedido aos 7. Este botão existe para o caso em que o
 * agendador não correu — e é a forma de o operador confirmar isso mesmo,
 * porque o resultado diz quantos itens estavam em atraso.
 *
 * Não é destrutivo por si: cancela apenas o que já passou do prazo, e um
 * pedido em `awaiting_deposit` nunca foi publicado a nenhum profissional.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc("processa_reservas_por_pagar");

    if (error) {
      const msg = error.message ?? "";
      if (error.code === "PGRST202" || /function .* does not exist/i.test(msg)) {
        return NextResponse.json({
          error: "A função processa_reservas_por_pagar não existe nesta base — é da migração dos prazos das reservas.",
        }, { status: 503 });
      }
      console.error("[reservas-por-pagar]", error);
      return NextResponse.json({ error: `Não foi possível correr: ${msg}` }, { status: 400 });
    }

    const r = (data ?? {}) as Record<string, unknown>;
    const lembretes = Number(r.lembretes ?? 0);
    const caducadas = Number(r.referencias_caducadas ?? 0);
    const cancelados = Number(r.pedidos_cancelados ?? 0);

    // Cancelar pedidos é irreversível — fica registado quem mandou correr.
    if (lembretes + caducadas + cancelados > 0) {
      const { error: auditErr } = await sb.from("admin_audit_log").insert([{
        action: "processar_reservas_por_pagar",
        entity_type: "payment_reference",
        entity_id: "manual",
        old_value: null,
        new_value: { ...r, _by: `${colab!.id}:${colab!.nome}` },
        reason: null,
      }]);
      if (auditErr) console.error("[reservas-por-pagar] auditoria falhou", auditErr);
    }

    const partes = [
      lembretes > 0 ? `${lembretes} lembrete${lembretes === 1 ? "" : "s"} enviado${lembretes === 1 ? "" : "s"}` : null,
      caducadas > 0 ? `${caducadas} referência${caducadas === 1 ? "" : "s"} caducada${caducadas === 1 ? "" : "s"}` : null,
      cancelados > 0 ? `${cancelados} pedido${cancelados === 1 ? "" : "s"} cancelado${cancelados === 1 ? "" : "s"}` : null,
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      resultado: r,
      message: partes.length > 0
        ? partes.join(" · ")
        : "Nada em atraso — o agendador está a fazer o trabalho dele.",
    });
  } catch (e) {
    console.error("[reservas-por-pagar]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
