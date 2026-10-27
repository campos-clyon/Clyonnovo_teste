import { emTerra } from "./preposicao-da-terra";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import { ENTULHO_ATE_10_SACOS, PRECOS } from "@/lib/precos-publicos";
import { comIva, euros } from "@/lib/quanto-custa";
import { PESO_DO_SACO } from "@/lib/sacos-de-entulho";
import { getCidadeLocal } from "@/lib/cidades-local";

/**
 * AS DESCRIPTIONS QUE O GOOGLE MOSTRA INTEIRAS — 29-09-2026.
 *
 * O Google mostra por volta de 155 caracteres da meta description e corta o
 * resto a meio de uma palavra, com reticências. A 29-09-2026 havia 144
 * páginas acima dos 160: as de cidade juntavam à frase-base as freguesias da
 * zona e cortavam o conjunto aos 320 — ou seja, o Google recebia o dobro do
 * que mostra, e o que ficava à vista era o princípio de uma lista de preços.
 *
 * A regra passa a ser a dos títulos (`titulos-seo.ts`): o essencial primeiro
 * — o serviço, a terra e o que a pessoa recebe —, e o resto só entra se
 * couber inteiro. Nunca uma frase cortada a meio.
 */
export const LIMITE_DA_DESCRICAO = 155;

/** Quantos caracteres o Google conta (um «é» é um, e não dois bytes). */
export const tamanho = (texto: string) => [...texto].length;

/**
 * Junta frases inteiras enquanto couberem no limite.
 *
 * A primeira vai sempre — é a que diz o essencial, e quem a escreve garante
 * que cabe. As seguintes são extras por ordem de importância: a que não
 * couber fica de fora e tenta-se a próxima, que pode ser mais curta.
 */
export function descricaoQueCabe(frases: Array<string | null | undefined>, limite = LIMITE_DA_DESCRICAO): string {
  const [primeira = "", ...extras] = frases.filter((f): f is string => Boolean(f));
  let texto = primeira;
  for (const frase of extras) {
    const junto = `${texto} ${frase}`;
    if (tamanho(junto) <= limite) texto = junto;
  }
  return texto;
}

/** Como o serviço se diz a meio de uma frase (o nome da página vem em maiúsculas). */
const SERVICO_NA_FRASE: Record<string, string> = {
  "recolha-moveis": "Recolha de móveis",
  "recolha-monos": "Recolha de monos",
  "recolha-entulho": "Recolha de entulho",
  "esvaziamento-casas": "Esvaziamento de casas",
};

/**
 * O que distingue o serviço, numa frase CURTA — cabe depois do essencial e
 * do preço na maioria das terras, e é o que separa as quatro páginas da
 * mesma cidade umas das outras.
 */
const O_QUE_INCLUI: Record<string, string> = {
  "recolha-moveis": "Sofás, camas, armários e colchões.",
  "recolha-monos": "Sem esperar pela câmara.",
  "recolha-entulho": `Sacos de ${PESO_DO_SACO}, sem contentores.`,
  "esvaziamento-casas": "Heranças e recheios completos.",
};

/**
 * O preço, onde a página o publica — sai de `precos-publicos`, como o resto
 * do site. O esvaziamento por cidade não mostra número, e a description
 * também não: o que não se mostra na página não se declara ao Google.
 */
/*
 * O preço sem IVA nunca vai sozinho — 22-10-2026. As ~100 páginas de cidade
 * diziam no Google «Preços de 30 – 100 €, sem IVA.»; quem paga vê o valor com
 * IVA, e é esse que tem de estar ao lado.
 */
