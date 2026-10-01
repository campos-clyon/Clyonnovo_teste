import { quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import { precoDoCliente } from "./preco-do-cliente";
import type { ModeloDoPreco } from "./iva-incluido";
import { lerForma } from "./forma-de-pagamento";

/**
 * O QUE O PROFISSIONAL DEVE À CLYON QUANDO O CLIENTE LHE PAGA EM DINHEIRO —
 * 01-10-2026.
 *
 * "PAGAMENTO EM DINHEIRO: o cliente paga ao profissional, no local, o preço COM
 *  IVA (ex. 452,03 €); o profissional fica a DEVER à CLYON o IVA + a comissão
 *  (ex. 84,53 + 40,43 = 124,96 €) e paga essa dívida por REFERÊNCIA MB
 *  WAY/Multibanco, gerada quando o trabalho em dinheiro é confirmado." —
 *  decisão do dono.
 *
 * Substitui, para as negociações abertas a partir de `IVA_INCLUIDO_DESDE`, o
 * modelo de 21-09-2026 em que era o CLIENTE a pagar a comissão à CLYON por
 * referência. Antes do corte nada muda: não há dívida nenhuma do profissional.
 *
 * ⚠️ O CÊNTIMO DO EXEMPLO. O dono escreveu 124,96 € — 84,53 € de IVA mais
 * 40,43 €, que são 11 % de 367,50 € arredondados para cima. A comissão que o
 * sistema sempre usou é a diferença entre o que o cliente paga sem IVA e o que
 * o profissional recebe (`comissaoDaClyon`): 367,50 − 327,08 = 40,42 €. A
 * dívida é por isso o que o cliente pagou MENOS o líquido do profissional —
 * 452,03 − 327,08 = 124,95 € — e é ESSA a conta certa por uma razão só: o
 * profissional lê sempre o seu líquido (327,08 €) em todos os ecrãs, e é com
 * isso que tem de ficar ao fim. Com 124,96 € ficava com 327,07 €. O meio
 * cêntimo de 350 × 6,55 % = 22,925 € não pode ir parar aos dois lados.
 */

export type DividaDoProfissional = {
  /** O que o cliente lhe deu em notas: o preço com IVA. */
  recebidoDoCliente: number;
  /** O que fica com ele — o mesmo líquido de qualquer outra forma. */
  liquido: number;
  /** O IVA da venda, que a CLYON entrega ao Estado pela factura. */
  iva: number;
  /** A comissão da CLYON: o que fica dela, sem IVA. */
  comissao: number;
  /** O que ele paga à CLYON por referência: `iva + comissao`. */
  total: number;
};

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * HÁ DÍVIDA NESTE TRABALHO? Só em dinheiro e só com IVA incluído.
 *
 * Recebe a forma crua da base: nula, vazia ou lixo lêem-se como «na
 * plataforma», que não tem dívida nenhuma.
 */
export function temDividaDoProfissional(forma: unknown, modelo: ModeloDoPreco): boolean {
  return lerForma(forma) === "dinheiro" && modelo === "iva_incluido";
}

/**
 * A conta da dívida. Pura: não sabe se o trabalho já foi feito nem se a dívida
 * já foi paga — isso é a carteira (`carteira.ts`) e a tabela dos pagamentos.
 */
export function dividaDoProfissional(acordado: number, taxas: Taxas): DividaDoProfissional {
  const preco = precoDoCliente(acordado, taxas, "iva_incluido");
  const liquido = quantoOProfissionalRecebe(acordado, taxas);
  const total = aosCentimos(preco.total - liquido);
  const iva = preco.iva;
  return {
    recebidoDoCliente: preco.total,
    liquido,
    iva,
    comissao: aosCentimos(total - iva),
    total,
  };
}

/**
 * QUANTO PASSA DE MÃO EM MÃO, EM NOTAS — para o tecto legal ao numerário
 * (`excedeONumerario`).
 *
 * Antes do IVA incluído o cliente dava ao profissional o valor acordado (a
 * taxa ia à parte, por referência). Depois, dá-lhe o preço inteiro com IVA.
 */
export function valorEmNumerario(
  acordado: number,
  taxas: Taxas,
  modelo: ModeloDoPreco,
): number {
  return modelo === "iva_incluido" ? precoDoCliente(acordado, taxas, modelo).total : acordado;
}
