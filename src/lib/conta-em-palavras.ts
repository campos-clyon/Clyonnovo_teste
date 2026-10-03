import { contaDoCliente, TAXA_IVA, type Taxas } from "@/lib/taxas-plataforma";
import { euros } from "@/lib/texto-da-mesa";
import type { FormaDePagamento } from "@/lib/forma-de-pagamento";
import { precoComBase, type BaseDoPreco } from "@/lib/base-do-preco";
import type { ModeloDoPreco } from "@/lib/iva-incluido";
import { desdobramentoDoIva } from "@/lib/preco-do-cliente";

/** «23 %», escrito uma vez a partir da constante. */
const POR_CENTO = `${Math.round(TAXA_IVA * 100)} %`;

/**
 * O QUE O CLIENTE PAGA, DITO EM PALAVRAS — a frase que vem depois do preço.
 *
 * ── DESDE 01-10-2026, COM IVA INCLUÍDO ────────────────────────────────────
 *
 * "Preços com IVA incluído: o cliente vê um número só por proposta, já com a
 *  taxa da CLYON e com 23 % de IVA." — decisão do dono.
 *
 * Quem chama já disse o preço (`precoParaOCliente`, com o imposto lá dentro);
 * aqui fica só o que ele ainda não sabe: que o IVA está incluído e, em
 * dinheiro, a quem o entrega. Não há linha «com factura acrescem» — há factura
 * em todas as vendas, e nada acresce.
 *
 * ── ANTES DO CORTE (`IVA_INCLUIDO_DESDE`), O DE SEMPRE ────────────────────
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026. As negociações
 * abertas antes do corte continuam a ler isto até ao fim: o preço sem IVA,
 * e uma linha a dizer quanto fica com factura. Em dinheiro, quanto vai para
 * cada lado.
 *
 * O SEGUNDO PARÂMETRO ERA O REGIME DE IVA DO PROFISSIONAL, que não entrava em
 * conta nenhuma desde 22-09-2026. Passou a ser o modelo — obrigatório, e de
 * outro tipo, para o compilador apontar cada chamada que ainda passava o
 * regime.
 *
 * `valor` continua a ser o do PROFISSIONAL: é dele que a conta parte.
 */
export function totalEmPalavras(
  valor: number,
  modelo: ModeloDoPreco,
  /*
   * As taxas DESTA negociação. Sem elas, as de origem — que é o certo para
   * uma conversa que ainda não tem negociação nenhuma por trás.
   */
  taxas?: Taxas,
  /** Como o cliente paga. Em dinheiro, a frase diz quanto vai em notas. */
  forma: FormaDePagamento = "na_plataforma",
  /**
   * Pelo trabalho todo, ou por carga. Por carga, cada número leva a unidade
   * agarrada — «315,00 € por carga» — em vez de um total que não o é.
   */
  base: BaseDoPreco = "total",
): string {
  const conta = contaDoCliente(valor, taxas);

  if (modelo === "iva_incluido") {
    /*
     * EM DINHEIRO, UMA ENTREGA SÓ — 01-10-2026. O cliente dá o preço inteiro
     * ao profissional, e a parte da CLYON (o IVA e a comissão) é o
     * profissional que lha paga depois. Ao cliente não se fala de referência
     * nenhuma: não tem nada a pagar à parte. E o número não se repete — quem
     * chama acabou de o dizer.
     */
    const valorDito = base === "carga" ? "Valor por carga, com IVA incluído" : "Valor com IVA incluído";
    /*
     * E DE QUE É FEITO — 03-10-2026. *«Quero que mostre o valor sem IVA e o
     * valor com IVA, para o cliente saber o que está pagando.»* O número que
     * se paga é o que quem chama acabou de dizer; aqui vai o sem IVA e o
     * imposto que o fazem. Ver `desdobramentoDoIva`.
     */
    const deQue = desdobramentoDoIva(conta);
    return forma === "dinheiro"
      ? `${valorDito}, pago em dinheiro ao profissional, no local: ${deQue}. Não há mais nada a pagar à parte.`
      : `${valorDito} — ${deQue}.`;
  }

  const factura = comFacturaEmPalavras(valor, modelo, taxas, base);
  /*
   * EM DINHEIRO SÃO DUAS ENTREGAS (antes do corte), e a frase tem de as
   * separar — 21-09-2026.
   *
   * «Fica em 133,20 € sem IVA» a quem vai dar 120 € em notas ao profissional
   * e pagar 13,20 € à CLYON por referência é um número que ele não consegue
   * repetir em voz alta, e é assim que se perde a taxa.
   */
  if (forma === "dinheiro") {
    return (
      /*
       * EM DINHEIRO A FACTURA É SÓ DA TAXA — e é por isso que esta frase
       * escapa à regra dos 23 % sobre tudo.
       *
       * O serviço foi pago em notas ao profissional e nunca passou pela
       * CLYON: ela não o pode facturar. O que factura é o que cobra.
       */
      `Paga ${precoComBase(euros(conta.servico), base)} em dinheiro ao profissional, no local` +
      `, e ${euros(conta.taxa)} de taxa à CLYON${base === "carga" ? " por cada carga," : ""} por referência` +
      `${conta.ivaDaTaxa > 0 ? ` (${euros(conta.taxa + conta.ivaDaTaxa)} com factura)` : ""}.`
    );
  }
  // Por carga, a unidade vai também aqui: o preço dito antes já a levou, e a
  // factura de baixo leva-a com o número dela.
  return `${base === "carga" ? "Valor por carga, sem IVA." : "Valor sem IVA."}${factura ? ` ${factura}` : ""}`;
}

/**
 * A LINHA DA FACTURA — só existe ANTES do IVA incluído.
 *
 * UMA FRASE SÓ, desde 22-09-2026: quem factura é uma empresa parceira, o
 * imposto é o dela, e é 23 % sobre tudo. O total com factura vai ao lado,
 * para a frase não deixar uma conta por fazer a quem a lê no telemóvel.
 *
 * Com IVA incluído (desde `IVA_INCLUIDO_DESDE`) devolve vazio: o número que se
 * disse já leva o imposto, e há factura em todas as vendas — dizer «com
 * factura acrescem 23 %» seria anunciar um segundo preço que não existe.
 */
export function comFacturaEmPalavras(
  valor: number,
  modelo: ModeloDoPreco,
  taxas?: Taxas,
  base: BaseDoPreco = "total",
): string {
  if (modelo === "iva_incluido") return "";
  const conta = contaDoCliente(valor, taxas);
  if (conta.iva <= 0) return "";
  return `Com factura acrescem ${POR_CENTO} de IVA: ${precoComBase(euros(conta.total), base)}.`;
}
