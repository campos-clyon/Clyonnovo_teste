import { emTerra } from "./preposicao-da-terra";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import { ENTULHO_ATE_10_SACOS, ESVAZIAMENTO_POR_TIPOLOGIA, PRECOS, PRECO_POR_ITEM, comMaiuscula } from "@/lib/precos-publicos";
import { comIva, euros } from "@/lib/quanto-custa";
import { PESO_DO_SACO } from "@/lib/sacos-de-entulho";
import { getCidadeLocal } from "@/lib/cidades-local";
import { MOVEIS_POR_PECA_CURTO, RECOLHA_MINIMA_COM_IVA, desdeSemEComIva, faixaSemEComIva, valorSemEComIva } from "@/lib/preco-de-referencia";
import { NOTAS_EM_LINHA } from "@/lib/avaliacoes-publicas";
import { TERRA_JUNTA_NO_TITULO, emTerraDaPagina, monosCamaraOuDeCasa } from "./titulos-seo";

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
/** «30 – 100 € + IVA (36,90 – 123 € com IVA)», para as descriptions — vive numa lib pura desde 29-10-2026 (S13). */
export { faixaSemEComIva };
const PRECO: Record<string, string> = {
  // Por peça desde 03-11-2026 (d6), com a recolha mínima desde a d7 (04-11-2026):
  // «Por peça, 15 a 50 € + IVA (18,45 a 61,50 € com IVA), mínimo 60 € + IVA.»
  "recolha-moveis": `${comMaiuscula(MOVEIS_POR_PECA_CURTO)}.`,
  // «Desde 60 € + IVA (73,80 € com IVA).» — a recolha mínima (d63, 17-11-2026); era a faixa 30 – 100 €.
  "recolha-monos": `${comMaiuscula(desdeSemEComIva(PRECOS.recolha_monos.minimo!))}.`,
  // O m³ ao preço dos sacos, ensacado ou a granel (d7): era «Desde 120 €/m³».
  "recolha-entulho": `${faixa(PRECOS.recolha_entulho.minimo!, PRECOS.recolha_entulho.maximo!)}/m³ + IVA (${faixaComIva(PRECOS.recolha_entulho.minimo!, PRECOS.recolha_entulho.maximo!)}/m³ com IVA).`,
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

/*
 * UMA DESCRIÇÃO POR TERRA NAS CINCO DE «CÂMARA OU DE CASA» — d51, 16-11-2026.
 * As cinco diziam a mesma frase, palavra por palavra, e o Google trata-as como
 * repetidas. Cada uma diz quem recolhe na Câmara dali (de `recolha-da-camara.ts`,
 * das fontes oficiais) e o preço dos parceiros, sem IVA e com o IVA ao lado.
 */
export const DESCRICAO_DOS_MONOS_CAMARA_OU_DE_CASA: Record<string, (preco: string) => string> = {
  cascais: (preco) => `Monos em Cascais: a Cascais Ambiente recolhe-os grátis, no dia marcado. De casa e sem esperar: parceiros, ${preco}.`,
  oeiras: (preco) => `Monos em Oeiras: a Câmara recolhe grátis, no dia e local combinados. De casa e sem esperar: parceiros, ${preco}.`,
  odivelas: (preco) => `Monos em Odivelas: a junta ou os SIMAR recolhem grátis, com marcação. De casa e sem esperar: parceiros, ${preco}.`,
  sintra: (preco) => `Monos em Sintra: a junta recolhe grátis até 10 peças por mês. De casa e sem esperar: parceiros, ${preco}.`,
  queluz: (preco) => `Monos em Queluz e Massamá: a junta recolhe grátis até 10 por mês. De casa e sem esperar: parceiros, ${preco}.`,
};

/*
 * AS DESCRIÇÕES PRÓPRIAS — 23-11-2026 (d96), as das mesmas páginas de
 * `TITULO_PROPRIO` (titulos-seo.ts). Lidas antes das regras gerais; uma que
 * passe dos 155 cai na regra geral. Preços só pelas constantes.
 */
const T2 = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "T2")!;
const T2_NA_FRASE = faixaSemEComIva(T2.minimo, T2.maximo!);
const MONOS_DESDE = desdeSemEComIva(PRECOS.recolha_monos.minimo!);

