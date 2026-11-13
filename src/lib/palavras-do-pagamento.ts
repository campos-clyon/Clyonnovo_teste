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
/** Só nos trabalhos pagos à CLYON (antes de 15-11-2026, e os Trabalhos CLYON) — d10. */
const O_VALOR_FICA_COM_A_CLYON_NO_MODELO_ANTIGO =
  "O valor fica com a CLYON e só chega ao parceiro depois de confirmar que o trabalho está feito.";
export const O_VALOR_FICA_COM_A_CLYON = O_VALOR_FICA_COM_A_CLYON_NO_MODELO_ANTIGO;

/** «140,00 €» — o formato dos valores no bloco de pagar. */
export const emEurosNoPagamento = (v: number) =>
  `${v.toFixed(2).replace(".", ",")} €`;

/** «Pagar 140,00 €» — o botão. */
export const pagarOValor = (v: number) => `Pagar ${emEurosNoPagamento(v)}`;

/** «Recolha de móveis · Fred Teste» — o serviço e o parceiro numa linha. */
export const servicoEParceiro = (servico: string | null | undefined, parceiro: string | null | undefined) =>
  [servico, parceiro].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");

/*
 * TRANSFERÊNCIA BANCÁRIA — 02-11-2026 (dono): só a partir de 700 € com IVA e
 * com a conta escrita nas Configs. O IBAN, o titular e os valores chegam do
 * servidor (`transferencia` no estado do pagamento); aqui só as palavras.
 */
export const TRANSFERENCIA_BANCARIA = "Transferência bancária";
export const A_ESPERA_DA_TRANSFERENCIA = "À espera da transferência";
export const IBAN = "IBAN";
export const TITULAR = "Titular";
export const DESCRITIVO = "Descritivo";
export const VOU_PAGAR_POR_TRANSFERENCIA = "Vou pagar por transferência";
export const COMO_FAZER_A_TRANSFERENCIA =
  "Faça a transferência do total com IVA e escreva o descritivo tal como está, para a equipa reconhecer o seu pedido.";
export const DEPOIS_DA_TRANSFERENCIA =
  "Quando a transferência entrar na conta, a equipa confirma-a e esta página passa a «Pagamento recebido»; o parceiro é avisado na mesma altura e só começa depois disso. Pode levar um a dois dias úteis.";
export const OUTRO_METODO = "Pagar por MB WAY ou Multibanco";

/** «861,00 € com IVA (700,00 € sem IVA)» — o com IVA, com o sem IVA ao lado. */
export const valorDaTransferencia = (comIva: number, semIva: number) =>
  `${emEurosNoPagamento(comIva)} com IVA (${emEurosNoPagamento(semIva)} sem IVA)`;

/*
 * O PAGAMENTO VEM A CAMINHO, POR TRANSFERÊNCIA — 07-11-2026 (d13). O que o
 * profissional lê, no painel e na app CLYON Pro, quando o cliente escolheu a
 * transferência e ela ainda não foi dada por recebida (`pagamentoACaminho:
 * "transferencia"` no meus-pedidos). Uma só frase para os dois ecrãs: o painel
 * põe o `titulo` a negrito; a app mostra a `inteira`.
 */
export const O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA = {
  titulo: "O pagamento vem a caminho, por transferência bancária.",
  texto: "Não comece o trabalho antes de a CLYON confirmar que recebeu — avisamos assim que entrar.",
  inteira:
    "O pagamento vem a caminho, por transferência bancária. Não comece o trabalho antes de a CLYON confirmar que recebeu — avisamos assim que entrar.",
} as const;
