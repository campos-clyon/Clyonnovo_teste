import { MAX_PROPOSTAS_POR_LADO } from "./negociacao";

/**
 * QUANTA CONCORRÊNCIA TEM ESTE PEDIDO — a barra que enche e muda de cor.
 *
 * "Onde diz «sem proposta ainda» quero que coloque uma barra que começa verde
 * e, se for preenchida, fica vermelha — vai mudando o tom mediante a
 * quantidade de propostas que o pedido tem: de 0 verde a 7 vermelho."
 * — 12-09-2026.
 *
 * O distintivo dizia duas coisas apenas: «sem propostas ainda» ou nada. E a
 * pergunta que o profissional faz ao percorrer a lista não é essa — é «vale a
 * pena eu responder a este?». Zero propostas é uma corrida de um; seis é uma
 * corrida que ele provavelmente já perdeu. Entre as duas há toda a diferença,
 * e um distintivo de texto não a sabia contar.
 *
 * A barra conta. Enche da esquerda para a direita e passa de verde a vermelho
 * pelo caminho — a leitura é imediata e não obriga a ler número nenhum, que é
 * o que se quer de quem percorre vinte cartões ao volante.
 *
 * A ESCALA É A DA NEGOCIAÇÃO, e não um número inventado: `MAX_PROPOSTAS_POR_LADO`.
 * Se um dia passar de sete para dez, a barra passa a encher até dez sozinha.
 * Duas escalas — uma para a regra e outra para o desenho — voltavam a
 * discordar ao primeiro que mudasse.
 */

/** A barra enche até aqui. A mesma escala da regra das propostas. */
export const CONCORRENCIA_CHEIA = MAX_PROPOSTAS_POR_LADO;

export type Concorrencia = {
  /** Quantas propostas de outros profissionais já estão em cima da mesa. */
  quantas: number;
  /** 0 a 100 — quanto da barra está pintado. */
  porCento: number;
  /** A cor da parte pintada. */
  cls: string;
  /** O que se lê ao lado, para quem não distingue as cores. */
  texto: string;
};

/**
 * A cor, em degraus.
 *
 * Um degradê contínuo obrigava a calcular a cor em linha e a fugir da paleta
 * do painel. Cinco degraus lêem-se na mesma como «verde a caminho do
 * vermelho» e continuam a ser cores que o resto do site já usa.
 *
 * O TEXTO AO LADO NÃO É ENFEITE. Um em cada doze homens não distingue verde de
 * vermelho, e esta barra ia ser a única coisa a dizer-lhe se o trabalho ainda
 * está ao alcance. Uma cor sozinha não informa; uma cor com o número ao lado
 * informa toda a gente.
 */
export function concorrenciaDoPedido(quantas: number): Concorrencia {
  const n = Number.isFinite(quantas) && quantas > 0 ? Math.floor(quantas) : 0;
  const porCento = Math.min(100, Math.round((n / CONCORRENCIA_CHEIA) * 100));

  if (n === 0) {
    return {
      quantas: 0,
      porCento: 0,
      cls: "bg-emerald-500",
      texto: "sem propostas ainda",
    };
  }

  const fatia = n / CONCORRENCIA_CHEIA;
  const cls =
    fatia <= 0.3
      ? "bg-emerald-500"
      : fatia <= 0.5
        ? "bg-lime-500"
        : fatia <= 0.7
          ? "bg-amber-500"
          : fatia < 1
            ? "bg-orange-500"
            : "bg-red-500";

  return {
    quantas: n,
    porCento,
    cls,
    // «3 de 7 propostas» — o número diz o que a cor sugere, para quem não
    // distingue as duas pontas do arco-íris.
    texto:
      n >= CONCORRENCIA_CHEIA
        ? `${CONCORRENCIA_CHEIA} propostas, está cheio`
        : `${n} de ${CONCORRENCIA_CHEIA} propostas`,
  };
}
