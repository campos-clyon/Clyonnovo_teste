/**
 * O «PRECISA INFO» NÃO SOBREVIVE AO PEDIDO QUE AVANÇOU — 24-11-2026 (d110).
 *
 * O #658: a 22/11 a equipa pediu informação ao cliente (`pedirMaisDetalhes`,
 * estado `precisa_info`). O cliente respondeu pelo WhatsApp; a 23/11 o pedido
 * foi editado, recomeçado e enviado aos parceiros, e o orçamento foi ao
 * cliente — e o estado ficou `precisa_info`. Só a resposta pela conta ou pela
 * app (`resposta-ao-que-falta-na-base.ts`) o limpava.
 *
 * A regra: quando o pedido segue para os parceiros (enviar, redistribuir,
 * recomeçar — tudo passa por `distribuirPedido`, e conta só se chegou a
 * alguém), quando chega a primeira resposta de um parceiro (`gravarNegociacao`
 * com uma proposta dele, ou o «aceito»), ou quando o orçamento vai ao cliente
 * (`marcarOrcamentoEnviado` / `marcarPropostaEnviada`), um `precisa_info`
 * volta ao estado de um pedido em negociação — o mesmo de
 * `estadoDeVoltaDoPrecisaInfo` (d86): «atribuído» se alguém o tem, «por
 * atribuir» se não. Enviar aos parceiros não muda o estado de nenhum outro
 * pedido, por isso é esse o estado normal da negociação. Fica uma linha no
 * histórico a dizer porquê. A escrita é `sairDoPrecisaInfo` (db.ts), pela base
 * e com a guarda `status = 'precisa_info'`: sem o email da mudança de estado,
 * e um estado que outra pessoa mudou entretanto fica o de quem mudou.
 *
 * Pura e sem imports: os testes lêem-na, e o db.ts importa-a sem ciclos.
 */

/** Porque é que o pedido saiu de «precisa info». */
export type PorqueSaiDoPrecisaInfo = "enviado" | "proposta" | "orcamento";

/** A linha do histórico, uma por motivo. */
export const SAIU_DO_PRECISA_INFO: Record<PorqueSaiDoPrecisaInfo, string> = {
  enviado:
    "Saiu de «precisa info»: o pedido seguiu para os parceiros, e por isso já não fica à espera da resposta do cliente para avançar.",
  proposta: "Saiu de «precisa info»: chegou a primeira resposta de um parceiro ao pedido.",
  orcamento: "Saiu de «precisa info»: o orçamento foi enviado ao cliente.",
};

/**
 * O estado de volta, em SQL — a mesma regra de `estadoDeVoltaDoPrecisaInfo`
 * (resposta-ao-que-falta.ts): «atribuido» com alguém a tratar do pedido,
 * «sem_assistente» sem ninguém.
 */
export const ESTADO_DE_VOLTA_DO_PRECISA_INFO_SQL =
  "CASE WHEN COALESCE(assignedToId, 0) > 0 THEN 'atribuido' ELSE 'sem_assistente' END";

/**
 * A gravação de uma negociação é a resposta de um parceiro? Uma proposta dele
 * nas propostas, ou o «aceito» (`aguarda_contratacao`) / o fecho (`acordada`).
 */
export function eRespostaDeParceiro(dados: { estado: string; propostasJson: string | null | undefined }): boolean {
  if (dados.estado === "aguarda_contratacao" || dados.estado === "acordada") return true;
  if (!dados.propostasJson) return false;
  try {
    const l = JSON.parse(dados.propostasJson);
    return Array.isArray(l) && l.some((p) => p && typeof p === "object" && (p as { por?: unknown }).por === "profissional");
  } catch {
    return false;
  }
}
