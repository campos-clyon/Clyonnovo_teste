import { pagouAoProfissional, type TrabalhoParaGerir } from "./dinheiro-do-trabalho";
import { pedidoArrumado } from "./pedido-arrumado";
import { aindaNaoEstaNaData } from "./ainda-nao-esta-na-data";

/**
 * O QUE É UM TRABALHO CONCLUÍDO — UMA SÓ DEFINIÇÃO. d76 (CEO e dono, 20-11-2026).
 *
 * O #505 (Trabalho CLYON) tinha o cliente pago e o profissional pago, e estava
 * em «Concluídos» na Mesa — mas o pedido continuava «pendente», e por isso as
 * comissões e a lista de Pedidos diziam «por fazer». Havia duas definições:
 *
 *   · a Mesa: um Trabalho CLYON com `pagoEm` (fase «paga») ia para os
 *     Concluídos, mesmo sem o cliente pagar nem confirmar; um pedido da
 *     plataforma, com `status = concluido` ou uma negociação confirmada;
 *   · as comissões e os Pedidos: `status = concluido`.
 *
 * Daqui em diante a Mesa e o servidor lêem esta regra, e o pedido pago dos dois
 * lados passa a `concluido` sozinho (`fecho-automatico.ts`) — assim as
 * comissões, que contam pelo `status`, batem com a Mesa.
 */

/** Os marcos de uma negociação que chegam para dizer se o trabalho está concluído. */
export type MarcosDoTrabalho = {
  confirmadoEm?: unknown;
  pagoEm?: unknown;
  /** O pagamento da negociação dado por pago (o do cliente; no modelo de 15-11, a taxa do parceiro). */
  clientePagouEm?: unknown;
};

const ha = (v: unknown) => v != null && v !== "";

/**
 * Concluído pelos marcos da negociação: confirmado, ou pago dos dois lados
 * (o cliente pagou e a CLYON pagou ao profissional). Um pagamento ao
 * profissional adiantado, sem o cliente ter pago nem confirmado, NÃO conclui.
 */
export function concluidoPelosMarcos(n: MarcosDoTrabalho): boolean {
  return ha(n.confirmadoEm) || (ha(n.pagoEm) && ha(n.clientePagouEm));
}

/** O pedido está concluído? O estado, ou uma das suas negociações. */
export function trabalhoConcluido(p: {
  status?: string | null;
  negociacoes?: ReadonlyArray<MarcosDoTrabalho> | null;
}): boolean {
  return p.status === "concluido" || (p.negociacoes ?? []).some(concluidoPelosMarcos);
}

/**
 * PAGO DOS DOIS LADOS — o sinal do fecho automático, em cada modelo.
 *
 *   · MODELO ANTIGO (a CLYON recebe e paga depois; todos os Trabalhos CLYON
 *     de antes de 15-11): o pagamento do cliente dado por pago
 *     (`clientePagouEm`, euPago ou registado à mão) E o «Já pagámos ao
 *     profissional» (`pagoEm`). Não se exige a confirmação: o #505 não a tem.
 *   · PAGO EM MÃO / MODELO DE 15-11 (o cliente paga ao parceiro): o lado do
 *     cliente é o trabalho fechado (`confirmadoEm` — o cliente não paga à
 *     CLYON); o lado do parceiro é a taxa e o IVA passados à CLYON (o pagamento
 *     da negociação, `clientePagouEm`). Sem nada a passar (dívida nula ou
 *     zero), chega o trabalho fechado.
 */
export function pagoDosDoisLados(
  t: TrabalhoParaGerir & { taxaEmMao?: { valor: number; cobrada: boolean } | null },
): boolean {
  if (pagouAoProfissional(t)) {
    if (!ha(t.confirmadoEm)) return false;
    // Registado «pago ao profissional»: a parte da CLYON fecha-se numa linha à parte (d3).
    if (t.taxaEmMao && t.taxaEmMao.valor > 0 && !t.taxaEmMao.cobrada) return false;
    const deve = t.dividaDoProfissional != null && t.dividaDoProfissional > 0;
    return deve ? ha(t.clientePagouEm) : true;
  }
  return ha(t.clientePagouEm) && ha(t.pagoEm);
}

/** Porque é que um pedido pago dos dois lados não fecha sozinho. Nulo = fecha. */
export type PorqueNaoFecha =
  | "ja_concluido"
  | "arrumado"
  | "de_teste"
  | "data_futura"
  | "sem_trabalho"
  | "falta_um_lado";

export type PedidoParaOFecho = {
  status: string | null | undefined;
  /** As negociações acordadas do pedido, como as dá `trabalhosParaGerir`. */
  trabalhos: ReadonlyArray<
    TrabalhoParaGerir & {
      contaDeTeste?: boolean;
      agendadoPara?: string | null;
      taxaEmMao?: { valor: number; cobrada: boolean } | null;
    }
  >;
};

/**
 * PODE FECHAR SOZINHO? As guardas, pela ordem: já concluído (não exporta duas
 * vezes), arrumado (d27 — um cancelado fica cancelado), sem trabalho,
 * profissional de teste, falta um lado, e a data ainda por chegar (como o
 * `confirmarSeFuturo` do «Realizado»: em Lisboa, `aindaNaoEstaNaData`).
 */
export function porqueNaoFecha(p: PedidoParaOFecho, agora: Date = new Date()): PorqueNaoFecha | null {
  if (p.status === "concluido") return "ja_concluido";
  if (pedidoArrumado(p.status)) return "arrumado";
  if (p.trabalhos.length === 0) return "sem_trabalho";
  if (p.trabalhos.some((t) => t.contaDeTeste === true)) return "de_teste";
  if (!p.trabalhos.every(pagoDosDoisLados)) return "falta_um_lado";
  if (p.trabalhos.some((t) => aindaNaoEstaNaData(t.agendadoPara ?? null, agora))) return "data_futura";
  return null;
}

/** O que fica no histórico do pedido quando fecha sozinho. */
export const HISTORICO_DO_FECHO_AUTOMATICO = "Realizado automaticamente: cliente e profissional pagos";

/** Quem fecha, no registo permanente. */
export const ORIGEM_DO_FECHO_AUTOMATICO = "automático";

/** Uma linha da lista «Pagos dos dois lados, ainda não realizados» (só o admin a lê). Sem o nome nem o contacto do cliente. */
export type PagoPorRealizar = {
  pedidoId: number;
  estado: string;
  servico: string | null;
  cidade: string | null;
  profissional: string;
  clientePaga: number | null;
  agendadoPara: string | null;
  /** Ainda não está na data: fecha sozinho depois do dia (ou à mão, com o aviso). */
  dataFutura: boolean;
  /** Quando ficou pago dos dois lados (ms), para a conferência separar os de antes da d76. */
  pagoDosDoisLadosEm: number | null;
};
