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

/** «o trabalho faz-se no dia que combinar com o profissional» — a data é do profissional, não da CLYON. */
export const O_DIA_DO_TRABALHO = "o trabalho faz-se no dia que combinar com o parceiro";

/** «O trabalho faz-se no dia que combinar com o profissional» — para o princípio de uma linha (cartões). */
export const O_DIA_DO_TRABALHO_NO_INICIO = O_DIA_DO_TRABALHO.charAt(0).toUpperCase() + O_DIA_DO_TRABALHO.slice(1);

/**
 * A PROMESSA DO PRAZO — UMA SÓ, EM TODO O LADO. (28-10-2026, decisão d1.)
 *
 * «Propostas em menos de 6 horas; o trabalho faz-se no dia que combinar com o
 * profissional.» — o texto aprovado pelo CEO e pelo dono. Substitui a frase
 * curta («Recebe propostas em menos de 6 horas.», que se chamava
 * RECEBE_PROPOSTAS) e as cópias à mão da segunda metade que cada página
 * escrevia à sua maneira: «a data do trabalho combina-se depois com o
 * profissional», «a data combina-se com o profissional», «o trabalho em si
 * depende do volume e da disponibilidade». Vale para as páginas, a FAQ e os
 * dados estruturados dela, os emails e a Vitória.
 *
 * Nunca «no próprio dia» nem «no mesmo dia»: a CLYON cumpre o prazo das
 * propostas; a data é a que o cliente combina com o profissional escolhido.
 */
export const PROMESSA_DO_PRAZO = `Propostas ${PROPOSTAS_EM_ATE}; ${O_DIA_DO_TRABALHO}.`;

/** A desmontagem não vem «incluída» por defeito: pede-se, e entra na proposta. */
export const DESMONTAGEM_A_PEDIDO =
  "A desmontagem pode ser pedida; indique-a no pedido para vir incluída na proposta.";

/** O custo da urgência é do profissional, e diz-se onde está. */
export const ACRESCIMO_POR_URGENCIA =
  "Qualquer acréscimo por urgência vem na proposta do parceiro.";

/**
 * O PEDIDO URGENTE — 31-10-2026 (decisão d8). O simulador oferece «Hoje»
 * (decisão do dono de 25-10-2026) e a app de cliente passa a oferecê-lo
 * também: vai como pedido urgente, e não promete o dia. A mesma frase na app
 * (por baixo da escolha, pela R7), no simulador e na FAQ (`NO_MESMO_DIA`).
 */
export const PEDIDO_URGENTE =
  "Vai como pedido urgente: chega assim aos parceiros da zona, mas o dia não fica garantido.";

/** A resposta a «recolhem no mesmo dia?», em qualquer página — com a promessa do prazo inteira. */
export const NO_MESMO_DIA =
  "Depende de haver parceiro disponível. Indique a data e a urgência no pedido: o pedido urgente " +
  "vai aos parceiros da zona como tal, mas o dia não fica garantido. " +
  `${PROMESSA_DO_PRAZO} ${ACRESCIMO_POR_URGENCIA}`;

/**
 * À ESPERA DAS PRIMEIRAS PROPOSTAS — 31-10-2026 (decisão d8). O site dizia
 * «Ainda não há propostas… avisamos por email» e a app «O pedido foi enviado
 * aos parceiros verificados da zona. Ainda sem propostas.»; nenhum dizia o
 * prazo. Uma frase, lida pelo /pedido/[token] e mandada à app pela R5
 * (`textos.aindaSemPropostas`).
 */
export const AINDA_SEM_PROPOSTAS =
  `Ainda sem propostas. O pedido foi enviado aos parceiros verificados da zona, que respondem ${PROPOSTAS_EM_ATE}. ` +
  "Assim que chegar uma proposta, aparece aqui.";

/** A resposta a «trabalham ao fim de semana?». */
/**
 * QUEM FAZ O TRABALHO — 27-10-2026 (decisão d2). O profissional que o cliente
 * escolher, e não a CLYON: é a regra do site («o trabalho é feito pelo
 * profissional escolhido»), dita agora também pela Vitória a quem pergunta.
 */
export const QUEM_FAZ_O_TRABALHO =
  "O trabalho é feito pelo parceiro que escolher, entre os que lhe mandarem proposta; " +
  "a CLYON recebe o pedido, junta as propostas e acompanha-o até ao fim.";

export const AO_FIM_DE_SEMANA =
  `O atendimento da CLYON é ${ATENDIMENTO}. Pode pedir trabalho para sábado; ` +
  "ao domingo depende de haver parceiro disponível, e qualquer acréscimo vem na proposta.";

/**
 * O que fica fechado antes de começar. Substitui «não acresce nada no fim»,
 * que era falso para quem pedia factura — e «tudo incluído», pela mesma razão.
 *
 * DESDE 02-10-2026 O IVA VEM DENTRO, e há factura em todas as vendas. A frase
 * dizia «Sem IVA; se pedir factura, acrescem 23 %», e ficou assim na página
 * dos anúncios e nas /regioes até 14-10-2026: anunciava um preço que depois
 * aparecia 23 % mais alto na proposta. Ver iva-incluido.ts.
 */
export const PRECO_FECHADO =
  `O preço de cada proposta já inclui a taxa da plataforma e o IVA (${Math.round(TAXA_IVA * 100)} %), ` +
  "e fica fechado antes de começar. Há fatura em todas as vendas.";
