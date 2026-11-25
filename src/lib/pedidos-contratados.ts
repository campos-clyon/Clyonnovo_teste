/**
 * O PARCEIRO JÁ ESTÁ CONTRATADO — as duas listas num sítio só (d124,
 * 25-11-2026). Eram escritas à mão dentro de `faseDoPedido`
 * (`pedido-em-curso.ts`); a arrumação do WhatsApp (`arrumar-o-whatsapp.ts`)
 * precisa da mesma resposta, e duas cópias acabam a discordar.
 */

/** As negociações em que o parceiro já foi contratado. */
export const NEGOCIACOES_CONTRATADAS = ["acordada", "aguarda_contratacao", "confirmada", "em_execucao", "executada"] as const;

/** Os estados do pedido com parceiro contratado. */
export const PEDIDOS_CONTRATADOS = ["confirmado", "agendado", "em_execucao", "em_curso"] as const;
