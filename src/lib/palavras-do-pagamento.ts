/**
 * AS PALAVRAS DO BLOCO DE PAGAR, SEM O IVA — 02-11-2026.
 *
 * As frases de `frases-do-pagamento.ts` que não dependem da taxa do IVA. Vivem
 * aqui, sem importar nada, porque a app de cliente não importa regras de
 * preços, taxas nem IVA (`app-cliente.test.ts`): o rótulo do IVA chega-lhe
 * escrito pela API (`ivaRotulo`). O site continua a importar tudo de
 * `frases-do-pagamento.ts`, que reexporta estas.
 */

export const PRECO = "Preço";
export const SERVICO = "Serviço";
export const SEM_IVA = "(sem IVA)";
export const TOTAL_A_PAGAR = "Total a pagar";
export const COMO_PAGA = "Como paga";
export const MB_WAY = "MB WAY";
export const REFERENCIA_MULTIBANCO = "Referência Multibanco";
export const O_VALOR_FICA_COM_A_CLYON =
  "O valor fica com a CLYON e só chega ao parceiro depois de confirmar que o trabalho está feito.";

/** «140,00 €» — o formato dos valores no bloco de pagar. */
export const emEurosNoPagamento = (v: number) =>
  `${v.toFixed(2).replace(".", ",")} €`;

/** «Pagar 140,00 €» — o botão. */
export const pagarOValor = (v: number) => `Pagar ${emEurosNoPagamento(v)}`;

/** «Recolha de móveis · Fred Teste» — o serviço e o parceiro numa linha. */
export const servicoEParceiro = (servico: string | null | undefined, parceiro: string | null | undefined) =>
  [servico, parceiro].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
