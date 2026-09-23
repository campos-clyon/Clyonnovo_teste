/**
 * Os sinais que dizem ao profissional PORQUE É QUE um trabalho vale a pena.
 *
 * "Vamos melhorar esse design, dar outras cores e efeitos para os pedidos
 * melhor interagir com os utilizadores. Pedidos que estão a menos de 10 km,
 * por exemplo, devem ter o emoji do foguinho."
 *
 * A lista dizia o serviço, a cidade, a distância e o dinheiro — e cada linha
 * parecia igual à de cima. Quem lê vinte cartões ao volante não compara
 * números: procura um motivo para parar. Estes sinais são esse motivo.
 *
 * NENHUM PEDE DADOS NOVOS. Distância, urgência, valor e fotografias já viajam
 * até ao painel dele. O que não existia era a conta — e a conta é a parte
 * interessante.
 */

import { quandoEOTrabalho } from "./quando-e-o-trabalho";

export type Sinal = {
  /** A chave que os filtros usam. */
  chave: "perto" | "urgente" | "bem_pago" | "com_fotos";
  emoji: string;
  /** Curto de propósito: nenhum distintivo pode partir para a linha de baixo. */
  texto: string;
  /** As classes do distintivo — fundo, borda e cor, na paleta do painel. */
  cls: string;
};

export type TrabalhoParaAvaliar = {
  distanciaKm?: number | null;
  urgency?: string | null;
  /** A data marcada, quando existe: ganha sempre à palavra do cliente. */
  dataAgendada?: string | Date | null;
  /** O dia do pedido — o zero de "amanhã". Ver `quando-e-o-trabalho`. */
  criadoEm?: string | Date | null;
  recebeSeAceitar?: number | null;
  quantasFotos?: number;
  /**
   * O limiar de «bem pago» DESTE profissional, em €/km.
   *
   * Sem isto vale `BOM_POR_KM`, que é o limiar da casa — a fronteira tirada
   * dos trabalhos já fechados, igual para toda a gente. Quem escreveu os
   * custos dele no perfil tem direito a uma fronteira que é a dele, e quem
   * a calcula é o ecrã: ver `bomPorKmDe` em `Trabalhos.tsx`.
   */
  bomPorKm?: number | null;
};

/**
 * O raio quente, em quilómetros.
 *
 * Fixo, e não uma fracção do raio dele. Quem cobre 200 km não acha que 30 km é
 * «perto» só porque vai a 200: o que faz um trabalho ser bom ali ao lado é o
 * combustível e o tempo, que são absolutos. Trinta quilómetros custam trinta
 * quilómetros a toda a gente.
 */
export const RAIO_QUENTE_KM = 10;

/**
 * O que se considera bem pago, por quilómetro.
 *
 * TIRADO DA BASE, E NÃO DE UM PALPITE.
 *
 * O primeiro número que escolhi foram 6 €/km. Fui contar os trabalhos
 * fechados — 19 com distância medível — e a mediana deles é 6,3. Ou seja: o
 * meu palpite era exactamente o valor típico, e um distintivo que aparece em
 * metade dos cartões não é um sinal, é papel de parede.
 *
 * A distribuição real tem duas famílias, com um vazio no meio:
 *
 *   1,9  2,4  3,7  3,7  4,3  4,7  4,7  5,8  6,2  6,3  8,4  9,3   ← o comum
 *   ·············· vazio ··············
 *   14,0  14,7  15,3  16,8  18,2  18,2  24,1                     ← os bons
 *
 * Doze cai nesse vazio, que é o sítio honesto para pôr uma fronteira: separa
 * as duas famílias em vez de cortar uma delas a meio. Dá cerca de um em cada
 * quatro, e é aproximadamente o dobro da mediana.
 *
 * Quando houver mais trabalhos fechados, vale a pena voltar a contar — a conta
 * está no histórico da sessão de 27-08-2026, e faz-se em cinco minutos.
 */
export const BOM_POR_KM = 12;

