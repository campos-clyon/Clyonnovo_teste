/**
 * Quem responde pelo lado do cliente numa negociação?
 *
 * Não é uma etiqueta decorativa — decide quem tem de agir, e decide se a CLYON
 * pode confirmar um trabalho em nome de alguém.
 *
 * Dois casos em que a CLYON responde, e são os dois observáveis nos dados:
 *
 *   · o pedido foi registado pela equipa (origem "backoffice") — chegou por
 *     WhatsApp ou por telefone, a pessoa nunca foi ao site;
 *   · não há email — sem email não há como mandar o link, e sem link não há
 *     como responder.
 *
 * Tudo o resto é do cliente: recebeu o link no email e responde sozinho.
 *
 * PORQUE É QUE ISTO SAIU DO COMPONENTE
 *
 * Vivia dentro do painel do backoffice, e era só usado para desenhar dois
 * grupos no ecrã. A partir do momento em que a CLYON pode CONFIRMAR um
 * trabalho — o gesto que liberta o dinheiro do profissional — esta regra
 * deixou de ser decoração e passou a ser um portão. Um portão que vive no
 * browser não é um portão.
 *
 * Fica aqui para que o servidor e o ecrã usem a MESMA regra. Copiada em dois
 * sítios, o dia em que uma delas mudasse era o dia em que o ecrã escondia um
 * botão que a rota continuava a aceitar — ou o contrário.
 */

export type LadoDoCliente = "clyon" | "cliente";

/** O mínimo para decidir. Serve tanto a linha do painel como a do servidor. */
export type PedidoParaDecidir = {
  /** `origemPedido` do rawOrderJson. */
  origem?: string | null;
  contactEmail?: string | null;
};

export function quemNegoceia(p: PedidoParaDecidir): LadoDoCliente {
  if (p.origem === "backoffice") return "clyon";
  if (!p.contactEmail || p.contactEmail.trim() === "") return "clyon";
  return "cliente";
}

/**
 * A CLYON pode confirmar este trabalho em nome do cliente?
 *
 * É a mesma pergunta com outro nome, e o nome importa: é isto que separa
 * "arrumar o ecrã" de "libertar o dinheiro de outra pessoa".
 *
 * Se o cliente TEM como confirmar — tem email, recebeu o link, ou tem conta —
 * então é ele que confirma, e mais ninguém. A promessa da plataforma é que o
 * dinheiro só se solta quando quem pagou disser que está feito. Deixar a CLYON
 * fazer isso por um cliente que podia falar por si é desfazer a promessa por
 * conveniência de quem está do lado de dentro.
 */
export function clyonPodeConfirmar(p: PedidoParaDecidir): boolean {
  return quemNegoceia(p) === "clyon";
}

/** Porque é que não pode — para o ecrã dizer alguma coisa em vez de nada. */
export function porqueNaoPodeConfirmar(p: PedidoParaDecidir): string | null {
  if (clyonPodeConfirmar(p)) return null;
  return "Este cliente tem email e confirma pelo link que recebeu. Só ele pode libertar o pagamento.";
}
