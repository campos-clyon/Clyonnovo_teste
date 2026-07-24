import type { getSupabaseAdmin } from "./supabase-admin";

/**
 * Publica um pedido no marketplace de parceiros do CLYON Bridge.
 *
 * Chama a RPC publish_request_to_eligible_partners (definida no projecto
 * Bridge), que cria uma job_offer pendente para cada parceiro aprovado —
 * é isso que faz o pedido aparecer na secção de oportunidades da app dos
 * profissionais. Sem esta chamada, mudar o estado para "A atribuir" não
 * tem qualquer efeito visível para os parceiros.
 *
 * A RPC valida: estado ∈ (confirmed, assignment_pending) e preço > 0.
 * Nunca lança — devolve o resultado para o chamador reportar ao admin.
 */
export async function publishRequestToPartners(
  sb: ReturnType<typeof getSupabaseAdmin>,
  requestId: string,
): Promise<{ ok: boolean; partnersInvited: number; warning: string | null }> {
  try {
    const { data, error } = await sb.rpc("publish_request_to_eligible_partners", {
      _request_id: requestId,
    });

    if (error) {
      const missing = error.code === "PGRST202" || /function .* does not exist/i.test(error.message ?? "");
      const warning = missing
        ? "Função de publicação a parceiros indisponível no Supabase — as ofertas não foram criadas."
        : `Publicação a parceiros falhou: ${error.message}`;
      console.error("[partner-publish]", { requestId, error });
      return { ok: false, partnersInvited: 0, warning };
    }

    const invited = typeof data === "number" ? data : 0;
    return { ok: true, partnersInvited: invited, warning: null };
  } catch (e) {
    console.error("[partner-publish] erro inesperado", { requestId, e });
    return { ok: false, partnersInvited: 0, warning: "Erro inesperado ao publicar a parceiros." };
  }
}

/**
 * Regista a publicação na auditoria do pedido (não-bloqueante).
 */
export async function auditPartnerPublish(
  sb: ReturnType<typeof getSupabaseAdmin>,
  requestId: string,
  colabId: number,
  colabNome: string,
  partnersInvited: number,
): Promise<void> {
  const { error } = await sb.from("service_request_ops").insert([{
    request_id:  requestId,
    colab_id:    colabId,
    colab_nome:  colabNome,
    action_type: "assignment",
    status_from: null,
    status_to:   null,
    reason:      null,
    note:        partnersInvited > 0
      ? `Oportunidade publicada a ${partnersInvited} parceiro(s) aprovado(s).`
      : "Oportunidade publicada — todos os parceiros aprovados já tinham oferta activa.",
    data_json:   { partners_invited: partnersInvited, auto: true },
  }]);
  if (error) console.error("[partner-publish] auditoria falhou", { requestId, error });
}
