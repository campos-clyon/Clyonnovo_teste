/**
 * As 7 categorias de serviço do MVP (CLYON_Plano_Mestre_Definitivo v3.0, secção 3).
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
    id: "outro",
    slug: "outro-servico",
    label: "Outro serviço",
    emoji: "⭐",
    description: "Não encontrou o que precisa? Descreva o serviço e a IA calcula um orçamento à medida.",
    href: "/simulador",
  },
];
