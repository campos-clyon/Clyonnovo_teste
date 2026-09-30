import { getCityServiceSlug } from "@/lib/seo-data";
import { getAllCidadeSlugs } from "@/lib/mudancas-cidades";
import { GERADAS_COM_PAGINA_ESTATICA } from "@/lib/paginas-consolidadas";

/**
 * O ENDEREÇO A QUE SE LIGA quando se quer um serviço numa cidade — 29-09-2026.
 *
 * `getCityServiceSlug` diz como a rota [...slug] se chama por dentro; isto
 * diz para onde deve ir um link. Não são a mesma coisa para as mudanças:
 * `/mudancas-almada` não existe como página, é um redirect — e levava a
 * `/mudancas/almada`, que dá 404, porque só há página própria nas cidades de
 * `mudancas-cidades.ts`. A página da região da Margem Sul ligava para lá no
 * cartão «Mudanças», e a de Setúbal para `/mudancas/setubal`, outro 404.
 *
 * Nas cidades com página vai-se directo a ela (sem passar pelo redirect);
 * nas outras, ao balcão geral de mudanças, que responde por todas.
 *
 * O mesmo para as páginas geradas que se juntaram a uma estática
 * (`paginas-consolidadas.ts`): o link vai directo à que fica. Um link interno
 * para um endereço que responde 301 gasta rastreio e diz ao Google que nós
 * próprios ainda usamos o endereço velho.
 *
 * Vive fora de `seo-data.ts` de propósito: esse é importado pelo Header, pelo
 * rodapé e por outros componentes de cliente, e isto traz atrás a lista das
 * cidades de mudanças, com os textos todos — que não têm nada a fazer no
 * JavaScript que vai para o browser.
 */
export function caminhoDoServicoNaCidade(serviceSlug: string, citySlug: string): string {
  if (serviceSlug === "mudancas") {
    return getAllCidadeSlugs().includes(citySlug) ? `/mudancas/${citySlug}` : "/mudancas";
  }
  const slug = getCityServiceSlug(serviceSlug, citySlug);
  return GERADAS_COM_PAGINA_ESTATICA[slug] ?? `/${slug}`;
}
