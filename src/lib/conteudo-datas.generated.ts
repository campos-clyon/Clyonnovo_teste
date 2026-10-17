// GERADO por scripts/gerar-datas-conteudo.mjs — não editar à mão.
// Correr `npm run seo:datas` depois de alterar conteúdo, antes de publicar.
//
// Datas do último commit que tocou nos ficheiros de cada grupo de páginas.
// O sitemap usa-as como lastmod. Um lastmod que muda em todos os deploys
// ensina o Google a ignorá-lo; este só muda quando o conteúdo muda.

export const CONTEUDO_DATAS = {
  cidadeServico: "2026-10-17T14:51:48+02:00",
  mudancasCidade: "2026-10-17T15:12:58+02:00",
  regioes: "2026-10-15T23:08:10+02:00",
  estaticas: "2026-10-17T15:25:09+02:00",
} as const satisfies Record<string, string>;

export type GrupoConteudo = keyof typeof CONTEUDO_DATAS;

/** Data do grupo como Date, ou a de agora quando o grupo não tem histórico. */
export function dataDoConteudo(grupo: GrupoConteudo): Date {
  const iso = CONTEUDO_DATAS[grupo];
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Cada página estática com a data do último commit que mexeu na pasta dela. */
export const DATAS_DAS_PAGINAS: Record<string, string> = {
  "/": "2026-10-17T15:12:57+02:00",
  "/recolha-de-moveis": "2026-10-17T15:12:58+02:00",
  "/recolha-de-sofas": "2026-10-15T03:02:37+02:00",
  "/recolha-de-camas": "2026-10-15T00:52:40+02:00",
  "/recolha-de-armarios": "2026-10-15T00:52:40+02:00",
  "/recolha-de-eletrodomesticos": "2026-10-15T00:52:40+02:00",
  "/recolha-gratuita-de-moveis-usados": "2026-09-30T18:29:23+02:00",
  "/recolha-de-moveis-urgente": "2026-09-30T18:29:23+02:00",
  "/retirar-moveis-velhos": "2026-10-14T22:26:08+02:00",
  "/esvaziamento-de-casas": "2026-10-17T15:12:58+02:00",
  "/esvaziamento-de-casas-amadora": "2026-09-30T18:29:23+02:00",
  "/recolha-de-monos-amadora": "2026-10-01T20:34:08+02:00",
  "/recolha-de-entulho": "2026-10-17T14:51:48+02:00",
  "/recolha-de-monos": "2026-10-17T15:25:09+02:00",
  "/mudancas": "2026-10-17T15:12:58+02:00",
  "/transporte-de-moveis": "2026-10-15T00:31:34+02:00",
  "/pequenas-mudancas": "2026-10-15T00:31:34+02:00",
  "/mudancas-de-escritorio": "2026-10-15T00:31:34+02:00",
  "/servicos": "2026-10-15T03:23:51+02:00",
  "/precos": "2026-10-17T15:12:58+02:00",
  "/precos/recolha-de-entulho": "2026-10-17T14:51:48+02:00",
  "/precos/recolha-de-monos-e-moveis": "2026-10-17T14:51:48+02:00",
  "/precos/esvaziamento-de-casas": "2026-10-17T14:51:48+02:00",
  "/precos/mudancas": "2026-10-17T15:12:58+02:00",
  "/simulador": "2026-10-15T01:28:19+02:00",
  "/trabalhos": "2026-10-15T00:52:40+02:00",
  "/avaliacoes": "2026-10-15T00:52:40+02:00",
  "/faq": "2026-10-17T14:51:48+02:00",
  "/sobre-nos": "2026-10-15T01:28:19+02:00",
  "/contactos": "2026-10-15T01:08:56+02:00",
  "/termos": "2026-10-01T21:53:05+02:00",
  "/blog": "2026-10-16T14:56:06+02:00",
  "/regioes": "2026-10-15T23:08:10+02:00",
  "/quero-ser-parceiro": "2026-10-01T20:57:01+02:00",
  "/empresas": "2026-10-15T01:28:19+02:00",
  "/como-funciona": "2026-10-01T20:57:01+02:00",
  "/limpeza-de-quintais": "2026-10-16T19:33:01+02:00",
  "/orcamento-recolha-lisboa": "2026-10-15T00:52:40+02:00",
};

/** A data de uma página estática, ou null para ficar com a do grupo. */
export function dataDaPagina(caminho: string): Date | null {
  const iso = DATAS_DAS_PAGINAS[caminho || "/"];
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
