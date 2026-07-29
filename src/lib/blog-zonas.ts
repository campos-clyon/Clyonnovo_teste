import { CITIES, getCityServiceSlug } from "@/lib/seo-data";
import { getCidadeLocal } from "@/lib/cidades-local";

/**
 * Que serviço cada artigo do blog serve, para lhe pendurar as zonas onde o
 * fazemos.
 *
 * PORQUÊ: os artigos são as páginas que o Google visita com mais frequência —
 * são as que atraem ligações e as que ele já indexou. As páginas de cidade
 * são as que ele descobriu e decidiu não visitar. Ligar umas às outras passa
 * autoridade de quem a tem para quem precisa dela, e dá ao leitor do artigo
 * o passo seguinte concreto: a página da zona dele.
 *
 * Um artigo sem serviço associado não ganha o bloco. Ligar "onde doar móveis
 * usados" a páginas de recolha de entulho seria ruído para o leitor e um
 * sinal fraco para o Google.
 */
const ARTIGO_SERVICO: Record<string, string> = {
  "recolha-gratuita-de-moveis-usados-costa-da-caparica": "recolha-moveis",
  "recolha-de-moveis-como-funciona": "recolha-moveis",
  "doacao-de-moveis-ou-despejo": "recolha-moveis",
  "onde-doar-vender-ou-anunciar-moveis-usados": "recolha-moveis",
  "recolha-de-entulho-legal-e-organizada": "recolha-entulho",
  "limpeza-pos-obra-e-retirada-de-residuos": "recolha-entulho",
  "recolha-de-monos-o-que-inclui": "recolha-monos",
  "esvaziamento-de-casas-com-recheio": "esvaziamento-casas",
  "amarsul-ecocentros-e-destino-de-residuos": "recolha-entulho",
};

export interface ZonaLigada {
  href: string;
  cidade: string;
  /** Uma linha de contexto real daquela zona — não "clique aqui". */
  nota: string;
}

/**
 * Zonas a ligar a partir de um artigo, com uma nota verdadeira de cada uma.
 *
 * A nota sai dos dados locais (freguesias reais). Um bloco de 26 links
 * sem texto seria uma lista de ligações — exactamente o padrão que o Google
 * desvaloriza. Doze com contexto é um índice útil.
 */
export function zonasDoArtigo(slugArtigo: string, limite = 12): {
  servico: string | null;
  zonas: ZonaLigada[];
} {
  const servico = ARTIGO_SERVICO[slugArtigo] ?? null;
  if (!servico) return { servico: null, zonas: [] };

  const zonas: ZonaLigada[] = [];
  for (const city of CITIES) {
    const local = getCidadeLocal(city.slug);
    if (!local) continue;
    zonas.push({
      href: `/${getCityServiceSlug(servico, city.slug)}`,
      cidade: city.name,
      nota: local.zonas.slice(0, 3).join(", "),
    });
    if (zonas.length >= limite) break;
  }
  return { servico, zonas };
}
