/**
 * «ANULAR A REFERÊNCIA» — 16-11-2026 (d52, dono).
 *
 * Uma referência Multibanco ou um MB WAY do cliente que ainda está por pagar
 * deixa de valer NA PLATAFORMA: a linha fica `cancelado` (o estado que já
 * existe; nunca se apaga), com o motivo escrito, no histórico do pedido e no
 * registo permanente (quem, quando, motivo). Só o administrador geral.
 *
 * ⚠️ O euPAGO NÃO FICA A SABER. A nossa integração não tem forma documentada de
 * anular uma referência nem um MB WAY do lado deles (ver `eupago.ts` e
 * `fecharPagamentosDoPedido`): a referência continua a poder ser paga no
 * multibanco do cliente. Se for, o aviso entra na mesma (o `cancelado` está em
 * `AINDA_PODE_SER_PAGO`), mas NÃO fecha o pedido: o motivo começa por
 * `MOTIVO_DA_REFERENCIA_ANULADA`, e `pagamentoForaDeVigor` reconhece-o — fica
 * por aplicar, à vista nos Pagamentos, com o valor a devolver ao cliente.
 *
 * Puro, sem base: a rota lê e escreve; isto diz o que se pode e com que texto.
 */

/** O começo do motivo gravado na linha — é por ele que o webhook a reconhece. */
export const MOTIVO_DA_REFERENCIA_ANULADA = "Referência anulada";

export const MOTIVO_MINIMO = 5;
export const MOTIVO_MAXIMO = 200;

/** O motivo gravado na coluna `erro` (255 caracteres). */
export function motivoDaAnulacao(quem: string, motivo: string): string {
  return `${MOTIVO_DA_REFERENCIA_ANULADA} por ${quem}: ${motivo}`.slice(0, 255);
}

export function eReferenciaAnulada(l: { estado: string; erro?: string | null }): boolean {
  return l.estado === "cancelado" && (l.erro ?? "").startsWith(MOTIVO_DA_REFERENCIA_ANULADA);
}

export type PedidoDeAnulacao = { pagamentoId: number; motivo: string };

export function lerAnulacao(corpo: Record<string, unknown>): { ok: true; pedido: PedidoDeAnulacao } | { ok: false; erro: string } {
  const pagamentoId = Number(corpo.pagamentoId);
  if (!Number.isInteger(pagamentoId) || pagamentoId <= 0) return { ok: false, erro: "Pagamento não indicado." };
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, erro: "Escreva o motivo da anulação." };
  return { ok: true, pedido: { pagamentoId, motivo: motivo.slice(0, MOTIVO_MAXIMO) } };
}

type LinhaQueSeAnula = { estado: string; metodo: string; parte?: unknown };

/** `null` quando a referência se pode anular; senão, o porquê. */
export function porqueNaoSeAnula(p: LinhaQueSeAnula): string | null {
  if (p.parte === "divida") return "Esta referência não é um pagamento do cliente.";
  if (p.metodo !== "multibanco" && p.metodo !== "mbway") return "Só se anulam referências Multibanco e pedidos MB WAY.";
  if (p.estado !== "pendente") return "Esta referência já não está por pagar.";
  return null;
}

/** O que diz a janela de confirmação, antes de anular. */
export function textoDaConfirmacao(p: { referencia: string | null; metodo: string; valor: number }): string {
  const qual = p.metodo === "mbway" ? "O pedido MB WAY" : `A referência ${p.referencia ?? "Multibanco"}`;
  const valor = `${p.valor.toFixed(2).replace(".", ",")} €`;
  return (
    `${qual} de ${valor} deixa de valer na plataforma. ` +
    "Se o cliente a pagar mesmo assim, o pagamento entra e fica para devolver.\n\n" +
    "O euPago não é avisado: só a plataforma a deixa de contar."
  );
}

/** A frase do histórico do pedido e do registo permanente. */
export function fraseDaAnulacao(
  p: { referencia: string | null; metodo: string; valor: number },
  d: { quem: string; motivo: string },
): string {
  const qual = p.metodo === "mbway" ? "Pedido MB WAY" : `Referência Multibanco ${p.referencia ?? ""}`.trim();
  return (
    `${qual} de ${p.valor.toFixed(2).replace(".", ",")} € anulada por ${d.quem} — motivo: ${d.motivo}. ` +
    "Deixa de valer na plataforma (o euPago não é avisado); se for paga, fica para devolver."
  );
}
