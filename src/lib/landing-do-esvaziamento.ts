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

/*
 * O CORPO DA PÁGINA NA VERSÃO DO ESVAZIAMENTO — d51, 16-11-2026.
 *
 * Do meio para baixo a página continuava a falar de recolha («o serviço de
 * recolha é pago», «Recolha de Móveis», «Quanto custa a recolha?»). Quem veio
 * pelo anúncio do esvaziamento lê o esvaziamento até ao fim. Os preços vêm da
 * fonte única (`precos-publicos.ts`), sem IVA e com o IVA ao lado na página.
 */
export const ESVAZIAMENTO_NO_CORPO = {
  logo: "CLYON - Esvaziamento de casas e apartamentos em Lisboa",
  /** Como funciona: o 1.º, o 2.º e o 4.º passo (o 3.º é o mesmo das duas versões). */
  comoFunciona: {
    fotos: "Mostre as divisões e o que fica na casa pelo WhatsApp.",
    morada: "Diga a localidade, o andar e o acesso ao prédio.",
    escolha: "O parceiro escolhido vai à casa, desmonta o que for preciso, carrega e leva tudo.",
  },
  /** «Para receber um orçamento mais certo, envie:» */
  envie: [
    { titulo: "Fotos de cada divisão", texto: "Imagens do que fica na casa, divisão a divisão." },
    { titulo: "Morada ou localidade", texto: "Onde fica a casa a esvaziar." },
    { titulo: "Escadas ou elevador", texto: "O andar e o acesso ao prédio." },
    { titulo: "Quando quer a casa livre", texto: "A data em que precisa da casa vazia." },
  ],
  servicos: {
    titulo: "Esvaziamentos de casas e espaços",
    cartoes: [
      {
        titulo: "Esvaziamento de Casas e Apartamentos",
        texto: "Todo o recheio sai, divisão a divisão.",
        exemplos: ["Heranças", "Mudanças", "Imóveis para venda ou arrendamento"],
      },
      {
        titulo: "Esvaziamento de Garagens e Arrecadações",
        texto: "Tudo o que se foi juntando, de uma vez.",
        exemplos: ["Arrecadações cheias", "Materiais de garagem", "Eletrodomésticos"],
      },
      {
        titulo: "Esvaziamento de Lojas e Escritórios",
        texto: "Espaços comerciais libertos para a entrega das chaves.",
        exemplos: ["Mobiliário de escritório", "Fim de contrato", "Mudança de instalações"],
      },
    ],
  },
  precos: {
    titulo: "Quanto custa um esvaziamento?",
    subtitulo:
      "O valor depende da tipologia, do recheio, do andar e do acesso, da distância até à carrinha e da desmontagem.",
    cartoes: [
      { titulo: "Casa", texto: "Moradias e casas com recheio, conforme as divisões.", servico: "esvaziamento_casa" },
      { titulo: "Apartamento", texto: "Do T0 ao T4, conforme o volume.", servico: "esvaziamento_apartamento" },
      { titulo: "Garagem ou arrecadação", texto: "Conforme o que lá está.", servico: "esvaziamento_garagem" },
    ],
    nota: "O pedido de orçamento é gratuito; o esvaziamento é pago.",
  },
  fim: {
    titulo: "Precisa de esvaziar uma casa?",
    texto: "Envie fotos agora e receba propostas para o esvaziamento da casa ou do apartamento.",
  },
} as const;
