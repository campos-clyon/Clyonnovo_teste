/**
 * AS FRASES DO ECRÃ DE PAGAR — 02-11-2026 (ordem do CEO e do dono: «simples,
 * como a Vinted»).
 *
 * O bloco de pagar diz só isto: o serviço e o parceiro numa linha; o «Preço»
 * (o serviço sem IVA, o IVA e o total); o «Como paga» (MB WAY ou referência
 * Multibanco); o botão «Pagar X €»; e uma linha a dizer onde fica o dinheiro.
 *
 * O site (`PagarTrabalho.tsx`) e a app de cliente dizem estas frases à letra.
 * Vivem aqui, sem dependências de servidor, para a app as importar como
 * importa `frases-do-pedido.ts` (o IVA vem de `taxas-plataforma.ts`, que não
 * importa nada). Os números não se fazem aqui: chegam do
 * servidor (`estadoDoPagamentoParaOCliente`).
 */

import { TAXA_IVA } from "./taxas-plataforma";

const IVA_EM_PERCENTAGEM = `${Math.round(TAXA_IVA * 100)} %`;

export const PRECO = "Preço";
export const SERVICO = "Serviço";
export const SEM_IVA = "(sem IVA)";
export const IVA_DO_PAGAMENTO = `IVA (${IVA_EM_PERCENTAGEM})`;
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