const faixa = (de: number, ate: number) => `${euros(de).replace(" €", "")} – ${euros(ate)}`;
const faixaComIva = (de: number, ate: number) => `${euros(comIva(de)).replace(" €", "")} – ${euros(comIva(ate))}`;
/** «30 – 100 € + IVA (36,90 – 123 € com IVA)», para as descriptions. */
export const faixaSemEComIva = (de: number, ate: number) => `${faixa(de, ate)} + IVA (${faixaComIva(de, ate)} com IVA)`;
const PRECO: Record<string, string> = {
  "recolha-moveis": `${faixa(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!)} + IVA (${faixaComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!)} com IVA).`,
  "recolha-monos": `${faixa(PRECOS.recolha_monos.minimo!, PRECOS.recolha_monos.maximo!)} + IVA (${faixaComIva(PRECOS.recolha_monos.minimo!, PRECOS.recolha_monos.maximo!)} com IVA).`,
  "recolha-entulho": `Desde ${euros(PRECOS.recolha_entulho.minimo!)}/m³ + IVA (${euros(comIva(PRECOS.recolha_entulho.minimo!))}/m³ com IVA).`,
};

/** «10 sacos 40 – 50 € + IVA (49,20 – 61,50 € com IVA)» — o preço de entrada do entulho. */
export const ENTULHO_10_SACOS_NA_FRASE = `10 sacos ${faixaSemEComIva(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}`;

/** «Propostas grátis em menos de 6 horas.» — o prazo sempre por extenso. */
export const PROPOSTAS_GRATIS_NO_PRAZO = `Propostas grátis em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`;

/**
 * As frases que vão sempre (se couberem, uma a uma) e, no fim, a PRIMEIRA das
 * alternativas que couber — nunca duas, que diriam o mesmo duas vezes.
 */
export function comOPrimeiroQueCabeNoFim(frases: string[], alternativas: string[]): string {
  const base = descricaoQueCabe(frases);
  for (const a of alternativas) {
    const junto = `${base} ${a}`;
    if (tamanho(junto) <= LIMITE_DA_DESCRICAO) return junto;
  }
  return base;
}

/**
 * A description de uma página cidade × serviço.
 *
 * Por ordem: o essencial (serviço, terra, propostas de profissionais
 * verificados e o prazo), o preço, o que o serviço inclui e as freguesias
 * da zona — estas só quando cabem, e sem repetir o nome da própria terra.
 */
export function descricaoDaCidade(
  serviceSlug: string,
  serviceName: string,
  cityName: string,
  citySlug: string,
): string {
  const servico = SERVICO_NA_FRASE[serviceSlug] ?? serviceName;
  const essencial =
    `${servico} ${emTerra(cityName)}: propostas de profissionais verificados ` +
    `em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`;

  /*
   * MONOS E ENTULHO, PELO QUE A PESSOA PROCURA — 27-10-2026 (d9).
   * Monos: o que a Câmara não faz (de dentro de casa, sem esperar). Entulho: o
   * preço de entrada real, os 10 sacos, e não «desde 120 €/m³». O prazo vai
   * por extenso — «em menos de 6 horas» — se couber; senão, «Propostas grátis.».
   */
  if (serviceSlug === "recolha-monos") {
    return comOPrimeiroQueCabeNoFim(
      [
        `Monos ${emTerra(cityName)} sem esperar pela Câmara: profissionais verificados tiram-nos de dentro de casa.`,
        PRECO["recolha-monos"],
      ],
      [PROPOSTAS_GRATIS_NO_PRAZO, "Propostas grátis."],
    );
  }
  if (serviceSlug === "recolha-entulho") {
    return comOPrimeiroQueCabeNoFim(
      [`Entulho de obras ${emTerra(cityName)}, em sacos ou a granel e sem contentor: ${ENTULHO_10_SACOS_NA_FRASE}.`],
      [PROPOSTAS_GRATIS_NO_PRAZO, "Propostas grátis."],
    );
  }

  const zonas = (getCidadeLocal(citySlug)?.zonas ?? []).filter((z) => z !== cityName).slice(0, 3);
  const freguesias =
    zonas.length >= 2 ? `Em ${zonas.slice(0, -1).join(", ")} e ${zonas[zonas.length - 1]}.` : null;

  return descricaoQueCabe([essencial, PRECO[serviceSlug], O_QUE_INCLUI[serviceSlug], freguesias]);
}
