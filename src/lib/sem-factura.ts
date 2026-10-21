import type { Taxas } from "./taxas-plataforma";
import { modeloDaNegociacao, type ModeloDoPreco } from "./iva-incluido";
import { lerParaQue, type ParaQue } from "./pagamento-declarado";

/**
 * SEM FACTURA — 21-10-2026.
 *
 * *«Nesse caso a cliente pagou 510 total sem fatura, temos que ter a opção de
 * sem fatura.»* E a regra, do dono: *«Uni o 5 % do cliente e o 6 % do pro,
 * fica 11 % para ser descontado do valor total que o cliente pagou nas
 * negociações.»*
 *
 * Numa negociação marcada sem factura:
 *   · o cliente paga o valor do trabalho, sem IVA e sem taxa por cima;
 *   · as duas taxas da CLYON juntam-se, e saem desse valor, do lado do
 *     profissional. No #375: 510 € pagos, 56,10 € da CLYON (11 %), 453,90 €
 *     ao profissional.
 *
 * GRAVA-SE NAS TAXAS DA NEGOCIAÇÃO — a do cliente a zero, a do profissional a
 * soma das duas, com as de antes guardadas para se poder voltar atrás
 * (`mudarAFacturaDaNegociacao`). Assim tudo o que conta o que o profissional
 * recebe — a carteira, a app, os Pagamentos, a comissão dos assistentes — dá
 * o número novo sem mudar nada. O IVA é o que se lê aqui: uma negociação sem
 * factura não leva IVA, seja de quando for (`modeloDaLinha`).
 *
 * Só nas negociações, fechadas, pagas pela plataforma, e antes de o dinheiro
 * entrar ou sair: um Trabalho CLYON tem a sua conta, e em dinheiro o
 * profissional já recebeu em mão.
 */

/** Esta negociação está marcada sem factura? */
export function eSemFactura(l: { semFactura?: unknown } | null | undefined): boolean {
  return Number(l?.semFactura) === 1;
}

/** As duas taxas juntas, do lado do profissional — a do cliente a zero. */
export function taxasSemFactura(t: Taxas): Taxas {
  return { cliente: 0, profissional: Math.round((t.cliente + t.profissional) * 10_000) / 10_000 };
}

/** O modelo do preço, contando com a marca: sem factura, sem IVA. */
export function modeloDaLinha(
  l: { semFactura?: unknown } | null | undefined,
  criadaEm: Date | string | null | undefined,
): ModeloDoPreco {
  return eSemFactura(l) ? "sem_iva" : modeloDaNegociacao(criadaEm);
}

/** «Para que foi o pagamento», contando com a marca: sem factura é sem factura. */
export function paraQueDaLinha(l: { semFactura?: unknown; pagamentoParaQue?: unknown } | null | undefined): ParaQue | null {
  return eSemFactura(l) ? "sem_factura" : lerParaQue(l?.pagamentoParaQue);
}
