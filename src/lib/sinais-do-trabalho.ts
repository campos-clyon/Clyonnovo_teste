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

/** Quanto rende por quilómetro, ou `null` quando falta a distância ou o valor. */
export function porQuilometro(t: TrabalhoParaAvaliar): number | null {
  const valor = t.recebeSeAceitar;
  const km = t.distanciaKm;
  if (valor == null || !Number.isFinite(valor)) return null;
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  return valor / km;
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
      texto: `A ${Math.round(km)} km`,
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
  if (km2 != null && km2 >= BOM_POR_KM) {
    sinais.push({
      chave: "bem_pago",
      emoji: "💰",
      texto: "Bem pago",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
    });
  }

  const fotos = t.quantasFotos ?? 0;
  if (fotos >= 3) {
    sinais.push({
      chave: "com_fotos",
      emoji: "📷",
      // O número, e não a palavra: cabe na linha e diz mais.
      texto: `${fotos} fotos`,
      cls: "border-slate-200 bg-slate-50 text-slate-600",
    });
  }

  return sinais;
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
    (chaves.has("com_fotos") ? 1 : 0)
  );
}

/** A cor da barra à esquerda do cartão: a do sinal mais forte que ele tiver. */
export function corDaBarra(t: TrabalhoParaAvaliar, novo: boolean): string {
  const chaves = new Set(sinaisDoTrabalho(t).map((s) => s.chave));
  if (chaves.has("perto")) return "bg-orange-500";
  if (chaves.has("urgente")) return "bg-amber-400";
  return novo ? "bg-[#00B4CC]" : "bg-[#E2EEF3]";
}

/** "20,6 €/km" — a conta que ele faz de cabeça, escrita. */
export function porKmPorExtenso(t: TrabalhoParaAvaliar): string | null {
  const v = porQuilometro(t);
  if (v == null) return null;
  return `${v.toFixed(1).replace(".", ",")} €/km`;
}
