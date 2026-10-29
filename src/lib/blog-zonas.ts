import { CIDADES_COM_PAGINA } from "@/lib/seo-data";
import type { BlogPost } from "@/lib/blog-data";
import { artigosPublicados } from "@/lib/artigos-do-blog";
import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
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
  // Os três artigos de mudanças não ligavam a página nenhuma de cidade (09-10-2026).
  "quanto-custa-uma-mudanca-em-lisboa": "mudancas",
  "como-organizar-uma-mudanca-de-casa": "mudancas",
  "pequenas-mudancas-em-lisboa-quando-compensa": "mudancas",
  // Os artigos de 14-10-2026.
  "quanto-custa-retirar-um-sofa-em-lisboa": "recolha-moveis",
  "esvaziar-a-casa-de-um-familiar": "esvaziamento-casas",
  // Os guias de 15-10-2026.
  "recolha-de-monos-camara-ou-profissional": "recolha-monos",
  "entulho-sacos-big-bag-ou-contentor": "recolha-entulho",
  "esvaziar-apartamento-para-arrendar-ou-vender": "esvaziamento-casas",
  "mudanca-entre-lisboa-e-a-margem-sul": "mudancas",
};

/** Os artigos publicados de um serviço — para o bloco de guias no hub dele (14-10-2026). */
export function artigosDoServico(servico: string): BlogPost[] {
  return artigosPublicados().filter((a) => ARTIGO_SERVICO[a.slug] === servico);
}

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
  for (const city of CIDADES_COM_PAGINA) {
    const local = getCidadeLocal(city.slug);
    if (!local) continue;
    zonas.push({
      // Pelo `caminhoDoServicoNaCidade` (29-09-2026): os monos e o
      // esvaziamento na Amadora têm página estática, e a gerada faz 301.
      href: caminhoDoServicoNaCidade(servico, city.slug),
      cidade: city.name,
      nota: local.zonas.slice(0, 3).join(", "),
    });
    if (zonas.length >= limite) break;
  }
  return { servico, zonas };
}
