import {
  ladoDoCliente,
  ladoDoProfissional,
  pagouAoProfissional,
  prontoAPagar,
  type TrabalhoParaGerir,
} from "./dinheiro-do-trabalho";
import { metodoDoRecebimento, type ComoPagou } from "./pagamento-declarado";

/**
 * O QUE SE FAZ AOS MARCADOS DE UMA VEZ, nos Pagamentos — 08-10-2026.
 *
 * *«Quando marcar todos deve ter mais opções: eu devo poder aprovar todos e
 * fechar esses pedidos como já pagámos, sem ter que ir 1 a 1.»*
 *
 * São os botões de cada trabalho, e as mesmas rotas, um trabalho de cada vez:
 * as regras continuam a ser delas (o valor sai da conta gravada, só trabalhos
 * fechados, nunca duas vezes). Aqui decide-se só A QUEM cada acção se aplica —
 * a mesma pergunta que o trabalho aberto faz antes de mostrar o botão. Os
 * marcados a que não se aplica não são tocados.
 */

export type MetodoAMao = "transferencia" | "numerario" | "ao_profissional";

export type AccaoDoLote =
  /** «Confirmar que entrou», com o método que ficou dito ao dar o trabalho por feito. */
  | { tipo: "declarado" }
  /** «Já recebemos», com o método escolhido para todos. */
  | { tipo: "recebido"; metodo: MetodoAMao }
  /** «Já pagámos» ao profissional. */
  | { tipo: "pago" };

export type TrabalhoDoLote = TrabalhoParaGerir & {
  negociacaoId: number;
  pedidoId: number;
  clientePaga: number;
  profissionalRecebe: number;
  declarado?: { como: ComoPagou } | null;
};

export const ROTA_DO_RECEBIDO = "/api/admin/pagamentos/recebido";
export const ROTA_DO_PAGO = "/api/admin/pagamentos/pago-ao-profissional";

/** A chamada que esta acção faz a este trabalho — ou nula, se não se lhe aplica. */
export function oQueFazAoTrabalho(
  t: TrabalhoDoLote,
  a: AccaoDoLote,
): { url: string; corpo: Record<string, unknown> } | null {
  if (a.tipo === "pago") {
    // Recebeu em mão, ou já se pagou: não há transferência nenhuma a registar.
    if (ladoDoProfissional(t) !== "por_pagar") return null;
    return { url: ROTA_DO_PAGO, corpo: { negociacaoId: t.negociacaoId } };
  }
  if (ladoDoCliente(t) !== "por_receber") return null;
  if (a.tipo === "declarado") {
    /*
     * Em dinheiro com IVA incluído quem deve é o profissional (o IVA e a
     * comissão), e a declaração do cliente já não é a pergunta — no trabalho
     * aberto também não aparece.
     */
    if (pagouAoProfissional(t)) return null;
    const metodo = metodoDoRecebimento(t.declarado?.como ?? null);
    if (!metodo) return null;
    return { url: ROTA_DO_RECEBIDO, corpo: { negociacaoId: t.negociacaoId, metodo } };
  }
  // A dívida do profissional entra por transferência ou numerário — nunca «ao profissional».
  if (pagouAoProfissional(t) && a.metodo === "ao_profissional") return null;
  return { url: ROTA_DO_RECEBIDO, corpo: { negociacaoId: t.negociacaoId, metodo: a.metodo } };
}

export function aplicaSe(t: TrabalhoDoLote, a: AccaoDoLote): boolean {
  return oQueFazAoTrabalho(t, a) !== null;
}

/**
 * O valor que a lista mostra para este trabalho nesta acção — para a pergunta
 * antes de começar. Quem grava o valor certo é a rota (com ou sem IVA, conforme
 * o declarado); isto é o que se lê nas linhas.
 */
export function valorNoLote(t: TrabalhoDoLote, a: AccaoDoLote): number {
  if (a.tipo === "pago") return t.profissionalRecebe;
  return pagouAoProfissional(t) ? (t.dividaDoProfissional ?? 0) : t.clientePaga;
}

/**
 * O PROFISSIONAL PAGO DUAS VEZES: regista-se que o cliente lhe pagou em mão, e
 * a CLYON já lhe tinha transferido. A rota não o impede (o trabalho aberto
 * também não), e no TRSul havia três assim a 08-10-2026 — a pergunta antes do
 * lote di-lo, para se conferir antes.
 */
export function jaPagoEPagouEmMao(t: TrabalhoDoLote, a: AccaoDoLote): boolean {
  const o = oQueFazAoTrabalho(t, a);
  return o?.corpo.metodo === "ao_profissional" && t.pagoEm != null;
}

/** Quantos dos que se vão marcar como pagos ainda não estavam prontos — ficam como adiantados. */
export function adiantados(linhas: readonly TrabalhoDoLote[]): number {
  return linhas.filter((t) => aplicaSe(t, { tipo: "pago" }) && !prontoAPagar(t)).length;
}

/**
 * FEITO OU AINDA POR FAZER — 08-10-2026. *«Separe os trabalhos entre os que
 * foram feitos e os que ainda não.»*
 *
 * Feito é o profissional tê-lo dado por entregue (`feitoEm`, a prova), ou o
 * trabalho estar confirmado — a CLYON pode confirmá-lo sem prova, e aí dá-o
 * por entregue no mesmo gesto. Um trabalho combinado para daqui a uma semana
 * está «por receber» como os outros, mas ainda não aconteceu.
 */
export function foiFeito(t: { feitoEm?: string | null; confirmadoEm?: Date | string | null }): boolean {
  return t.feitoEm != null || t.confirmadoEm != null;
}

/**
 * A ORDEM DE CADA LISTA — pelo número do pedido, do maior para o menor.
 *
 * 08-10-2026: *«Coloque em ordem esses trabalhos.»* Ordenava-se pela data
 * que a lista mostrava, e dentro de cada profissional os números saíam
 * baralhados (#504, #500, #457, #488, #448…). 29-10-2026, o dono: *«ordenar
 * sempre pelo número do pedido, do maior para o menor»* — o mais recente no
 * topo, #500 por cima de #499. Vale para todas as listas dos Pagamentos;
 * a ordem dos grupos (profissional, dia, prontos a pagar…) não muda.
 * Com o mesmo número, fica a ordem que trazia. Não mexe na lista que recebe.
 */
export function porNumeroDoPedido<T extends { pedidoId: number }>(linhas: readonly T[]): T[] {
  return [...linhas].sort((a, b) => b.pedidoId - a.pedidoId);
}
