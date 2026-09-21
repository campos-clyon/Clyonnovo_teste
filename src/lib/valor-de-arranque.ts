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
 * e nenhum desses três campos existe. O objeto da estimativa chama-lhes
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

/** Só os campos que interessam. O resto do objeto da estimativa não importa. */
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
 * O valor de partida, por ordem de preferência. SEM IVA — sempre.
 *
 * "Nós sempre vamos mostrar o valor sem IVA; caso o cliente deseje factura
 * será mais 23 %." — 22-09-2026.
 *
 * Esta linha dizia o contrário, e dizia-o de propósito: escolhia o preço COM
 * IVA porque «é o número que o cliente viu no fim do simulador». Essa
 * justificação morreu a 18-09-2026, quando o ecrã de sucesso deixou de lhe
 * mostrar número nenhum — ver `sem-estimativa-para-o-cliente.test.ts`. O
 * motivo desapareceu e a linha ficou.
 *
 * O QUE ELA FAZIA. Este número acaba em `simulatorOrders.valorDesejadoCliente`
 * sempre que o cliente não escreve valor, que é o caso comum — o campo é
 * opcional. Daí sai o número grande do cartão do profissional, com a etiqueta
 * «já com a taxa, sem IVA» por baixo de um valor que tinha lá 23 % de imposto,
 * e sai a mesma promessa no email e na mensagem de WhatsApp que lhe chegam. Se
 * ele aceitasse, o imposto era cobrado OUTRA VEZ por cima: uma estimativa de
 * 300 € pedia 476,56 € ao cliente. A auditoria da casa já lhe chamava «IVA a
 * dobrar» — ver `docs/auditoria-2026-09-11.md`.
 *
 * Quem acrescenta os 23 % é o `contaDoCliente` em `taxas-plataforma.ts`, no
 * fim e por vendedor, porque um profissional na isenção do artigo 53.º nunca
 * poderia facturar imposto. Não é aqui, e não é multiplicando por 1,23.
 */
export function valorDeArranqueDaEstimativa(estimativa: EstimativaComPreco): number | null {
  if (!estimativa) return null;
  return (
    numeroUtil(estimativa.estimatedPriceWithoutVat) ??
    numeroUtil(estimativa.estimateMaxWithoutVat) ??
    numeroUtil(estimativa.estimateMinWithoutVat)
  );
}

/*
 * O `estimatedPriceWithVat` NÃO ficou como último recurso — saiu da lista.
 *
 * Seria tentador deixá-lo no fim, para o caso de não haver mais nada. Mas esse
 * ramo só correria quando o único número disponível é o que tem imposto lá
 * dentro, e usá-lo é reintroduzir em silêncio o defeito que esta função acabou
 * de perder. Sem preço sem IVA não há valor de partida: `null` é a resposta
 * verdadeira, e quem chama já a sabe tratar.
 *
 * Na prática o ramo nunca corria: `calculateFastEstimate` devolve sempre os
 * dois preços juntos (`pricing-helper.ts`), e a resposta do modelo é
 * normalizada da mesma maneira.
 */

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
