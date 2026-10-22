import type { Taxas } from "./taxas-plataforma";
import { modeloDaNegociacao, type ModeloDoPreco } from "./iva-incluido";
import { lerParaQue, type ParaQue } from "./pagamento-declarado";

/**
 * SEM FACTURA — 21-10-2026, acertado a 22-10-2026.
 *
 * *«Nesse caso a cliente pagou 510 total sem fatura, temos que ter a opção de
 * sem fatura.»* E a regra, do dono: *«Uni o 5 % do cliente e o 6 % do pro,
 * fica 11 % para ser descontado do valor total que o cliente pagou nas
 * negociações.»*
 *
 * No dia seguinte, sobre o #469: *«O valor é 282 sem fatura: 282 − 11 % =
 * 250,98 para o pro e 31,02 para a CLYON. Se fosse com fatura o cliente
 * pagava 346,86, porém os valores para a CLYON e o pro não mudam. Os 23 % não
 * pertencem à CLYON.»* — o dono.
 *
 * Portanto:
 *   · marcar sem factura junta as duas taxas (11 %) e tira-as do valor do
 *     trabalho, do lado do profissional — o cliente paga o valor, sem IVA.
 *     No #375: 510 € pagos, 56,10 € da CLYON, 453,90 € ao profissional;
 *   · daí em diante, com ou sem factura SÓ MUDA O IVA: com factura o
 *     cliente paga o valor mais 23 %, que vão para o Estado; o profissional e
 *     a CLYON recebem o mesmo. No #469: 282 € sem factura, 346,86 € com — a
 *     Revolution recebe 250,98 € e a CLYON 31,02 €, das duas maneiras.
 *     «Com factura» já não repõe os 5 % + 6 % (isso foi até 22-10-2026, e
 *     mudava o que o profissional recebia).
 *
 * GRAVA-SE NAS TAXAS DA NEGOCIAÇÃO — a do cliente a zero, a do profissional a
 * soma das duas; as de antes ficam em `taxasComFacturaJson`, só para a
 * história. Assim tudo o que conta o que o profissional recebe — a carteira,
 * a app, os Pagamentos, a comissão dos assistentes — dá o número certo sem
 * mudar nada. O IVA é o que se lê aqui: uma negociação sem factura não leva
 * IVA, seja de quando for (`modeloDaLinha`).
 *
 * Só nas negociações fechadas e pagas pela plataforma, antes de o pagamento
 * do cliente estar registado: em dinheiro o profissional já recebeu em mão.
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
