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

/**
 * AS TERRAS QUE SE JUNTARAM AO CONCELHO — 28-10-2026 (d13, fase 1).
 *
 * A Amora e Corroios juntam-se ao Seixal, e a Costa da Caparica a Almada. As
 * páginas delas tinham quase o mesmo texto umas das outras, quase nenhuma
 * procura com o nome da terra, e tiravam força à página do concelho, que é a
 * que o Google já escolhe.
 *
 * Cada página de serviço da terra faz 301 para a do MESMO serviço no
 * concelho, e a do concelho passa a falar da terra numa secção sua
 * (`localidades-dos-concelhos.ts`) — sem essa secção não há 301. A terra
 * continua em `CITIES` (o simulador, a Vitória e as zonas usam-na); saem só
 * as páginas: do build, do sitemap e das ligações internas.
 *
 * Chave: o slug da terra em `CITIES`. Valor: o slug do concelho. Desfazer uma
 * terra é tirar a linha dela: as cinco páginas voltam todas.
 * `paginas-de-terra-juntas.test.ts` guarda a lista fechada dos endereços.
 */
export const TERRAS_JUNTAS_AO_CONCELHO: Readonly<Record<string, string>> = {
  amora: "seixal",
  corroios: "seixal",
  "costa-da-caparica": "almada",
};

/**
 * Os serviços que o [...slug] gera por terra — os de `SERVICES` sem as
 * mudanças, que têm rota própria. Escritos aqui porque este ficheiro não
 * importa nada; o teste confere-os com `SERVICES`.
 */
export const SERVICOS_DAS_PAGINAS_DE_TERRA = [
  "recolha-moveis",
  "recolha-monos",
  "recolha-entulho",
  "esvaziamento-casas",
] as const;

/** As páginas geradas das terras juntas: `serviço-terra` → `/serviço-concelho`. */
export const LOCALIDADES_JUNTAS_AO_CONCELHO: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TERRAS_JUNTAS_AO_CONCELHO).flatMap(([terra, concelho]) =>
    SERVICOS_DAS_PAGINAS_DE_TERRA.map((servico) => [`${servico}-${terra}`, `/${servico}-${concelho}`]),
  ),
);

/** As mudanças das mesmas terras: `/mudancas/terra` → `/mudancas/concelho`. */
export const MUDANCAS_JUNTAS_AO_CONCELHO: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TERRAS_JUNTAS_AO_CONCELHO).map(([terra, concelho]) => [
    `/mudancas/${terra}`,
    `/mudancas/${concelho}`,
  ]),
);

/**
 * Todas as páginas que o [...slug] deixa de gerar porque fazem 301: as que
 * têm uma estática a dizer o mesmo e as das terras juntas. É esta que o build,
 * o sitemap e os links (`caminhoDoServicoNaCidade`) lêem.
 */
export const GERADAS_QUE_FAZEM_301: Readonly<Record<string, string>> = {
  ...GERADAS_COM_PAGINA_ESTATICA,
  ...LOCALIDADES_JUNTAS_AO_CONCELHO,
};

/** A cidade cuja página de mudanças responde por esta: a dela, ou a do concelho. */
export function cidadeDaPaginaDeMudancas(slug: string): string {
  return TERRAS_JUNTAS_AO_CONCELHO[slug] ?? slug;
}

/** Páginas estáticas que se fundiram noutra: caminho que sai → caminho que fica. */
export const PAGINAS_FUNDIDAS: Readonly<Record<string, string>> = {
  "/recolha-de-sofa-lisboa": "/recolha-de-sofas",
  // Duas páginas para a mesma pesquisa, as duas finas (pente fino de
  // 15-10-2026); o dono escolheu juntar em /regioes, que ficou com o que
  // esta tinha de seu.
  "/areas-de-atuacao": "/regioes",
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
    ...Object.entries(GERADAS_QUE_FAZEM_301).map(([slug, destino]) => ({
      source: `/${slug}`,
      destination: destino,
      permanent: true,
    })),
    ...Object.entries(MUDANCAS_JUNTAS_AO_CONCELHO).map(([origem, destino]) => ({
      source: origem,
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
