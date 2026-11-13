/**
 * O PAGAMENTO, DITO PELA VITÓRIA — d10, desde 15-11-2026 (`novo-modelo.ts`).
 *
 * A partir de 15-11 o cliente paga o trabalho diretamente ao parceiro que
 * contratou (transferência, MB WAY ou dinheiro no local — escolhe ele), recebe
 * duas faturas (a do trabalho, do parceiro, e a da taxa da plataforma) e não
 * paga nada adiantado. As frases gerais vêm de `pagar-ao-parceiro.ts` (as do
 * simulador e do pedido); aqui ficam só as que a Vitória junta no WhatsApp.
 *
 * O IBAN E O MB WAY DO PARCEIRO NUNCA SAEM DA BOCA DELA (dono, 12-11-2026): só
 * aparecem no pedido do cliente que o contratou. A Vitória diz onde estão, e
 * mais nada — nem os escreve, nem os pede.
 *
 * Antes da data nada disto se diz: quem chama pergunta `novoModeloEmVigor` (os
 * textos gerais) ou o servidor (`segueONovoModelo`, os de um trabalho).
 *
 * Puro.
 */
import { AS_DUAS_FATURAS } from "./pagar-ao-parceiro";
import { COMO_SE_PAGA_NO_NOVO_MODELO } from "./pagamento-na-plataforma";

/** Não há nada a pagar antes, nem dinheiro à guarda de ninguém. */
export const SEM_PAGAMENTO_ADIANTADO =
  "Não há nenhum pagamento adiantado nem valor retido: o trabalho paga-se diretamente ao parceiro que contratar.";

/** Onde estão o IBAN e o MB WAY do parceiro — sem os dizer. */
export const OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO =
  "O IBAN e o MB WAY do parceiro aparecem no seu pedido, depois de o contratar — é por lá que os vê. Por segurança, não os mando por aqui.";

/** A quem já contratou: como paga, onde vê os dados dele, e as duas faturas. */
export const PAGA_AO_CONTRATADO =
  "Paga-lhe diretamente — por transferência, MB WAY ou dinheiro no local, como preferir; o IBAN e o MB WAY dele estão no seu pedido. " +
  AS_DUAS_FATURAS;

/** «Como se paga?» no modelo novo: ao parceiro, só para os dados do pedido, as duas faturas, nada adiantado. */
/*
 * d16 (I&D, 13-11-2026): o mesmo texto do site («como se paga» de 15-11, com «pague só
 * para esses dados»), e o «nada adiantado» da Vitória a seguir.
 */
export const COMO_SE_PAGA_NO_WHATSAPP = `${COMO_SE_PAGA_NO_NOVO_MODELO} ${SEM_PAGAMENTO_ADIANTADO}`;

/**
 * O QUE O MODELO TEM DE SABER — as regras do aviso ao modelo, no modelo novo.
 * Sem as palavras antigas: o modelo repete o que lê.
 */
export const REGRAS_DO_PAGAMENTO_PARA_O_MODELO = [
  "O cliente paga o trabalho só ao parceiro que contratou, por transferência, MB WAY ou dinheiro no local. Nunca digas que paga alguma coisa adiantada, nem que é a plataforma que guarda ou recebe esse dinheiro.",
  "Há duas faturas por trabalho: a do trabalho, emitida pelo parceiro, e a da taxa da plataforma.",
  "O IBAN e o número de MB WAY de um parceiro só aparecem no pedido do cliente que o contratou. Nunca os escrevas nem os peças nesta conversa; se o cliente os pedir, diz-lhe que estão no pedido dele.",
] as const;
