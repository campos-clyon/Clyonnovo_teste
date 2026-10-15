import { SERVICE_CATEGORIES } from "./service-categories";
import { CITIES } from "./seo-data";
import { normalize } from "./coverage";
import { caminhoDoServicoNaCidade } from "./caminho-da-cidade";
import { emTerra } from "./preposicao-da-terra";

/**
 * OS SERVIÇOS E AS ZONAS DE UM PERFIL, COM LIGAÇÃO — 15-10-2026.
 *
 * *«Perfis e simulador»* — escolhido pelo dono. As páginas dos profissionais
 * tinham 120 a 230 palavras, e as zonas eram texto corrido: um perfil não
 * ligava a página nenhuma do serviço que o profissional faz. Agora cada
 * serviço liga à página dele na terra de onde o profissional parte («Recolha
 * de móveis no Seixal»), e cada zona à página do serviço principal dele lá —
 * o que é próprio de cada perfil, e o caminho que um cliente faria.
 */

/** A página de cidade de cada categoria, quando o serviço as tem. */
const SERVICO_NA_CIDADE: Readonly<Record<string, string>> = {
  recolha_moveis: "recolha-moveis",
  recolha_monos: "recolha-monos",
  recolha_entulho: "recolha-entulho",
  esvaziamento_casa: "esvaziamento-casas",
  esvaziamento_apartamento: "esvaziamento-casas",
  mudanca: "mudancas",
};

/** A terra com páginas próprias que tem este nome — ou nada. */
export function terraComPagina(nome: string | null | undefined): { slug: string; nome: string } | null {
  if (!nome) return null;
  const c = CITIES.find((x) => normalize(x.name) === normalize(nome));
  return c ? { slug: c.slug, nome: c.name } : null;
}

/**
 * A página do serviço nessa terra, ou null quando não a há — as mudanças têm
 * a sua lista de cidades, e para as outras o caminho cai no hub.
 */
function paginaNaTerra(servico: string, terra: { slug: string } | null): string | null {
  if (!terra) return null;
  const caminho = caminhoDoServicoNaCidade(servico, terra.slug);
  return caminho === "/mudancas" ? null : caminho;
}

export type ServicoDoPerfil = {
  categoria: string;
  /** «Recolha de móveis no Seixal», ou só o serviço quando a terra não tem página. */
  ligacao: string;
  descricao: string;
  href: string;
};

/** Os serviços do perfil, cada um com a página dele na terra de onde parte. */
export function servicosDoPerfil(categorias: readonly string[], cidade: string | null): ServicoDoPerfil[] {
  const terra = terraComPagina(cidade);
  const vistos = new Set<string>();
  const fora: ServicoDoPerfil[] = [];
  for (const id of categorias) {
    const cat = SERVICE_CATEGORIES.find((c) => c.id === id);
    if (!cat || cat.id === "outro") continue;
    const naTerra = SERVICO_NA_CIDADE[id] ? paginaNaTerra(SERVICO_NA_CIDADE[id], terra) : null;
    const href = naTerra ?? cat.href;
    // Esvaziamento de casa e de apartamento vão dar à mesma página: uma só.
    if (vistos.has(href)) continue;
    vistos.add(href);
    fora.push({
      categoria: id,
      ligacao: naTerra && terra ? `${cat.label} ${emTerra(terra.nome)}` : cat.label,
      descricao: cat.description,
      href,
    });
  }
  return fora;
}

/** As zonas onde trabalha, cada uma com a página do serviço principal dele lá, quando a há. */
export function zonasDoPerfil(
  zonas: readonly string[],
  categorias: readonly string[],
): Array<{ nome: string; href: string | null; titulo: string | null }> {
  const id = categorias.find((c) => SERVICO_NA_CIDADE[c]);
  const cat = id ? SERVICE_CATEGORIES.find((c) => c.id === id) : undefined;
  return zonas.map((nome) => {
    const terra = terraComPagina(nome);
    const href = id ? paginaNaTerra(SERVICO_NA_CIDADE[id], terra) : null;
    return { nome, href, titulo: href && cat && terra ? `${cat.label} ${emTerra(terra.nome)}` : null };
  });
}
