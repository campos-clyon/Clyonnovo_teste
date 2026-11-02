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

export const IVA_DO_PAGAMENTO = `IVA (${IVA_EM_PERCENTAGEM})`;

/*
 * As que não dependem do IVA vivem em `palavras-do-pagamento.ts` (02-11-2026):
 * a app de cliente importa-as de lá, porque não importa regras de IVA.
 */
export {
  PRECO,
  SERVICO,
  SEM_IVA,
  TOTAL_A_PAGAR,
  COMO_PAGA,
  MB_WAY,
  REFERENCIA_MULTIBANCO,
  O_VALOR_FICA_COM_A_CLYON,
  emEurosNoPagamento,
  pagarOValor,
  servicoEParceiro,
  TRANSFERENCIA_BANCARIA,
  A_ESPERA_DA_TRANSFERENCIA,
  IBAN,
  TITULAR,
  DESCRITIVO,
  VOU_PAGAR_POR_TRANSFERENCIA,
  COMO_FAZER_A_TRANSFERENCIA,
  DEPOIS_DA_TRANSFERENCIA,
  OUTRO_METODO,
  valorDaTransferencia,
} from "./palavras-do-pagamento";
