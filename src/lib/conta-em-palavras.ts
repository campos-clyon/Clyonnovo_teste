import { contaDoCliente, TAXA_IVA, type Taxas } from "@/lib/taxas-plataforma";
import { euros } from "@/lib/texto-da-mesa";
import type { FormaDePagamento } from "@/lib/forma-de-pagamento";
import { precoComBase, type BaseDoPreco } from "@/lib/base-do-preco";

/** «23 %», escrito uma vez a partir da constante. */
const POR_CENTO = `${Math.round(TAXA_IVA * 100)} %`;

/**
 * O QUE O CLIENTE PAGA — SEM IVA, QUE É COMO SE APRESENTAM OS VALORES.
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
 *
 * Saía «Com o IVA e a taxa CLYON, fica em 318,45 €» — um número que junta
 * três coisas e não diz qual é a dele. Um cliente que não queria factura leu
 * isso, não percebeu, e pagou ao profissional os 280 € dele sem os 14 € da
 * nossa taxa. A conta estava certa e a mensagem perdeu-nos o dinheiro.
 *
 * Agora há UM número — serviço mais taxa, sem imposto — e uma linha a dizer o
 * que acresce com factura. É a convenção de toda a gente neste mercado, e é a
 * única que o cliente consegue repetir em voz alta.
 *
 * ⚠️ E ESSE NÚMERO JÁ FOI DITO QUANDO ESTA FRASE CHEGA — 29-09-2026.
 *
 * "Invés de cobrar 5 % do cliente depois, vamos apresentar o valor proposto já
 * com a taxa." A frase dizia «Com a taxa CLYON, fica em 367,50 € sem IVA»
 * depois de «Fulano propõe 350 €»: dois números, e a taxa a ser somada à frente
 * dele. Agora quem chama diz o preço dele primeiro — «Fulano propõe 367,50 €»,
 * ver `preco-do-cliente.ts` — e aqui fica só o que ele ainda não sabe: que é
 * sem IVA, e quanto fica com factura. Em dinheiro, quanto vai para cada lado.
 *
 * `valor` continua a ser o do PROFISSIONAL: é dele que a conta parte.
 */
export function totalEmPalavras(
  valor: number,
  regimeIva: string | null,
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
  const factura = comFacturaEmPalavras(valor, regimeIva, taxas, base);
  /*
   * EM DINHEIRO SÃO DUAS ENTREGAS, e a frase tem de as separar — 21-09-2026.
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
 * A LINHA DA FACTURA — a única frase que fala de imposto, e só uma vez.
 *
 * UMA FRASE SÓ, desde 22-09-2026. Havia duas, porque o imposto dependia do
 * regime do profissional: a quem contratasse um isento pelo artigo 53.º
 * acrescia apenas o IVA da nossa taxa, poucos euros, e dizer-lhe «23 %» seria
 * anunciar um imposto que ninguém entregaria ao Estado.
 *
 * Agora quem factura é uma empresa parceira, o imposto é o dela, e é 23 % sobre tudo. Duas
 * frases para uma regra só seriam duas maneiras de o cliente desconfiar.
 *
 * O total com factura vai ao lado, para a frase não deixar uma conta por
 * fazer a quem a lê no telemóvel.
 */
export function comFacturaEmPalavras(
  valor: number,
  regimeIva: string | null,
  taxas?: Taxas,
  base: BaseDoPreco = "total",
): string {
  const conta = contaDoCliente(valor, taxas);
  if (conta.iva <= 0) return "";
  return `Com factura acrescem ${POR_CENTO} de IVA: ${precoComBase(euros(conta.total), base)}.`;
}
