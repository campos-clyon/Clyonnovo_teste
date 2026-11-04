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

/**
 * A LINHA À PARTE DA DÍVIDA DE UM PAGO EM MÃO — o começo do seu `trid`.
 *
 * A negociação já está fechada pelo registo `ao_profissional` (o índice único
 * `negociacaoPaga`), por isso o que o profissional deve vive noutra linha de
 * `pagamentos`, com `negociacaoPaga` nula e este `trid`, cujo índice único
 * impede a mesma dívida de se fechar duas vezes — abatida no saldo, paga por
 * ele à mão, quitada no acerto de 01-11-2026 ou, desde 04-11-2026 (d9), paga
 * pela referência do euPago. Vive aqui, num ficheiro sem base, para as
 * Finanças o poderem ler; `pagamentos-na-base.ts` reexporta-o.
 */
export const PREFIXO_DO_ABATIMENTO_A_PARTE = "abatimento-mao-";

/** O `trid` que impede a mesma taxa de ser abatida duas vezes (`uq_trid`). */
export function tridDoAbatimentoAParte(negociacaoId: number): string {
  return `${PREFIXO_DO_ABATIMENTO_A_PARTE}${negociacaoId}`;
}

/** Esta linha de `pagamentos` é a que fecha a dívida de um pago em mão? */
export function eLinhaDaDividaEmMao(trid: unknown): boolean {
  return typeof trid === "string" && trid.startsWith(PREFIXO_DO_ABATIMENTO_A_PARTE);
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

/** Uma linha de `pagamentos`, como a cobrança da dívida a lê. */
export type LinhaParaADivida = {
  estado: string;
  metodo: string;
  parte?: unknown;
  trid?: string | null;
  valor: number;
  valorPago?: number | null;
};

/**
 * A DÍVIDA QUE SE COBRA POR REFERÊNCIA — 04-11-2026 (d9, dono).
 *
 * *«A dívida (o IVA mais a taxa) passa a aparecer na Carteira do parceiro, em
 * "Pagamentos em dinheiro", com "Pagar por MB WAY" / "Gerar referência
 * Multibanco", tal como nos trabalhos combinados em dinheiro.»*
 *
 * Dois casos, e a mesma porta (`gerarReferenciaDaDivida`):
 *
 *   · COMBINADO EM DINHEIRO (IVA incluído) — a dívida de sempre
 *     (`dividaDoProfissional`). As referências dela são as da negociação
 *     (parte «trabalho»), e paga é qualquer linha paga;
 *   · NA PLATAFORMA, REGISTADO «PAGO AO PROFISSIONAL» — a conta do registo
 *     (`dividaDoRegistoEmMao`), com o valor que ficou registado. A negociação
 *     já está paga pelo registo: as referências desta dívida são a parte
 *     «divida», e paga é a linha à parte (`tridDoAbatimentoAParte`), seja qual
 *     for o caminho por que se fechou.
 *
 * Nula quando o trabalho não tem nada a pagar pelo profissional.
 */
export type DividaACobrar = {
  caso: "dinheiro" | "em_mao";
  divida: DividaDoRegistoEmMao;
  /** A `parte` das linhas de `pagamentos` desta dívida. */
  parte: "trabalho" | "divida";
  jaPaga: boolean;
};

export function dividaACobrar(
  t: {
    negociacaoId: number;
    formaDePagamento: unknown;
    /** A do dinheiro com IVA incluído, já perguntada (`temDividaDoProfissional`). */
    dividaEmDinheiro: DividaDoRegistoEmMao | null;
    acordado: number;
    taxas: Taxas;
  },
  linhas: ReadonlyArray<LinhaParaADivida>,
): DividaACobrar | null {
  const registo = linhas.find(
    (l) => l.estado === "pago" && pagoAoProfissionalRegistado(t.formaDePagamento, l.metodo),
  );
  if (registo) {
    const valor = registo.valorPago != null && registo.valorPago > 0 ? registo.valorPago : registo.valor;
    const divida = dividaDoRegistoEmMao(t.acordado, t.taxas, valor);
    if (!(divida.total > 0)) return null;
    const trid = tridDoAbatimentoAParte(t.negociacaoId);
    return {
      caso: "em_mao",
      divida,
      parte: "divida",
      jaPaga: linhas.some((l) => l.estado === "pago" && l.trid === trid),
    };
  }
  if (!t.dividaEmDinheiro) return null;
  return {
    caso: "dinheiro",
    divida: t.dividaEmDinheiro,
    parte: "trabalho",
    jaPaga: linhas.some((l) => l.estado === "pago"),
  };
}
