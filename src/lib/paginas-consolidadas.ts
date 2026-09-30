/**
 * AS PÁGINAS QUE SE JUNTARAM A OUTRAS — 29-09-2026.
 *
 * O Search Console tinha estas em «Rastreada, atualmente não indexada», e a
 * razão era a mesma em todas: há outra página nossa a responder à mesma
 * pesquisa. O Google escolhe uma e deixa a outra de fora — e, com os sinais
 * divididos pelas duas, a escolhida também fica mais fraca do que devia.
 *
 *   · /esvaziamento-casas-amadora (gerada pelo [...slug]) dizia o mesmo que
 *     /esvaziamento-de-casas-amadora, que é uma página escrita à mão;
 *   · /recolha-monos-amadora, o mesmo que /recolha-de-monos-amadora;
 *   · /recolha-de-sofa-lisboa, o mesmo que /recolha-de-sofas;
 *   · o artigo da limpeza pós-obra fala de um serviço que a CLYON já não
 *     presta — quem lá chega quer tirar o entulho da obra.
 *
 * Consolidar é fazer as quatro coisas ao mesmo tempo, e todas saem daqui:
 * um 301 da página que sai para a que fica (next.config.ts), tirá-la do
 * sitemap, não a gerar no build, e apontar os links internos para a que
 * fica. Esquecer uma delas deixa o Google a receber sinais contraditórios —
 * um sitemap a pedir uma página que responde com redirect ensina-o a
 * desconfiar do sitemap todo.
 *
 * ESTE FICHEIRO NÃO IMPORTA NADA, de propósito: o next.config.ts lê-o para
 * gerar os redirects, e o que ele importa não passa pelo alias "@/" nem deve
 * arrastar o resto do site atrás. É a mesma regra de `mudancas-cidades.ts`.
 */

/**
 * Páginas geradas pelo [...slug] que têm uma estática a dizer o mesmo.
 *
 * A chave é o slug gerado (`serviço-cidade`), o valor é o caminho da página
 * que fica.
 */
export const GERADAS_COM_PAGINA_ESTATICA: Readonly<Record<string, string>> = {
  "esvaziamento-casas-amadora": "/esvaziamento-de-casas-amadora",
  "recolha-monos-amadora": "/recolha-de-monos-amadora",
};

/** Páginas estáticas que se fundiram noutra: caminho que sai → caminho que fica. */
export const PAGINAS_FUNDIDAS: Readonly<Record<string, string>> = {
  "/recolha-de-sofa-lisboa": "/recolha-de-sofas",
};

/**
 * Artigos do blog retirados: slug → para onde vai quem os procura.
 *
 * O texto continua em `blog-data.ts` até a equipa de conteúdo o apagar — o
 * que o tira do site é esta lista, lida pela listagem do blog, pela página do
 * artigo e pelo sitemap (ver `artigos-do-blog.ts`).
 */
export const ARTIGOS_RETIRADOS: Readonly<Record<string, string>> = {
  "limpeza-pos-obra-e-retirada-de-residuos": "/recolha-de-entulho",
};

/** Os redirects de tudo o que está acima, no formato do next.config. */
export function redirectsDasConsolidacoes() {
  return [
    ...Object.entries(GERADAS_COM_PAGINA_ESTATICA).map(([slug, destino]) => ({
      source: `/${slug}`,
      destination: destino,
      permanent: true,
    })),
    ...Object.entries(PAGINAS_FUNDIDAS).map(([origem, destino]) => ({
      source: origem,
      destination: destino,
      permanent: true,
    })),
    ...Object.entries(ARTIGOS_RETIRADOS).map(([slug, destino]) => ({
      source: `/blog/${slug}`,
      destination: destino,
      permanent: true,
    })),
  ];
}
