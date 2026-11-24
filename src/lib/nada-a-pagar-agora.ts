import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";

/**
 * NADA A PAGAR AGORA — d100 (CEO e dono, 23-11-2026). Logo a seguir ao aviso
 * de que o trabalho é seu, um parceiro perguntou «qual entidade e referência
 * para o pagamento». No modelo de 15-11 não há nada a pagar nesse momento: o
 * cliente paga-lhe a ele, e a referência da taxa da plataforma e do IVA dela
 * nasce quando o trabalho fica confirmado (`avisar-confirmacao.ts`: fica na
 * carteira do painel e vai no email), com o prazo de
 * `DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO` dias. Só nos trabalhos do modelo de 15-11.
 */
export const NADA_A_PAGAR_AGORA_NO_NOVO_MODELO =
  "Não tem nada a pagar agora: o cliente paga-lhe diretamente no dia do trabalho. " +
  "Quando o trabalho ficar confirmado, recebe no painel e por email a referência Multibanco da taxa da plataforma " +
  `e do IVA dela, e tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias para a pagar.`;
