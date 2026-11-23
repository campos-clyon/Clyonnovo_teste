/**
 * O VALOR ÚNICO, NA APP — 15-11-2026 (d39). Num pedido em que a CLYON enviou
 * ao cliente um valor só, a rota do pedido (R5) deixa de mandar as propostas
 * (só sai a contratada) e manda `pedido.valorUnico: { titulo, valor, quemFaz }`
 * — null em todos os outros pedidos. A app mostra esse cartão, sem lista de
 * parceiros e nunca «ainda sem propostas».
 *
 * A APP NÃO ESCREVE O VALOR: o título, o valor (com o IVA e o sem IVA ao lado,
 * «X € + IVA = Y €») e a frase de quem faz vêm da rota, tal como estão. A
 * aceitação não é da app: o servidor recusa aceitar propostas pelo lado do
 * cliente (`VALOR_UNICO_PELA_CLYON`) e o site diz «responda SIM na conversa
 * com a CLYON». Por isso «Aceitar» abre o WhatsApp da CLYON com o SIM escrito.
 *
 * Puro (sem Expo nem React Native): os testes do site importam-no.
 */

export type ValorUnico = { titulo: string; valor: string; quemFaz: string };

/** A frase do site, por baixo do valor (`/pedido/[token]` e a conta). */
export const PARA_ACEITAR = "Para aceitar, responda SIM na conversa com a CLYON.";

/** O botão do cartão. */
export const ACEITAR = "Aceitar";

/** O valor único da rota, só se vier inteiro; um site antigo (ou outro pedido) não o manda. */
export function valorUnicoDe(p: { valorUnico?: unknown } | null | undefined): ValorUnico | null {
  const v = p?.valorUnico as Partial<Record<keyof ValorUnico, unknown>> | null | undefined;
  if (!v || typeof v !== "object") return null;
  const { titulo, valor, quemFaz } = v;
  if (typeof titulo !== "string" || typeof valor !== "string" || typeof quemFaz !== "string") return null;
  if (!titulo.trim() || !valor.trim() || !quemFaz.trim()) return null;
  return { titulo, valor, quemFaz };
}

/** A mensagem que «Aceitar» deixa escrita no WhatsApp da CLYON: o SIM e o número do pedido. */
export function mensagemDeAceitar(pedidoId: number): string {
  return `SIM, aceito o orçamento do pedido #${pedidoId}.`;
}

/**
 * O cartão só se mostra enquanto a CLYON não escolheu o parceiro: sem a
 * contratada, fora de um Trabalho CLYON e com o pedido em aberto (a rota já o
 * manda a null nesses casos; a app confirma, para nunca mostrar dois preços).
 */
export function valorUnicoParaMostrar(r: {
  pedido: { valorUnico?: unknown; trabalhoClyon?: boolean; estadoTexto?: string };
  negociacoes: Array<{ estado: string }>;
}): ValorUnico | null {
  const v = valorUnicoDe(r.pedido);
  if (!v || r.pedido.trabalhoClyon) return null;
  if (r.negociacoes.some((n) => n.estado === "acordada")) return null;
  if (r.pedido.estadoTexto === "Cancelado" || r.pedido.estadoTexto === "Arquivado" || r.pedido.estadoTexto === "Concluído") return null;
  return v;
}
