/**
 * O QUE O CARTÃO MOSTRA, E CONTRA O QUE O COMPARA.
 *
 * Isto vive fora de `Trabalhos.tsx` por uma razão concreta, e não por
 * arrumação: `Trabalhos.tsx` exporta UMA coisa — o componente — e começa por
 * `"use client"`. Enquanto estas três funções lá estiveram dentro, nenhum
 * teste lhes conseguia chamar, e o que havia em vez disso eram asserções
 * sobre o TEXTO do ficheiro.
 *
 * Isso não chegava, e mediu-se: de dez maneiras diferentes de partir a
 * `bomPorKmDe` — trocar `!s.comOsSeusCustos` por `s.comOsSeusCustos`, inverter
 * a guarda do terceiro caso, ou devolver `s.custoKm`, que é o erro de unidades
 * que esta alteração existiu para recusar — nove passavam nos testes todos e
 * no compilador. Um ficheiro sem `"use client"` e sem JSX pode ser importado
 * por um teste, e aí as dez são apanhadas.
 */

import { porQuilometro } from "@/lib/sinais-do-trabalho";
import type { Pedido } from "./tipos";

/**
 * OS SEPARADORES — cada um responde a uma pergunta diferente.
 *
 * "Novo" é o que ainda não tocou: chegou-lhe e ele não propôs nada. É o único
 * que tem prazo a correr contra si, e por isso é o que se destaca.
 */
export type Separador =
  | "novos"
  | "negociacao"
  | "contratados"
  | "terminados"
  | "recusados"
  | "arquivados";

/**
 * O NÚMERO QUE O CARTÃO MOSTRA — e é sobre ele que os sinais falam.
 *
 * "O valor que deve aparecer para os pros nos pedidos é o valor que colocamos
 * aqui" — 10-09-2026. Nos novos é o valor da CLYON; na falta dele, a conta
 * feita para ele. A ordem do `??` é a regra inteira: invertida, volta tudo ao
 * que estava.
 *
 * Nos outros separadores devolve `null`, e quem chama fica com o que o cliente
 * quer pagar, que já vem no `recebeSeAceitar` do pedido.
 */
export function valorNoCartao(p: Pedido, separador: Separador): number | null {
  if (separador !== "novos") return null;
  return p.valorDaClyon ?? p.sugestao?.recebeSePropuser ?? null;
}

/**
 * O LIMIAR DE «BEM PAGO» DELE, EM €/km — ou `null`, e vale o da casa.
 *
 * "Comparar o €/km com o custo por km dele em vez de com os 12 € de toda a
 * gente." — 21-09-2026.
 *
 * O custo por km DELE não se compara com o €/km do cartão: 0,80 €/km é o que
 * ele gasta por quilómetro andado, e 21,4 €/km é o que recebe por quilómetro
 * de ida. Mesma unidade, grandezas opostas — pô-las frente a frente acendia o
 * distintivo em todos os cartões do mundo.
 *
 * O que se compara é a conta inteira. A sugestão já a faz com os dados dele —
 * combustível, pessoal, custos fixos, seguro de risco e a margem que ele disse
 * querer — e diz o que lhe ficaria se fosse ele a pôr o preço. Esse número,
 * por quilómetro, é a fronteira dele.
 *
 * Três razões para devolver `null` e deixar mandar o limiar da casa:
 *
 *   · ele não escreveu custo nenhum no perfil — a sugestão correu com os
 *     valores de referência da CLYON, e chamar-lhe «a conta dele» era mentira;
 *   · não havia distância — o combustível entrou a zero, o custo saiu por
 *     baixo e a fronteira sairia baixa de propósito;
 *   · o número em cima JÁ É a conta dele. Comparar a conta dele com a conta
 *     dele dá sempre igual, e um distintivo que acende sempre não é um sinal.
 */
export function bomPorKmDe(p: Pedido, separador: Separador): number | null {
  const s = p.sugestao;
  if (!s || !s.comOsSeusCustos || s.semDistancia) return null;
  if (valorNoCartao(p, separador) != null && p.valorDaClyon == null) return null;
  return porQuilometro({ recebeSeAceitar: s.recebeSePropuser, distanciaKm: p.distanciaKm });
}

/**
 * O trabalho como os SINAIS o lêem: o número do cartão e a fronteira dele.
 *
 * Vive aqui, e não dentro do `map` do cartão, porque a ORDENAÇÃO precisa
 * exactamente do mesmo. Enquanto esteve só lá dentro, «Melhor €/km» ordenava
 * por um número — o que o cliente quer pagar — e o cartão mostrava outro — o
 * valor da CLYON: a lista ordenada por €/km aparecia fora de ordem.
 *
 * O espalhamento é CONDICIONAL de propósito. Escrever `recebeSeAceitar: emCima`
 * sem a condição apaga com `null` o valor do cliente em todos os separadores
 * que não são «novos» — e é em «negociação» que o €/km e o «bem pago» ainda
 * têm de aparecer.
 */
export function paraOsSinaisDe(p: Pedido, separador: Separador) {
  const emCima = valorNoCartao(p, separador);
  return {
    ...p,
    ...(emCima != null ? { recebeSeAceitar: emCima } : {}),
    bomPorKm: bomPorKmDe(p, separador),
  };
}
