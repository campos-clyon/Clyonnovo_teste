import { contaDoCliente, regimeDeIva, TAXA_IVA, type Taxas } from "@/lib/taxas-plataforma";
import { euros } from "@/lib/texto-da-mesa";
import type { FormaDePagamento } from "@/lib/forma-de-pagamento";

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
 * NÃO SE TOCOU NA CONTA. `contaDoCliente` continua a calcular o imposto por
 * vendedor, por causa da isenção do artigo 53.º; o que mudou foi qual dos
 * números dela é que se diz primeiro.
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
): string {
  const conta = contaDoCliente(valor, regimeDeIva(regimeIva), taxas);
  const factura = comFacturaEmPalavras(valor, regimeIva, taxas);
  /*
   * EM DINHEIRO SÃO DUAS ENTREGAS, e a frase tem de as separar — 21-09-2026.
   *
   * «Fica em 133,20 € sem IVA» a quem vai dar 120 € em notas ao profissional
   * e pagar 13,20 € à CLYON por referência é um número que ele não consegue
   * repetir em voz alta, e é assim que se perde a taxa.
   */
  if (forma === "dinheiro") {
    return (
      `Paga ${euros(conta.servico)} em dinheiro ao profissional, no local` +
      `${conta.ivaDoServico > 0 ? ` (${euros(conta.servico + conta.ivaDoServico)} se pedir factura)` : ""}` +
      `, e ${euros(conta.taxa)} de taxa à CLYON por referência` +
      `${conta.ivaDaTaxa > 0 ? ` (${euros(conta.taxa + conta.ivaDaTaxa)} com factura)` : ""}.`
    );
  }
  return `Com a taxa CLYON, fica em ${euros(conta.semIva)} sem IVA.${factura ? ` ${factura}` : ""}`;
}

/**
 * A LINHA DA FACTURA — a única frase que fala de imposto, e só uma vez.
 *
 * Diz «23 %» a quem vai mesmo pagar 23 %, e não a toda a gente: o regime é do
 * profissional, e um isento pelo artigo 53.º não liquida nada sobre o serviço.
 * A quem o contrata, o que acresce com factura é só o imposto da nossa taxa —
 * poucos euros — e anunciar-lhe 23 % seria mostrar-lhe um imposto que ninguém
 * pode entregar ao Estado.
 *
 * Em ambos os casos vai o total com factura ao lado, para que a frase não
 * deixe uma conta por fazer a quem a lê no telemóvel.
 */
export function comFacturaEmPalavras(
  valor: number,
  regimeIva: string | null,
  taxas?: Taxas,
): string {
  const conta = contaDoCliente(valor, regimeDeIva(regimeIva), taxas);
  if (conta.iva <= 0) return "";
  return conta.ivaDoServico > 0
    ? `Com factura acrescem ${POR_CENTO} de IVA: ${euros(conta.total)}.`
    : `Com factura acrescem ${euros(conta.iva)} de IVA da taxa CLYON: ${euros(conta.total)}.`;
}
