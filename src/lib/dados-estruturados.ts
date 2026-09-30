import { CITIES, SITE_URL } from "@/lib/seo-data";

/**
 * A CLYON NOS DADOS ESTRUTURADOS: UMA ENTIDADE SÓ — 29-09-2026.
 *
 * O `LocalBusiness` da CLYON vive no layout, com a morada verdadeira (Amora),
 * o telefone, o horário e o `@id` abaixo, e vai em todas as páginas. As
 * páginas de serviço declaravam, cada uma, o SEU prestador: um
 * `LocalBusiness` «CLYON» sem morada, ou com a morada inventada em Lisboa, ou
 * — nas treze páginas de mudanças por cidade — um «CLYON — Mudanças em
 * Sintra» com morada em Sintra. Para o Google eram dezenas de empresas com o
 * mesmo nome e o mesmo telefone em sítios diferentes, que é exactamente o
 * padrão das fichas locais falsas.
 *
 * Um serviço numa cidade diz-se com `areaServed`, não com uma morada. E o
 * prestador é sempre o mesmo: uma referência ao `@id` do layout, que o Google
 * junta à entidade completa porque as duas estão no mesmo HTML.
 */
export const ID_DO_NEGOCIO = `${SITE_URL}/#localbusiness`;

/** O prestador de qualquer `Service` do site: uma referência, não uma cópia. */
export const PRESTADOR = { "@id": ID_DO_NEGOCIO } as const;

/**
 * As localidades que a CLYON serve, para o `areaServed` do negócio.
 *
 * Saem de CITIES, que são as que têm página — escritas à mão no layout eram
 * dezoito e faltavam a Costa da Caparica, a Amora, Corroios e Alcochete, que
 * têm páginas indexadas. Ficam de fora as freguesias de Lisboa (Benfica,
 * Lumiar, Alvalade, Olivais): estão dentro de «Lisboa», e declará-las como
 * cidades seria dizer ao Google uma geografia que não existe.
 */
export const LOCALIDADES_SERVIDAS: string[] = CITIES.filter(
  (city) => city.slug === "lisboa" || city.regionLabel !== "Lisboa",
).map((city) => city.name);

/**
 * Até quando valem os preços declarados num `offers`: 31 de Dezembro do ano
 * seguinte.
 *
 * Estava "2026-12-31" escrito à mão em cinco páginas — daqui a três meses
 * era um preço caducado em todas, e o Google ignora (ou assinala) ofertas
 * fora de validade. Calculado, fica sempre pelo menos um ano à frente de
 * quando a página foi gerada.
 */
export function validadeDoPreco(hoje: Date = new Date()): string {
  return `${hoje.getFullYear() + 1}-12-31`;
}
