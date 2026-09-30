import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { TAXA_IVA } from "./taxas-plataforma";

/**
 * O QUE AS PÁGINAS PÚBLICAS PROMETEM — ESCRITO UMA VEZ. (30-09-2026)
 *
 * As páginas de cidade, de serviço e o blog repetiam as mesmas promessas à
 * mão, e cada cópia tinha derivado para o seu lado: «recolha no mesmo dia»
 * numa, «resposta em menos de 1 hora» noutra, «domingos não trabalhamos»
 * aqui e «domingos com acréscimo de 10–20 %» ali; a urgência «não implica
 * custo adicional» numa página e «pode ter um custo adicional» na do lado.
 * Quem lê as duas não conclui que uma está errada — conclui que a casa não
 * sabe o que vende.
 *
 * E quase todas prometiam o que a CLYON não controla. A CLYON é uma
 * plataforma: o que ela cumpre é o prazo das propostas, o atendimento e o
 * preço fechado antes de começar. A data do trabalho, a desmontagem e o
 * acréscimo por urgência são do profissional — e por isso aqui dizem sempre
 * que vêm na proposta dele.
 *
 * Os números não se escrevem à mão: o prazo sai de PRAZO_DE_RESPOSTA e o
 * IVA de TAXA_IVA. `mudancas-cidades.ts` é a excepção, e a razão está lá.
 */

/** Horário de atendimento da CLYON — quem atende, não quem executa. */
export const ATENDIMENTO = "de segunda a sábado, das 08:00 às 20:00";

/** "em menos de 6 horas" — para meio de frase. */
export const PROPOSTAS_EM_ATE = `em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`;

/** A promessa que a plataforma cumpre, como frase inteira. */
export const RECEBE_PROPOSTAS = `Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`;

/** A desmontagem não vem «incluída» por defeito: pede-se, e entra na proposta. */
export const DESMONTAGEM_A_PEDIDO =
  "A desmontagem pode ser pedida; indique-a no pedido para vir incluída na proposta.";

/** O custo da urgência é do profissional, e diz-se onde está. */
export const ACRESCIMO_POR_URGENCIA =
  "Qualquer acréscimo por urgência vem na proposta do profissional.";

/** A resposta a «recolhem no mesmo dia?», em qualquer página. */
export const NO_MESMO_DIA =
  "Depende de haver profissional disponível. Indique a data e a urgência no pedido: " +
  `recebe propostas ${PROPOSTAS_EM_ATE}, e a data do trabalho combina-se com o ` +
  `profissional que escolher. ${ACRESCIMO_POR_URGENCIA}`;

/** A resposta a «trabalham ao fim de semana?». */
export const AO_FIM_DE_SEMANA =
  `O atendimento da CLYON é ${ATENDIMENTO}. Pode pedir trabalho para sábado; ` +
  "ao domingo depende de haver profissional disponível, e qualquer acréscimo vem na proposta.";

/**
 * O que fica fechado antes de começar, e o que se acrescenta a quem pede
 * factura. Substitui «não acresce nada no fim», que era falso para quem pede
 * factura — e «tudo incluído», pela mesma razão.
 */
export const PRECO_FECHADO =
  "O preço de cada proposta já inclui a taxa da plataforma e fica fechado antes de começar. " +
  `Sem IVA; se pedir factura, acrescem ${Math.round(TAXA_IVA * 100)} %.`;
