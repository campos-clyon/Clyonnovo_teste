import { sendPushToUser } from "./webpush";
import { urlDeAccao } from "./url-do-site";
import { avisarOClienteDoPedido, type TipoDeAvisoAoCliente } from "./avisos-ao-cliente";

/**
 * O QUE O BACKOFFICE FAZ CHEGA ÀS APPS — 29-10-2026 (S19, o resto da matriz B3).
 *
 * As acções da equipa que mudavam o pedido em silêncio passam a avisar quem
 * está nele: o cliente na app (pelos tipos de `avisos-ao-cliente.ts`, com o
 * pedido) e os profissionais no telemóvel (app Pro ou navegador), com o
 * trabalho. Os textos são puros (`avisoAoProfissional`) para se poderem testar;
 * o envio nunca lança — o que o provocou já está gravado.
 */

export type TipoDeAvisoAoProfissional =
  | "valor_corrigido"
  | "avaliado"
  | "oferta_retirada"
  | "outro_escolhido"
  | "reaberto"
  | "pedido_mudou"
  | "pago_antes"
  | "passou_para_si"
  // As horas de um trabalho por hora (31-10-2026).
  | "horas_confirmadas"
  | "horas_confirmadas_pela_clyon"
  | "horas_contestadas";

export function avisoAoProfissional(tipo: TipoDeAvisoAoProfissional, pedidoId: number): { title: string; body: string } {
  const id = pedidoId;
  switch (tipo) {
    case "valor_corrigido":
      return { title: `Valor do #${id} corrigido`, body: `A CLYON corrigiu o valor combinado do #${id}. Toque para ver.` };
    case "avaliado":
      return { title: "Tem uma avaliação nova", body: `A CLYON deixou a avaliação do cliente do #${id}. Toque para ver.` };
    case "oferta_retirada":
      return { title: `Trabalho CLYON #${id}`, body: `A oferta do #${id} foi retirada: o pedido voltou às propostas.` };
    case "outro_escolhido":
      return { title: "Negociação terminada", body: `O #${id} ficou com outro profissional. Os pedidos novos da sua zona estão em Novos.` };
    case "reaberto":
      return { title: `O #${id} voltou`, body: `O pedido #${id} voltou a estar aberto. Toque para ver.` };
    case "pedido_mudou":
      return { title: `O #${id} mudou`, body: `A CLYON mudou o pedido #${id}. Toque para ver antes de propor.` };
    case "passou_para_si":
      return { title: `O #${id} passou para si`, body: `A CLYON passou-lhe o trabalho do #${id}. Toque para ver a morada e combinar o dia.` };
    case "horas_confirmadas":
      return { title: "Horas confirmadas", body: `O cliente confirmou as horas do #${id}. Já pode concluir o trabalho.` };
    case "horas_confirmadas_pela_clyon":
      return { title: "Horas confirmadas", body: `A CLYON confirmou as horas do #${id}. Já pode concluir o trabalho.` };
    case "horas_contestadas":
      return { title: "O cliente não concorda com as horas", body: `Pedido #${id}: veja o motivo e corrija as horas.` };
    case "pago_antes":
      return { title: "Pagamento feito", body: `A CLYON pagou-lhe o trabalho do #${id}.` };
  }
}

/** Ao profissional de uma negociação. Nunca lança. */
export async function avisarProfissional(
  providerId: number,
  tipo: TipoDeAvisoAoProfissional,
  c: { pedidoId: number; negociacaoId?: number | null },
): Promise<void> {
  try {
    const { perfilDoProfissional } = await import("./db");
    const perfil = await perfilDoProfissional(providerId);
    const email = typeof perfil?.email === "string" ? perfil.email : null;
    if (!email) return;
    const a = avisoAoProfissional(tipo, c.pedidoId);
    let url = "/profissionais/painel";
    try {
      url = new URL(url, urlDeAccao()).toString();
    } catch {
      /* fica o caminho */
    }
    await sendPushToUser(
      email,
      { title: a.title, body: a.body, url, tag: `${tipo}-${c.negociacaoId ?? c.pedidoId}`, negociacaoId: c.negociacaoId ?? undefined },
      "pro",
    );
  } catch (err) {
    console.error("[avisos-do-backoffice]", tipo, err instanceof Error ? err.message : err);
  }
}

/** A todos os profissionais com proposta em aberto (ou contratados) no pedido. Nunca lança. */
export async function avisarProfissionaisDoPedido(
  pedidoId: number,
  tipo: TipoDeAvisoAoProfissional,
  estados: readonly string[] = ["aberta", "aguarda_contratacao", "acordada"],
): Promise<void> {
  try {
    const { negociacoesDoPedido } = await import("./db");
    const negs = await negociacoesDoPedido(pedidoId);
    await Promise.all(
      negs
        .filter((n) => estados.includes(String(n.estado)))
        .map((n) => avisarProfissional(Number(n.providerId), tipo, { pedidoId, negociacaoId: Number(n.id) })),
    );
  } catch (err) {
    console.error("[avisos-do-backoffice] profissionais:", err instanceof Error ? err.message : err);
  }
}

/** Ao cliente — os tipos de `avisos-ao-cliente.ts`. Nunca lança. */
export const avisarCliente = (pedidoId: number, tipo: TipoDeAvisoAoCliente, extra: { negociacaoId?: number | null } = {}) =>
  avisarOClienteDoPedido(pedidoId, tipo, extra);
