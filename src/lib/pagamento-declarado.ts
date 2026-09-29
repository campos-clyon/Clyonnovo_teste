/**
 * O que ficou dito sobre o pagamento no momento em que o trabalho se deu por
 * feito — 29-09-2026.
 *
 * «Aqui aparece "Está feito — libertar o pagamento", vamos deixar apenas "Está
 * feito" e depois vamos perguntar para que foi feito o pagamento e como o
 * cliente pagou; essas informações devem ir para os registos para confirmar
 * depois nos pagamentos.»
 *
 * O BOTÃO MISTURAVA DUAS COISAS que acontecem em sítios diferentes. «Está
 * feito» é um facto sobre o trabalho, e sabe-se ao telefone com o cliente.
 * «O dinheiro entrou» é um facto sobre a conta da CLYON, e só se sabe a olhar
 * para o banco. Um só clique para as duas punha quem está ao telefone a
 * afirmar uma coisa que não pode ver.
 *
 * POR ISSO ISTO É UMA DECLARAÇÃO, E NÃO UM RECEBIMENTO. Fica escrito o que o
 * cliente disse — com ou sem factura, e por onde pagou — e quem o escreveu. Não
 * desbloqueia dinheiro nenhum: esse passo continua a ser o «Já recebemos» dos
 * Pagamentos, que agora aparece com a declaração à frente e o valor certo.
 *
 * Puro e sem base de dados: as listas fechadas e a conta provam-se sozinhas.
 */

/**
 * PARA QUE FOI O PAGAMENTO.
 *
 * São os dois números que a caixa de confirmar já mostra: o trabalho mais a
 * taxa, e o mesmo com o IVA de quem pediu factura. Perguntar qual deles o
 * cliente pagou é o que faz o recebimento ficar gravado com o valor que entrou
 * de facto — antes gravava-se sempre o total com IVA, mesmo a quem não pediu
 * factura nenhuma.
 */
export type ParaQue = "sem_factura" | "com_factura";

export const PARA_QUE: ReadonlyArray<{ id: ParaQue; rotulo: string; ajuda: string }> = [
  { id: "sem_factura", rotulo: "Sem factura", ajuda: "O trabalho mais a taxa CLYON" },
  { id: "com_factura", rotulo: "Com factura", ajuda: "O mesmo, mais o IVA de 23 %" },
];

/**
 * COMO É QUE O CLIENTE PAGOU.
 *
 * As três formas que uma pessoa regista à mão nos Pagamentos — a mesma lista,
 * para a declaração e o recebimento não poderem discordar — e uma quarta que
 * só faz sentido aqui: o trabalho pode estar feito e o dinheiro ainda não.
 * Dizê-lo também é uma resposta, e é a que põe o trabalho na lista de quem se
 * tem de ir cobrar.
 *
 * MB WAY e Multibanco não estão: entram pelo euPago, que os marca sozinho.
 */
export type ComoPagou = "transferencia" | "numerario" | "ao_profissional" | "ainda_nao";

export const COMO_PAGOU: ReadonlyArray<{ id: ComoPagou; rotulo: string; ajuda: string }> = [
  { id: "transferencia", rotulo: "Transferência", ajuda: "Para a conta da CLYON" },
  { id: "numerario", rotulo: "Numerário", ajuda: "Dinheiro entregue à CLYON" },
  { id: "ao_profissional", rotulo: "Pagou ao profissional", ajuda: "Em mão, no local" },
  { id: "ainda_nao", rotulo: "Ainda não pagou", ajuda: "Fica por cobrar" },
];

export function lerParaQue(v: unknown): ParaQue | null {
  return PARA_QUE.some((p) => p.id === v) ? (v as ParaQue) : null;
}

export function lerComoPagou(v: unknown): ComoPagou | null {
  return COMO_PAGOU.some((c) => c.id === v) ? (v as ComoPagou) : null;
}

/**
 * O valor que corresponde à resposta.
 *
 * Sem declaração fica o total com IVA, que é o que sempre se gravou — um
 * trabalho confirmado antes de haver esta pergunta lê-se como era.
 */
export function valorDoPagamento(
  conta: { semIva: number; total: number },
  paraQue: ParaQue | null,
): number {
  return paraQue === "sem_factura" ? conta.semIva : conta.total;
}

/**
 * O método a gravar no recebimento, quando se confirmar que entrou.
 *
 * «Ainda não pagou» não é método de nada — não há recebimento para gravar.
 */
export function metodoDoRecebimento(como: ComoPagou | null): Exclude<ComoPagou, "ainda_nao"> | null {
  return como && como !== "ainda_nao" ? como : null;
}

function rotuloDe<T extends string>(lista: ReadonlyArray<{ id: T; rotulo: string }>, id: T): string {
  return lista.find((x) => x.id === id)?.rotulo ?? id;
}

const EUROS = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/**
 * A frase que vai para o histórico do pedido e para o registo permanente.
 *
 * «Com factura, 348,71 € — Transferência.» Escrita por inteiro, com o valor,
 * porque é lida daqui a meses por quem não viu o ecrã: um código como
 * `com_factura/transferencia` obrigava a saber a conta de cabeça.
 */
export function fraseDaDeclaracao(paraQue: ParaQue, como: ComoPagou, valor: number | null): string {
  // Sem valor acordado não se inventa um número: diz-se só com ou sem factura.
  const para = valor != null ? `${rotuloDe(PARA_QUE, paraQue)}, ${EUROS(valor)}` : rotuloDe(PARA_QUE, paraQue);
  return como === "ainda_nao"
    ? `${para} — o cliente ainda não pagou.`
    : `${para} — ${rotuloDe(COMO_PAGOU, como)}.`;
}

/** O nome curto de cada forma, para os Pagamentos. */
export function nomeDeComoPagou(como: ComoPagou): string {
  return rotuloDe(COMO_PAGOU, como);
}

/** O nome curto de cada «para quê», para os Pagamentos. */
export function nomeDeParaQue(paraQue: ParaQue): string {
  return rotuloDe(PARA_QUE, paraQue);
}
