import type { FormaDePagamento } from "./forma-de-pagamento";
import { gerarTokenDeAcesso, linkDoPedido } from "./pedido-acesso";
import { urlDeAccao } from "./url-do-site";

/**
 * QUEM FECHA PELO WHATSAPP RECEBE O LINK DO PEDIDO — 01-11-2026 (ordem do CEO,
 * aprovada pelo dono; proposta 3 da I&D de 31-10-2026).
 *
 * O cliente do WhatsApp nasce sem email, e o token do pedido só fica em hash:
 * nunca recebia o link. Por isso o «o cliente paga sozinho» (30-10-2026) não
 * lhe chegava — a referência ia à mão pelo «Enviar adjudicação» — e o «Está
 * feito» e a chegada tinham de passar por uma pessoa.
 *
 * Agora, na mensagem «Fechado com …» da Vitória, vai o link do pedido: lá ele
 * paga por MB WAY ou Multibanco, confirma a chegada do parceiro e o trabalho
 * feito. O link é novo (o antigo não se recupera — só há o hash), pelo mesmo
 * mecanismo do link do ajuste e do aviso da proposta. Quem já tem conta com o
 * email do pedido vai para a conta, e o link que guardou continua válido.
 */

/** A frase do link, pela forma de pagamento. PT-PT, «parceiro» ao cliente. */
export function fraseDoLinkDoFecho(forma: FormaDePagamento, link: string, novoModelo = false): string {
  const acompanhar = "confirmar a chegada do parceiro e o trabalho feito";
  /*
   * d10, desde 15-11-2026: o cliente paga ao parceiro, e é no pedido que vê o
   * IBAN e o MB WAY dele e escolhe como paga. A Vitória não os diz por aqui.
   */
  if (novoModelo) {
    return `Para ver como pagar ao parceiro (o IBAN e o MB WAY dele estão lá), as faturas, e para ${acompanhar}, abra o seu pedido:\n${link}`;
  }
  return forma === "dinheiro"
    ? `Para acompanhar o trabalho — ${acompanhar} — abra o seu pedido:\n${link}`
    : `Para pagar por MB WAY ou Multibanco e acompanhar o trabalho — ${acompanhar} — abra o seu pedido:\n${link}`;
}

export type DependenciasDoLink = {
  /** O email do pedido, se o houver. */
  emailDoPedido: (pedidoId: number) => Promise<string | null>;
  existeContaComEmail: (email: string) => Promise<boolean>;
  substituirTokenDoPedido: (pedidoId: number, hash: string, expiraEm: Date) => Promise<void>;
  site?: string;
};

/**
 * O link para quem acabou de fechar. Nunca lança: o negócio já está fechado,
 * e um link que falha não o desfaz — devolve `null` e a mensagem sai sem ele.
 */
export async function linkParaQuemFechou(
  pedidoId: number,
  dep: DependenciasDoLink,
  agora: Date = new Date(),
): Promise<string | null> {
  try {
    const site = (dep.site ?? urlDeAccao()).replace(/\/+$/, "");
    const email = await dep.emailDoPedido(pedidoId);
    if (email && (await dep.existeContaComEmail(email))) return `${site}/conta`;
    const novo = gerarTokenDeAcesso(agora);
    await dep.substituirTokenDoPedido(pedidoId, novo.hash, novo.expiraEm);
    return linkDoPedido(site, novo.token);
  } catch (err) {
    console.error("[link-do-fecho] o link do pedido não saiu:", err instanceof Error ? err.message : err);
    return null;
  }
}