export const DESCRICAO_PROPRIA: Readonly<Record<string, string>> = {
  "recolha-monos-odivelas": `Em Odivelas a junta ou os SIMAR levam os monos grátis, com marcação. Para os tirar de dentro de casa, um parceiro: ${MONOS_DESDE}.`,
  "recolha-monos-sesimbra": `Em Sesimbra a Câmara recolhe monos grátis até 1100 litros, com marcação. De dentro de casa, um parceiro: ${MONOS_DESDE}.`,
  "recolha-monos-montijo": `No Montijo a recolha de monos é grátis, pela Câmara ou pela junta. De dentro de casa, um parceiro: ${MONOS_DESDE}.`,
  "recolha-monos-carnaxide": `Em Carnaxide e Queijas, Oeiras recolhe monos grátis até 1 m³, com marcação. De dentro de casa, um parceiro: ${MONOS_DESDE}.`,
  "recolha-monos-olivais": `Nos Olivais a Câmara recolhe monos grátis a particulares, pela Na Minha Rua LX. De dentro de casa, um parceiro: ${MONOS_DESDE}.`,
  "esvaziamento-casas-almada": `Esvaziar uma casa em Almada: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}. Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
  "esvaziamento-casas-seixal": `Esvaziar uma casa ou moradia no Seixal: parceiros levam o recheio todo, garagem incluída. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-oeiras": `Esvaziar uma casa em Oeiras, Algés ou Paço de Arcos: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-barreiro": `Esvaziar uma casa no Barreiro, no Lavradio ou na Verderena: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-queluz": `Esvaziar uma casa em Queluz, Belas ou Massamá: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}. Propostas grátis.`,
  "esvaziamento-casas-monte-abraao": `Esvaziar um apartamento em Monte Abraão ou Massamá: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-alcochete": `Esvaziar uma casa ou moradia em Alcochete ou no Samouco: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-carnaxide": `Esvaziar um apartamento em Carnaxide, Queijas ou na Outurela: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "esvaziamento-casas-olivais": `Esvaziar um apartamento nos Olivais ou uma casa na Encarnação: parceiros levam o recheio todo. Um T2 ${T2_NA_FRASE}.`,
  "recolha-entulho-loures": `Entulho de obras em Loures: os SIMAR levam 1 m³ grátis aos clientes. Com um parceiro, sacos ou granel: ${ENTULHO_10_SACOS_NA_FRASE}.`,
  "recolha-monos-lisboa": `Em Lisboa a Câmara leva monos grátis a particulares, pela Na Minha Rua LX. De dentro de casa, parceiros ${MONOS_DESDE}.`,
  // Sem o prazo de 24 h, como o título (ver TITULO_PROPRIO).
  "recolha-monos-cascais": `A Cascais Ambiente leva monos grátis, com marcação: 800 203 186. De dentro de casa, parceiros ${MONOS_DESDE}.`,
  "recolha-moveis-lisboa": `Recolha de móveis em Lisboa desde ${valorSemEComIva(PRECO_POR_ITEM.pequeno)} por peça; mínimo ${RECOLHA_MINIMA_COM_IVA}. ${NOTAS_EM_LINHA}.`,
};

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
  const propriaDaPagina = DESCRICAO_PROPRIA[`${serviceSlug}-${citySlug}`];
  if (propriaDaPagina && tamanho(propriaDaPagina) <= LIMITE_DA_DESCRICAO) return propriaDaPagina;

  const servico = SERVICO_NA_FRASE[serviceSlug] ?? serviceName;
  // A terra junta ao lado do concelho (d68): a frase encolhe para o preço caber.
  const comTerraJunta = Boolean(TERRA_JUNTA_NO_TITULO[`${serviceSlug}-${citySlug}`]);
  const essencial = comTerraJunta
    ? `${servico} ${emTerraDaPagina(serviceSlug, citySlug, cityName)}: propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`
    : `${servico} ${emTerra(cityName)}: propostas de parceiros ` +
      `em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`;

  /*
   * MONOS E ENTULHO, PELO QUE A PESSOA PROCURA — 27-10-2026 (d9).
   * Monos: o que a Câmara não faz (de dentro de casa, sem esperar). Entulho: o
   * preço de entrada real, os 10 sacos, e não «desde 120 €/m³». O prazo vai
   * por extenso — «em menos de 6 horas» — se couber; senão, «Propostas grátis.».
   */
  // 31-10-2026 (d7): as duas vias, a da Câmara e a de casa (ver titulos-seo.ts).
  // d51 (16-11-2026): uma descrição por terra (eram cinco iguais).
  const propria = serviceSlug === "recolha-monos" && monosCamaraOuDeCasa(citySlug) ? DESCRICAO_DOS_MONOS_CAMARA_OU_DE_CASA[citySlug] : undefined;
  if (propria) return propria(desdeSemEComIva(PRECOS.recolha_monos.minimo!));
  if (serviceSlug === "recolha-monos") {
    return comOPrimeiroQueCabeNoFim(
      [
        `Monos ${emTerra(cityName)} sem esperar pela Câmara: parceiros tiram-nos de dentro de casa.`,
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
