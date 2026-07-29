// GERADO por scripts/gerar-datas-conteudo.mjs — não editar à mão.
// Correr `npm run seo:datas` depois de alterar conteúdo, antes de publicar.
//
// Datas do último commit que tocou nos ficheiros de cada grupo de páginas.
// O sitemap usa-as como lastmod. Um lastmod que muda em todos os deploys
// ensina o Google a ignorá-lo; este só muda quando o conteúdo muda.

export const CONTEUDO_DATAS = {
  cidadeServico: "2026-07-29T11:28:08+02:00",
  mudancasCidade: "2026-07-12T10:22:13+02:00",
  regioes: "2026-07-10T10:28:46+02:00",
  estaticas: "2026-07-28T20:25:14+02:00",
} as const satisfies Record<string, string>;

export type GrupoConteudo = keyof typeof CONTEUDO_DATAS;

/** Data do grupo como Date, ou a de agora quando o grupo não tem histórico. */
export function dataDoConteudo(grupo: GrupoConteudo): Date {
  const iso = CONTEUDO_DATAS[grupo];
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
