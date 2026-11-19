/**
 * OS AVISOS DO euPAGO QUE NÃO MOVEM DINHEIRO — 19-11-2026 (d72, dono).
 *
 * O alarme «aviso(s) do euPago por aplicar» dos Pagamentos conta as linhas de
 * `avisosDoEupago` com `aplicado = 0`. Cada uma devia ser dinheiro que se
 * moveu do lado deles e não do nosso. Dois casos não são:
 *
 *   1. Um aviso de «expirado», «cancelado» ou «erro» num pagamento que já não
 *      estava pendente (já pago, já anulado, já expirado pela conferência). Não
 *      entrou dinheiro nenhum: fica dado por resolvido (`aplicado = 1`) com uma
 *      nota que o diz, e sai do alarme. Um «pago» num pagamento que já não
 *      estava pendente CONTINUA alarme — aí entrou dinheiro.
 *   2. Um aviso que o administrador viu e sabe que não é nada (uma referência
 *      de teste, por exemplo): o botão «Dispensar», com motivo obrigatório.
 *      A linha não se apaga: fica `aplicado = 1` com «Dispensado por …: …».
 *
 * Puro, sem base: a rota e o webhook lêem e escrevem; isto diz o que se grava.
 */

import type { EstadoDoAviso } from "@/lib/webhook-do-eupago";

/** O começo da nota de um aviso sem dinheiro num pagamento já fechado. */
export const NOTA_SEM_DINHEIRO = "Sem efeito";

/**
 * O que se escreve no aviso depois de `fecharSemPagar` — só para os estados que
 * não trazem dinheiro (expirado, cancelado, erro).
 *
 * Pegou: aplicado, sem nota. Não pegou (o pagamento já não estava pendente):
 * aplicado na mesma, com a nota a dizer porquê — não há dinheiro a conciliar.
 */
export function anotacaoDoFechoSemPagar(
  estado: Exclude<EstadoDoAviso, "pago" | "reembolsado">,
  r: { feito: true } | { feito: false; porque: string },
): { aplicado: boolean; nota: string | null } {
  if (r.feito) return { aplicado: true, nota: null };
  return {
    aplicado: true,
    nota: `${NOTA_SEM_DINHEIRO}: aviso de «${estado}» num pagamento que já não estava pendente — não moveu dinheiro.`,
  };
}

export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 200;

export type PedidoDeDispensa = { avisoId: number; motivo: string };

/** Lê o corpo do «Dispensar»: o número do aviso e o motivo (3 a 200 caracteres). */
export function lerDispensa(
  corpo: Record<string, unknown>,
): { ok: true; pedido: PedidoDeDispensa } | { ok: false; erro: string } {
  const avisoId = Number(corpo.avisoId);
  if (!Number.isInteger(avisoId) || avisoId <= 0) return { ok: false, erro: "Aviso não indicado." };
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, erro: "Escreva o motivo para dispensar o aviso." };
  if (motivo.length > MOTIVO_MAXIMO) {
    return { ok: false, erro: `O motivo tem no máximo ${MOTIVO_MAXIMO} caracteres.` };
  }
  return { ok: true, pedido: { avisoId, motivo } };
}

/** A nota gravada no aviso (a coluna tem 255 caracteres). */
export function notaDaDispensa(quem: string, motivo: string): string {
  return `Dispensado por ${quem}: ${motivo}`.slice(0, 255);
}

/** A frase do histórico do pedido e do registo permanente. */
export function fraseDaDispensa(
  a: { estado: string; valor: number | null; pagamentoId: number | null },
  d: { quem: string; motivo: string },
): string {
  const valor = a.valor == null ? "sem valor" : `${a.valor.toFixed(2).replace(".", ",")} €`;
  const de = a.pagamentoId ? ` do pagamento #${a.pagamentoId}` : "";
  return `Aviso do euPago «${a.estado}» (${valor})${de} dispensado por ${d.quem} — motivo: ${d.motivo}.`;
}
