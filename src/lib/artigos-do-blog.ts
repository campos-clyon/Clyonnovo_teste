import { getAllBlogPosts, type BlogPost } from "@/lib/blog-data";
import { ARTIGOS_RETIRADOS } from "@/lib/paginas-consolidadas";

/**
 * OS ARTIGOS QUE ESTÃO NO AR — 29-09-2026.
 *
 * `blog-data.ts` guarda o texto de todos os artigos, incluindo os que o site
 * já não mostra: o da limpeza pós-obra fala de um serviço que a CLYON deixou
 * de ter, e o Search Console tinha-o em «Rastreada, atualmente não indexada».
 * Quem o procura vai agora para a recolha de entulho (301, no next.config).
 *
 * Apagar o artigo é trabalho da equipa de conteúdo, que está a reescrever o
 * blog. Até lá, tirá-lo do site é tirá-lo DAQUI — a listagem do blog, a
 * página do artigo (build e «artigos relacionados») e o sitemap lêem todos
 * esta função, e não `getAllBlogPosts()`. Filtrar num sítio só é a única
 * forma de não o esquecer num deles: um sitemap que pede um endereço que
 * responde 301 ensina o Google a desconfiar do sitemap todo.
 */
export function artigosPublicados(): BlogPost[] {
  return getAllBlogPosts().filter((artigo) => !(artigo.slug in ARTIGOS_RETIRADOS));
}

/** Um artigo que está no ar, ou nada — o retirado não se serve, redirecciona. */
export function artigoPublicado(slug: string): BlogPost | undefined {
  return artigosPublicados().find((artigo) => artigo.slug === slug);
}
