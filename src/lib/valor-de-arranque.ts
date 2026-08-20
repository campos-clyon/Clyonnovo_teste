/**
 * O número com que uma negociação começa.
 *
 * Sem ele não há distribuição: um pedido sem valor de partida não se manda a
 * ninguém, porque o profissional abriria um ecrã sem nada sobre que propor.
 *
 * Isto existe como módulo próprio por uma razão concreta. A regra estava
 * escrita à mão dentro da rota assim:
 *
 *     estimativa?.total ?? estimativa?.max ?? estimativa?.min ?? 0
 *
 * e nenhum desses três campos existe. O objecto da estimativa chama-lhes
 * `estimatedPriceWithVat`, `estimatedPriceWithoutVat`, `estimateMaxWithoutVat`.
 * O `?.` devolvia `undefined` em cada um, a cadeia caía no `0`, o `0 > 0` era
 * falso e o valor de arranque era `null` — sempre, para todos os pedidos em
 * que o cliente não escrevesse um número.
 *
 * Resultado: a distribuição automática nunca corria. Não havia erro, não havia
 * linha no histórico, não havia nada. O pedido ficava no painel à espera de
 * alguém, e o profissional via "nenhum pedido novo".
 *
 * O TypeScript não apanhou nada disto porque a estimativa chega do corpo do
 * pedido como `any`. Um teste apanha — e é por isso que isto está aqui fora e
 * não lá dentro.
 */

/** Só os campos que interessam. O resto do objecto da estimativa não importa. */
export type EstimativaComPreco = {
  estimatedPriceWithVat?: number | null;
  estimatedPriceWithoutVat?: number | null;
  estimateMaxWithoutVat?: number | null;
  estimateMinWithoutVat?: number | null;
} | null | undefined;

function numeroUtil(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * O valor de partida, por ordem de preferência.
 *
 * Com IVA primeiro: é o número que o cliente viu no fim do simulador, e
 * começar a negociação noutro sítio qualquer seria começá-la a mentir-lhe.
 */
export function valorDeArranqueDaEstimativa(estimativa: EstimativaComPreco): number | null {
  if (!estimativa) return null;
  return (
    numeroUtil(estimativa.estimatedPriceWithVat) ??
    numeroUtil(estimativa.estimatedPriceWithoutVat) ??
    numeroUtil(estimativa.estimateMaxWithoutVat) ??
    numeroUtil(estimativa.estimateMinWithoutVat)
  );
}

/**
 * O valor de partida do pedido: o que o cliente escreveu, ou a estimativa.
 *
 * O do cliente manda. Ele escreveu um número a dizer o que conta gastar, e
 * substituí-lo pela nossa estimativa era ignorá-lo à frente dele.
 */
export function valorDeArranque(
  valorDoCliente: number | string | null | undefined,
  estimativa: EstimativaComPreco,
): number | null {
  return numeroUtil(valorDoCliente) ?? valorDeArranqueDaEstimativa(estimativa);
}
