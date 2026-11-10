/*
 * O QUE O ORÇAMENTO DIZ POR PALAVRAS — no email e na página /orcamento/<token>.
 *
 * NA VOZ DE PLATAFORMA — 10-11-2026 (d28). Eram os últimos textos do
 * orçamento a falar como empresa: os serviços por baixo do nome, como numa
 * carrinha, e uma abertura em que era a CLYON a analisar o pedido e a preparar
 * o orçamento, com «a sua reserva». Quem faz o trabalho é o parceiro; a CLYON
 * organiza o pedido, guarda o acordo e acompanha o pagamento.
 *
 * Um ficheiro só, sem imports, para o email (servidor) e a página dizerem o
 * mesmo — e para o teste da orquestra as ler.
 */

/** Quem faz e o que a CLYON faz — a mesma frase no email e na página. */
const QUEM_FAZ_E_QUEM_ORGANIZA =
  "O seu pedido já tem orçamento. Quem faz o trabalho é um parceiro da sua zona; a CLYON " +
  "organiza o pedido, guarda o acordo por escrito e acompanha o pagamento.";

export const TEXTOS_DO_EMAIL_DO_ORCAMENTO = {
  titulo: "O orçamento do seu pedido",
  porBaixoDoNome: "A plataforma que liga o seu pedido a parceiros da sua zona",
  abertura: `${QUEM_FAZ_E_QUEM_ORGANIZA} Veja os detalhes abaixo e confirme ou cancele o pedido.`,
  naPagina: `${QUEM_FAZ_E_QUEM_ORGANIZA} Confirme para avançar ou cancele se mudou de ideias.`,
} as const;
