import { lerForma } from "./forma-de-pagamento";
import { comissaoDaClyon, quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";

/**
 * PAGO EM MÃO — A REGRA ÚNICA. 01-11-2026 (urgência, com o ok do dono).
 *
 * *«Quando o cliente paga ao profissional em dinheiro, em mão, o trabalho NÃO
 * entra em "Por receber". Na carteira aparece como "Recebido em mão". A taxa
 * da CLYON fica como valor que o profissional deve à CLYON, e a CLYON
 * desconta-a do que ele tiver a receber noutros trabalhos.»* — dono.
 *
 * Um trabalho foi pago em mão por DOIS caminhos, e só um era lido por todos:
 *
 *   · combinado em dinheiro desde o início (`formaDePagamento = 'dinheiro'`);
 *   · combinado pela plataforma, mas a CLYON registou nos Pagamentos que o
 *     cliente pagou AO PROFISSIONAL (linha de `pagamentos` com o método
 *     `ao_profissional`, 24-09-2026).
 *
 * Os Pagamentos liam os dois (`pagouAoProfissional`); a carteira — painel,
 * app Pro, Carteiras, levantamento — só lia o primeiro. Para ela, o registo
 * «pago ao profissional» era um pagamento do cliente à CLYON como outro
 * qualquer, e o trabalho ficava «Por receber — pode pedir a transferência»:
 * a CLYON pagava duas vezes. Esta função é a pergunta, uma só, para todos.
 */
export const METODO_PAGO_AO_PROFISSIONAL = "ao_profissional";

/** O cliente pagou o trabalho ao profissional, em mão — por qualquer dos dois caminhos? */
export function foiPagoEmMaoPor(forma: unknown, comoEntrou: unknown): boolean {
  return lerForma(forma as string | null) === "dinheiro" || pagoAoProfissionalRegistado(forma, comoEntrou);
}

/**
 * O SEGUNDO CAMINHO, À PARTE: combinado pela plataforma e registado à mão como
 * «pago ao profissional». É este que tem a dívida da taxa calculada aqui (o
 * do dinheiro tem a sua, em `divida-do-profissional.ts`).
 */
export function pagoAoProfissionalRegistado(forma: unknown, comoEntrou: unknown): boolean {
  return (
    lerForma(forma as string | null) !== "dinheiro" &&
    String(comoEntrou ?? "").trim() === METODO_PAGO_AO_PROFISSIONAL
  );
}

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type DividaDoRegistoEmMao = {
  /** O que ficou registado que o cliente lhe pagou. */
  recebidoDoCliente: number;
  /** O que fica com ele — o mesmo líquido de qualquer outra forma. */
  liquido: number;
  /** O IVA, quando o cliente lho pagou (com factura). 0 sem factura. */
  iva: number;
  /** A taxa da plataforma, sem IVA. */
  comissao: number;
  /** O que deve à CLYON: tudo o que recebeu acima do seu líquido. */
  total: number;
};

/**
 * O QUE ELE DEVE À CLYON NUM TRABALHO DA PLATAFORMA PAGO EM MÃO.
 *
 * A mesma conta do dinheiro (`dividaDoProfissional`): o que o cliente lhe deu
 * menos o líquido dele — porque é com o líquido que ele tem de ficar, como em
 * todos os ecrãs. Sem factura, o cliente pagou o valor sem IVA e a dívida é só
 * a taxa (70 € a 11 % → 7,70 €). Com factura e o IVA pago em mão, o IVA também
 * está com ele, e é da CLYON (a factura é dela).
 *
 * Sem o valor registado (linha antiga, ou zero), conta só a taxa: nunca se lhe
 * pede mais do que se sabe que ele recebeu.
 */
export function dividaDoRegistoEmMao(
  acordado: number,
  taxas: Taxas,
  valorQueEntrou: number | null | undefined,
): DividaDoRegistoEmMao {
  const liquido = quantoOProfissionalRecebe(acordado, taxas);
  const comissao = comissaoDaClyon(acordado, taxas);
  const recebido =
    valorQueEntrou != null && Number.isFinite(valorQueEntrou) && valorQueEntrou > 0
      ? aosCentimos(valorQueEntrou)
      : aosCentimos(liquido + comissao);
  const total = Math.max(comissao, aosCentimos(recebido - liquido));
  return {
    recebidoDoCliente: recebido,
    liquido,
    iva: Math.max(0, aosCentimos(total - comissao)),
    comissao,
    total,
  };
}