/**
 * A fronteira a que ESTE trabalho se compara, em €/km.
 *
 * "Comparar o €/km com o custo por km dele em vez de com os 12 € de toda a
 * gente." — 21-09-2026.
 *
 * O limiar da casa saiu da mediana dos trabalhos fechados: é o que distingue
 * um bom trabalho no mercado. Não é o que distingue um bom trabalho PARA ELE —
 * quem tem uma equipa de três e uma carrinha a 0,80 €/km tem um chão diferente
 * de quem trabalha sozinho, e os 12 € não sabem disso.
 *
 * A FRONTEIRA DELE SÓ LEVANTA A BARRA, NUNCA A BAIXA — e isso é o resultado de
 * a ter medido em vez de a supor.
 *
 * A primeira versão deixava a dele mandar nos dois sentidos, e teria destruído
 * o distintivo. As duas contas não estão à mesma escala: «o que eu teria
 * pedido» num trabalho a 25 km dá cerca de 3,6 €/km, e os 12 €/km da casa
 * exigiriam 300 € para o mesmo trabalho. Ou seja, a fronteira dele cai quase
 * sempre DENTRO da família comum que o `BOM_POR_KM` aqui em cima foi à base de
 * dados medir para não marcar — 1,9 a 9,3 €/km. O distintivo passava a acender
 * em toda a lista, que é exactamente o «papel de parede» contra o qual esse
 * número foi escolhido.
 *
 * Com o `Math.max` fica o que ele pediu no sentido que conta: quem tem custos
 * altos precisa de MAIS do que os 12 para o trabalho lhe compensar, e passa a
 * ser isso que o distintivo diz. Quem tem custos baixos continua a ver a
 * fronteira medida — que é um bocado do mercado, e não uma opinião.
 *
 * RESOLVIDO A 22-09-2026, e vale a pena guardar o que era: o valor da CLYON
 * nascia de `estimatedPriceWithVat` e a sugestão de um preço SEM IVA, logo a
 * comparação era 23 % permissiva por construção. O `valor-de-arranque.ts`
 * passou a escolher o preço sem IVA e os dois lados ficaram na mesma unidade.
 *
 * O `Math.max` não era por causa disso e continua a ser preciso: protegia o
 * distintivo de uma fronteira demasiado baixa, e a fronteira continua baixa
 * depois de o IVA sair — mais baixa, até.
 *
 * Fica uma sombra, nas linhas GRAVADAS ANTES dessa data: o
 * `valorDesejadoCliente` delas ainda tem imposto lá dentro, e não há coluna
 * que as distinga das outras. Elas saem da tabela ao fim do prazo de retenção.
 */
export function limiarDeBomPago(t: TrabalhoParaAvaliar): number {
  const dele = t.bomPorKm;
  if (dele != null && Number.isFinite(dele) && dele > 0) return Math.max(BOM_POR_KM, dele);
  return BOM_POR_KM;
}

/** Quanto rende por quilómetro, ou `null` quando falta a distância ou o valor. */
export function porQuilometro(t: TrabalhoParaAvaliar): number | null {
  const valor = t.recebeSeAceitar;
  const km = t.distanciaKm;
  if (valor == null || !Number.isFinite(valor)) return null;
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  return valor / km;
}

/**
 * O NÚMERO DE QUILÓMETROS COMO O ECRÃ O ESCREVE — com a casa decimal.
 *
 * "329,00 € · 15 km · 21,4 €/km" — três números no mesmo cartão, e quem os
 * divide não chega a nenhum deles: 329 a dividir por 15 dá 21,9. Nenhuma das
 * contas estava errada. O €/km dividia pela distância verdadeira, 15,37 km, e
 * ao lado dele estava essa mesma distância arredondada a inteiro.
 *
 * Quem lê faz a conta de cabeça — é para isso que o €/km ali está — e
 * concluía que o cartão se enganou. Um número que não fecha com o do lado
 * custa mais do que a casa decimal que o faz fechar.
 *
 * A casa decimal só aparece quando diz alguma coisa: `15` e não `15,0`.
 */
export function kmPorExtenso(km: number): string {
  const n = Math.round(km * 10) / 10;
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", ",");
}

/**
 * Os sinais de um trabalho, por ordem de peso.
 *
 * A ordem não é cosmética: o primeiro sinal é o que pinta o cartão, e um
 * cartão com quatro destaques não tem destaque nenhum.
 */
