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
    // Dizia «com equipa organizada» — a CLYON não tem equipas (09-10-2026).
    description: "Carga, transporte e descarga por parceiros da sua zona, com montagem se a pedir.",
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
    // Dizia «Pequenas reparações e manutenção geral…» — voltou com reparações
    // e remodelações (25-10-2026).
    description: "Reparações e remodelações, da pintura à casa de banho e à cozinha.",
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

/*
 * OS SERVIÇOS FORA DO PLANO — 25-10-2026.
 *
 * Por agora a CLYON fica com o que já faz: recolhas, esvaziamentos e
 * mudanças. A montagem de móveis, a jardinagem e limpeza de quintais e a
 * manutenção da casa saem do que o site oferece — menus, a grelha da página
 * inicial, as opções do simulador e do formulário, as inscrições e o
 * sitemap —, e as páginas deles ficam fora do Google (noindex) mas continuam
 * a abrir.
 *
 * A MANUTENÇÃO DA CASA VOLTA — 25-10-2026, decisão do dono no mesmo dia: «a
 * manutenção da casa volta», com reparações e remodelações. Volta aos menus,
 * à grelha da página inicial, ao simulador (e ao ?servico=), às inscrições,
 * aos perfis, ao sitemap e ao Google. A montagem de móveis e a jardinagem e
 * limpeza de quintais continuam fora.
 *
 * Saem da lista PÚBLICA, e não de `SERVICE_CATEGORIES`: os pedidos e os
 * profissionais antigos com estes serviços continuam a ter nome, e o que lê
 * a lista inteira para outros fins não muda de número a meio de uma conversa.
 */
export const FORA_DO_PLANO: ReadonlySet<string> = new Set(["montagem_moveis", "jardinagem"]);

/** Os serviços que o site oferece hoje — para menus, grelhas, formulários e listas públicas. */
export const SERVICOS_PUBLICOS: ServiceCategory[] = SERVICE_CATEGORIES.filter((c) => !FORA_DO_PLANO.has(c.id));

/*
 * AS CATEGORIAS QUE UM PROFISSIONAL ESCOLHE — UMA SÓ LISTA (29-10-2026).
 *
 * O perfil no backoffice mostrava nove (com a montagem e a jardinagem), a app
 * Pro sete, a candidatura oito (com «Outro serviço»). Agora o perfil no
 * backoffice, o painel, a inscrição, a candidatura, a app Pro e os filtros
 * da Mesa lêem todos daqui, pela mesma ordem; o simulador e o catálogo da app
 * de cliente usam `SERVICOS_PUBLICOS`, que é esta lista com o «Outro serviço»
 * no fim. O teste `categorias-uma-so-lista.test.ts` chumba uma lista que se
 * afaste.
 *
 * Os profissionais antigos que tinham a montagem ou a jardinagem ficam com
 * elas gravadas: só deixam de se poder escolher.
 */
export const CATEGORIAS_DOS_PROFISSIONAIS: readonly ServiceCategory[] = SERVICOS_PUBLICOS.filter(
  (c) => c.id !== "outro",
);

/** As páginas dos serviços fora do plano: abrem, mas com noindex e fora do sitemap. */
export const PAGINAS_FORA_DO_PLANO: readonly string[] = SERVICE_CATEGORIES.filter((c) => FORA_DO_PLANO.has(c.id)).map(
  (c) => c.href,
);

/*
 * O NOME DE CADA SERVIÇO, NUM SÍTIO SÓ — 27-10-2026 (decisão d12).
 *
 * Havia 13 mapas {id: nome} copiados à mão (emails, conta do cliente,
 * orçamento, agenda, carteiras…) e seis variantes: «Esvaziamento de
 * Apartamento», «Jardinagem», «Montagem de móveis», «Outro». O cliente lia um
 * nome no site e outro no email. Agora todos lêem daqui; o teste da orquestra
 * (orquestra.test.ts, regra f) chumba um mapa novo copiado à mão.
 *
 * Os ids que já não existem mas ainda podem estar em pedidos antigos da base
 * ficam com nome, para não aparecer o código.
 */
const NOMES_DE_PEDIDOS_ANTIGOS = [
  ["limpeza_pos_obra", "Limpeza pós-obra"],
  ["limpeza_quintais", "Limpeza de quintais"],
  ["recolha_eletrodomesticos", "Recolha de eletrodomésticos"],
] as const;

/** id → nome, para quem procura num mapa (`NOMES_DOS_SERVICOS[id] ?? …`). */
export const NOMES_DOS_SERVICOS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries([
    ...NOMES_DE_PEDIDOS_ANTIGOS,
    ...SERVICE_CATEGORIES.map((c) => [c.id, c.label] as const),
  ]),
);

/** O nome do serviço; um id desconhecido fica como veio, e sem id, `seNaoHouver`. */
export function nomeDoServico(id: string | null | undefined, seNaoHouver = "Serviço"): string {
  if (!id) return seNaoHouver;
  return NOMES_DOS_SERVICOS[id] ?? id;
}
