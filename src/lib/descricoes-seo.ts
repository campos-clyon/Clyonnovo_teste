import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import { PRECOS } from "@/lib/precos-publicos";
import { PESO_MAXIMO_DO_SACO_KG } from "@/lib/sacos-de-entulho";
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
  "recolha-entulho": `Sacos até ${PESO_MAXIMO_DO_SACO_KG} kg, sem contentores.`,
  "esvaziamento-casas": "Heranças e recheios completos.",
};

/**
 * O preço, onde a página o publica — sai de `precos-publicos`, como o resto
 * do site. O esvaziamento por cidade não mostra número, e a description
 * também não: o que não se mostra na página não se declara ao Google.
 */
const PRECO: Record<string, string> = {
  "recolha-moveis": `Preços de ${PRECOS.recolha_moveis.etiqueta}, sem IVA.`,
  "recolha-monos": `Preços de ${PRECOS.recolha_monos.etiqueta}, sem IVA.`,
  "recolha-entulho": `Preços ${PRECOS.recolha_entulho.etiqueta}, sem IVA.`,
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
  const servico = SERVICO_NA_FRASE[serviceSlug] ?? serviceName;
  const essencial =
    `${servico} em ${cityName}: propostas de profissionais verificados ` +
    `em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`;

  const zonas = (getCidadeLocal(citySlug)?.zonas ?? []).filter((z) => z !== cityName).slice(0, 3);
  const freguesias =
    zonas.length >= 2 ? `Em ${zonas.slice(0, -1).join(", ")} e ${zonas[zonas.length - 1]}.` : null;

  return descricaoQueCabe([essencial, PRECO[serviceSlug], O_QUE_INCLUI[serviceSlug], freguesias]);
}
