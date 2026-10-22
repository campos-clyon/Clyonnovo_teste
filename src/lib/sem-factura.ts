import type { Taxas } from "./taxas-plataforma";
import { modeloDaNegociacao, type ModeloDoPreco } from "./iva-incluido";
import { lerParaQue, type ParaQue } from "./pagamento-declarado";

/**
 * SEM FACTURA — 21-10-2026, e a regra de 22-10-2026.
 *
 * *«Nesse caso a cliente pagou 510 total sem fatura, temos que ter a opção de
 * sem fatura.»* E, no dia seguinte, sobre o #469: *«O valor pago para o
 * profissional não devia mudar, porque ele deve usar como base o valor base
 * do serviço — nesse caso foi 282. Se o cliente deseja fatura, é esse valor
 * mais o IVA de 23 %. Para o profissional, não muda nada.»* E: *«O IVA nunca
 * vem para a CLYON — vai para o governo.»* — o dono.
 *
 * Numa negociação marcada sem factura SÓ SAI O IVA:
 *   · as taxas ficam como estão — 5 % do cliente, 6 % do profissional;
 *   · o cliente paga o valor sem IVA; o profissional e a CLYON recebem o
 *     mesmo que com factura. No #469: 282 € de trabalho → o cliente paga
 *     296,10 € sem factura (364,20 € com), a Revolution recebe 265,08 € e a
 *     CLYON fica com 31,02 €, das duas maneiras.
 *
 * A REGRA DE 21-10-2026, que durou um dia: as duas taxas juntavam-se (11 %) e
 * saíam do valor do trabalho, do lado do profissional — no #375, 510 € pagos,
 * 56,10 € da CLYON, 453,90 € ao profissional. Gravou-se nas taxas da
 * negociação (a do cliente a zero, a do profissional a soma), com as de
 * antes em `taxasComFacturaJson`. Uma negociação marcada assim continua a
 * dar esses números até alguém a acertar nos Pagamentos — e acertar é repor
 * as taxas de antes (`taxasDeAntes`), com ou sem factura
 * (`mudarAFacturaDaNegociacao`).
 *
 * O IVA é o que se lê aqui: uma negociação sem factura não leva IVA, seja de
 * quando for (`modeloDaLinha`). Só nas negociações fechadas e pagas pela
 * plataforma, antes de o pagamento do cliente estar registado: em dinheiro o
 * profissional já recebeu em mão.
 */

/** Esta negociação está marcada sem factura? */
export function eSemFactura(l: { semFactura?: unknown } | null | undefined): boolean {
  return Number(l?.semFactura) === 1;
}

/**
 * As taxas de antes de a marcarem sem factura com a regra de 21-10-2026, se
 * ficaram guardadas e não são as de agora — `null` quando não há o que repor.
 */
export function taxasDeAntes(guardadas: unknown, agora: Taxas): Taxas | null {
  let g: { cliente?: unknown; profissional?: unknown } | null;
  try {
    g = JSON.parse(String(guardadas ?? "")) as { cliente?: unknown; profissional?: unknown } | null;
  } catch {
    return null;
  }
  const cliente = Number(g?.cliente);
  const profissional = Number(g?.profissional);
  if (!Number.isFinite(cliente) || !Number.isFinite(profissional)) return null;
  if (cliente === agora.cliente && profissional === agora.profissional) return null;
  return { cliente, profissional };
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
