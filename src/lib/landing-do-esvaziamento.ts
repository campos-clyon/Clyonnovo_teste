import { PRECOS } from "@/lib/precos-publicos";

/*
 * A PÁGINA DO ANÚNCIO NA VERSÃO DO ESVAZIAMENTO — 15-11-2026 (d42).
 *
 * O grupo novo do Google Ads é para quem esvazia uma casa (heranças,
 * mudanças, arrendamento). Mandá-lo para «Recolha de Móveis, Monos…» era
 * fazê-lo procurar no primeiro ecrã o que veio buscar. O endereço é o da
 * página do anúncio com `?servico=esvaziamento`: o next.config reescreve-o
 * para /orcamento-recolha-lisboa/esvaziamento, uma página estática (sem ler
 * o endereço no browser, o primeiro ecrã já vem certo e não pisca). O código
 * de origem do WhatsApp continua «1», porque o endereço que a pessoa vê é o
 * da página do anúncio.
 *
 * A limpeza e a lavagem no fim fazem-se, se a pessoa as pedir (dono, 14-11).
 * Quem faz o trabalho é o parceiro escolhido, nunca a CLYON.
 */

/** O valor de `?servico=` que abre esta versão. */
export const SERVICO_DO_ESVAZIAMENTO_NA_LANDING = "esvaziamento";

/** O endereço que o Marketing põe no anúncio (sem os UTM, que o Google junta). */
export const ENDERECO_DO_ESVAZIAMENTO_NA_LANDING = `https://clyon.pt/orcamento-recolha-lisboa?servico=${SERVICO_DO_ESVAZIAMENTO_NA_LANDING}`;

/** O caminho interno para onde o next.config reescreve (fora do Google). */
export const CAMINHO_INTERNO_DO_ESVAZIAMENTO = "/orcamento-recolha-lisboa/esvaziamento";

export type VarianteDaLanding = "recolha" | "esvaziamento";

export const ESVAZIAMENTO_NA_LANDING = {
  titulo: "Esvaziamento de casas e apartamentos — heranças, mudanças, arrendamento",
  /** O que está incluído, pela ordem em que acontece. */
  incluido: [
    "Desmontagem dos móveis",
    "Carregamento e transporte",
    "O recheio todo sai, divisão a divisão",
    "Limpeza e lavagem no fim, se a pedir",
  ],
  /** Os três passos do cartão do simulador. */
  passos: [
    "Diga a tipologia e o que fica na casa",
    "Indique a morada e o acesso",
    "Receba propostas e escolha o parceiro",
  ],
  botao: "Pedir propostas",
  simulador: "/simulador?servico=esvaziamento_casa",
  /** A frase do WhatsApp: começa como a do anúncio, para se poder contar. */
  mensagem: "Olá! Encontrei-vos no Google e quero um orçamento de esvaziamento. Vou enviar fotos.",
  /** O «desde» do esvaziamento de casa, da fonte única (sem IVA; o com IVA vai ao lado). */
  desde: PRECOS.esvaziamento_casa.minimo!,
} as const;