export function sinaisDoTrabalho(t: TrabalhoParaAvaliar): Sinal[] {
  const sinais: Sinal[] = [];

  const km = t.distanciaKm;
  if (km != null && Number.isFinite(km) && km <= RAIO_QUENTE_KM) {
    sinais.push({
      chave: "perto",
      emoji: "🔥",
      /*
       * ABAIXO DO QUILÓMETRO NÃO SE DIZ O NÚMERO — diz-se que é aqui ao lado.
       *
       * `Math.round(0,4)` é zero, e o distintivo dizia «A 0 km» a qualquer
       * trabalho a menos de 500 metros. Zero não é uma distância, é um erro a
       * fingir de distância — e o teste do foguinho já o escrevia sobre o
       * outro caso: «"a 0 km" seria a pior mentira possível: manda-o lá».
       *
       * A casa decimal encolhia a janela para os 50 metros, não a fechava. As
       * palavras fecham-na, e são as MESMAS que a linha de cima usa (ver
       * `distanciaPorExtenso`): o cartão deixa de ter dois vocabulários para
       * a mesma distância.
       */
      texto: km < 1 ? "A menos de 1 km" : `A ${kmPorExtenso(km)} km`,
      cls: "border-orange-200 bg-orange-50 text-orange-700",
    });
  }

  /*
   * URGENTE A SÉRIO, contado a partir de hoje — e não da palavra congelada.
   *
   * A palavra do cliente fica gravada como ele a escreveu e lia-se sempre
   * contra hoje: um pedido de segunda-feira a dizer «amanhã» continuava a
   * acender o ⚡ na quinta, e a prometer um dia que já tinha passado. Agora a
   * conta faz-se desde o dia do pedido, e o distintivo só aparece quando o
   * trabalho é mesmo hoje ou mesmo amanhã.
   */
  const quando = quandoEOTrabalho(t);
  if (!quando.passou && (quando.curto === "Hoje" || quando.curto === "Amanhã")) {
    sinais.push({
      chave: "urgente",
      emoji: "⚡",
      texto: quando.curto,
      cls: "border-amber-200 bg-amber-50 text-amber-800",
    });
  }

  const km2 = porQuilometro(t);
  if (km2 != null && km2 >= limiarDeBomPago(t)) {
    sinais.push({
      chave: "bem_pago",
      emoji: "💰",
      texto: "Bem pago",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
    });
  }

  /*
   * O DISTINTIVO «N FOTOS» SAIU — 12-09-2026.
   *
   * "Remova o número com a quantidade de fotos; aumente o tamanho da imagem."
   *
   * O sinal nasceu quando a miniatura tinha 80 px e se lia como um ícone: era
   * preciso alguém dizer que havia fotografias. A 112 px isso deixou de ser
   * preciso — vê-se a fotografia, e o «+9» no canto dela diz quantas mais há,
   * no sítio onde se vai carregar para as ver.
   *
   * Dois distintivos a contar a mesma coisa fazem com que nenhum se leia. Os
   * que ficam — perto, urgente, bem pago — respondem todos à mesma pergunta:
   * porque é que este trabalho vale a pena. Quantas fotografias tem não
   * responde a nada disso.
   *
   * A chave `com_fotos` fica no tipo e no peso da ordenação: um pedido com
   * fotografias continua a valer mais na lista, porque continua a ser mais
   * fácil de orçamentar. O que deixou de haver é uma etiqueta a dizê-lo.
   */

  return sinais;
}

/** Um pedido com fotografias é mais fácil de orçamentar — e sobe na lista. */
function temFotografias(t: TrabalhoParaAvaliar): boolean {
  return (t.quantasFotos ?? 0) >= 3;
}

/**
 * O peso de um trabalho, para o pôr à frente na lista.
 *
 * Perto vale mais do que urgente, que vale mais do que bem pago. É discutível
 * — e é por isso que está aqui, num número, e não espalhado por um `sort`.
 */
export function pesoDoTrabalho(t: TrabalhoParaAvaliar): number {
  const chaves = new Set(sinaisDoTrabalho(t).map((s) => s.chave));
  return (
    (chaves.has("perto") ? 8 : 0) +
    (chaves.has("urgente") ? 4 : 0) +
    (chaves.has("bem_pago") ? 3 : 0) +
    // As fotografias já não são um distintivo, mas continuam a contar aqui: um
    // pedido com fotografias é mais fácil de orçamentar, e por isso vale mais
    // à frente na lista. Ver `temFotografias`.
    (temFotografias(t) ? 1 : 0)
  );
}

/** "20,6 €/km" — a conta que ele faz de cabeça, escrita. */
export function porKmPorExtenso(t: TrabalhoParaAvaliar): string | null {
  const v = porQuilometro(t);
  if (v == null) return null;
  return `${v.toFixed(1).replace(".", ",")} €/km`;
}
