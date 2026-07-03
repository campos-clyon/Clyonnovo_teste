/**
 * Categorias de serviço do simulador. As 7 originais vêm do MVP
 * (CLYON_Plano_Mestre_Definitivo v3.0, secção 3); montagem_moveis, jardinagem e
 * manutencao_casa foram adicionadas como categorias adjacentes a remoções/casa,
 * mantendo o posicionamento de especialista (não um marketplace generalista).
 * Fonte única partilhada pelo simulador e pela homepage — evita arrays duplicados
 * a divergir entre si.
 */
export interface ServiceCategory {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  description: string;
  /** Página de destino pública, quando existe uma landing page dedicada */
  href: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "recolha_moveis",
    slug: "recolha-moveis",
    label: "Recolha de móveis",
    emoji: "🛋️",
    description: "Sofás, camas, armários, eletrodomésticos e recheios com desmontagem e carga.",
    href: "/recolha-de-moveis",
  },
  {
    id: "recolha_monos",
    slug: "recolha-monos",
    label: "Recolha de monos",
    emoji: "📦",
    description: "Volumes grandes, sucata, despejos e objectos antigos com resposta rápida.",
    href: "/recolha-de-monos",
  },
  {
    id: "recolha_entulho",
    slug: "recolha-entulho",
    label: "Recolha de entulho",
    emoji: "🏗️",
    description: "Retiramos restos de obra, sacos e materiais mistos com resposta rápida.",
    href: "/recolha-de-entulho",
  },
  {
    id: "esvaziamento_casa",
    slug: "esvaziamento-casa",
    label: "Esvaziamento de casa",
    emoji: "🏠",
    description: "Esvaziamento completo de casas com recolha e encaminhamento responsável.",
    href: "/esvaziamento-de-casas",
  },
  {
    id: "esvaziamento_apartamento",
    slug: "esvaziamento-apartamento",
    label: "Esvaziamento de apartamento",
    emoji: "🏢",
    description: "Esvaziamento de apartamentos com apoio completo, mesmo com acesso difícil.",
    href: "/simulador",
  },
  {
    id: "mudanca",
    slug: "mudanca",
    label: "Mudança",
    emoji: "🚚",
    description: "Transporte, carga, descarga e apoio com equipa organizada.",
    href: "/mudancas",
  },
  {
    id: "montagem_moveis",
    slug: "montagem-moveis",
    label: "Montagem e desmontagem de móveis",
    emoji: "🔧",
    description: "Montamos e desmontamos móveis, roupeiros e camas com todo o cuidado.",
    href: "/simulador",
  },
  {
    id: "jardinagem",
    slug: "jardinagem",
    label: "Jardinagem",
    emoji: "🌿",
    description: "Corte de relva, poda e limpeza de jardins e espaços exteriores.",
    href: "/limpeza-de-quintais",
  },
  {
    id: "manutencao_casa",
    slug: "manutencao-casa",
    label: "Manutenção da casa",
    emoji: "🛠️",
    description: "Pequenas reparações e manutenção geral para manter a casa em ordem.",
    href: "/simulador",
  },
  {
    id: "outro",
    slug: "outro-servico",
    label: "Outro serviço",
    emoji: "⭐",
    description: "Não encontrou o que precisa? Descreva o serviço e a IA calcula um orçamento à medida.",
    href: "/simulador",
  },
];
