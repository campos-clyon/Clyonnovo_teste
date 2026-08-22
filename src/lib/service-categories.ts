/**
 * Categorias de serviço do pedido. As 7 originais vêm do MVP; montagem_moveis,
 * jardinagem e manutencao_casa foram acrescentadas como categorias adjacentes a
 * remoções e casa.
 *
 * As descrições estão escritas na terceira pessoa de propósito. A CLYON deixou
 * de ser quem executa e passou a ser onde se encontra quem execute — dizer
 * "retiramos" ou "montamos" aqui punha o site a prometer um trabalho que não é
 * nosso, e estas linhas aparecem tanto na homepage como nas páginas de serviço.
 *
 * Fonte única partilhada pelo formulário de pedido e pelas páginas públicas —
 * evita arrays duplicados a divergir entre si. O mega-menu do cabeçalho passou
 * a derivar daqui pela mesma razão: tinha lista própria, com dois serviços que
 * a homepage não mostrava.
 *
 * O `href` leva SEMPRE a uma página de serviço. Quatro entradas apontavam a
 * `/simulador`, e um cartão que mostra um preço faz uma promessa de página
 * informativa: quem carrega quer ler, e era-lhe pedido que preenchesse. Três
 * ganharam página em /servicos/[slug]; a de "outro serviço" continua a apontar
 * ao simulador, e é a excepção certa — é literalmente o cartão de "não
 * encontrei o que preciso".
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
    description: "Volumes grandes, sucata, despejos e objetos antigos com resposta rápida.",
    href: "/recolha-de-monos",
  },
  {
    id: "recolha_entulho",
    slug: "recolha-entulho",
    label: "Recolha de entulho",
    emoji: "🏗️",
    description: "Restos de obra, sacos e materiais mistos, com transportador licenciado.",
    href: "/recolha-de-entulho",
  },
  {
    id: "esvaziamento_casa",
    slug: "esvaziamento-casa",
    label: "Esvaziamento de casa",
    emoji: "🏠",
    description: "Esvaziamento completo de casas com recolha  e destino licenciado.",
    href: "/esvaziamento-de-casas",
  },
  {
    id: "esvaziamento_apartamento",
    slug: "esvaziamento-apartamento",
    label: "Esvaziamento de apartamento",
    emoji: "🏢",
    description: "Esvaziamento de apartamentos com apoio completo, mesmo com acesso difícil.",
    href: "/servicos/esvaziamento-apartamento",
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
    description: "Montagem e desmontagem de móveis, roupeiros e camas com cuidado.",
    href: "/servicos/montagem-moveis",
  },
  {
    id: "jardinagem",
    slug: "jardinagem",
    /*
     * O rótulo diz agora as duas coisas, e o URL fica.
     *
     * Dizia "Jardinagem" e aterrava numa página chamada "Limpeza de Quintais".
     * Quem carrega em Jardinagem e chega a Quintais duvida de que tenha
     * clicado no sítio certo — e uma dúvida dessas no primeiro clique custa
     * mais do que parece.
     *
     * O href NÃO muda: /limpeza-de-quintais está indexado, e trocá-lo perdia
     * o histórico dessa página no Google. Quem se alinha é o rótulo, e o h1
     * da página de destino.
     */
    label: "Jardinagem e limpeza de quintais",
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
    href: "/servicos/manutencao-casa",
  },
  {
    id: "outro",
    slug: "outro-servico",
    label: "Outro serviço",
    emoji: "⭐",
    description: "Não encontrou o que precisa? Descreva o serviço e receba propostas à medida.",
    href: "/simulador",
  },
];
