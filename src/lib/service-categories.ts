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
  /*
   * A GARAGEM, O SÓTÃO E A CAVE — 29-10-2026 (preços aprovados pelo dono).
   * Os preços em `ESVAZIAMENTO_POR_ESPACO` (precos-publicos.ts); as perguntas
   * no simulador. A página é a dos esvaziamentos, na secção de cada um.
   */
  {
    id: "esvaziamento_garagem",
    slug: "esvaziamento-garagem",
    label: "Esvaziamento de garagem",
    emoji: "🚗",
    description: "Um parceiro verificado esvazia a garagem e leva tudo para destino licenciado.",
    href: "/esvaziamento-de-casas#garagem-sotao-cave",
  },
  {
    id: "esvaziamento_sotao",
    slug: "esvaziamento-sotao",
    label: "Esvaziamento de sótão",
    emoji: "🪜",
    description: "Um parceiro verificado desce o que está no sótão e leva-o para destino licenciado.",
    href: "/esvaziamento-de-casas#garagem-sotao-cave",
  },
  {
    id: "esvaziamento_cave",
    slug: "esvaziamento-cave",
    label: "Esvaziamento de cave",
    emoji: "📦",
    description: "Um parceiro verificado sobe o que está na cave e leva-o para destino licenciado.",
    href: "/esvaziamento-de-casas#garagem-sotao-cave",
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

/*
 * O QUE UM PROFISSIONAL ESCOLHE: QUATRO GRUPOS — 29-10-2026 (decisão do dono).
 *
 * De manhã a lista única tinha sete serviços (recolha de móveis, de monos, de
 * entulho, esvaziamento de casa, de apartamento, mudança e manutenção da
 * casa). À tarde o dono decidiu que o profissional deixa de os marcar um a um
 * e passa a marcar GRUPOS: quem faz recolhas faz as três, quem esvazia uma
 * casa esvazia um apartamento. O CLIENTE continua a escolher o serviço exacto
 * (o simulador, o catálogo da app de cliente e a Mesa usam
 * `SERVICOS_PUBLICOS`); o envio dos pedidos traduz o serviço do pedido no seu
 * grupo (`grupoDoServico`) e compara-o com os grupos do profissional.
 *
 * O perfil no backoffice, o painel, a inscrição, a candidatura e a app Pro
 * mostram estes quatro, por esta ordem. O teste
 * `categorias-uma-so-lista.test.ts` chumba uma lista que se afaste.
 *
 * SERVIÇOS EM BREVE. A garagem, o sótão e a cave vão ser esvaziamentos, mas só
 * entram no simulador e no site quando o dono aprovar os preços. Já estão no
 * grupo (`servicosEmBreve`): no dia em que houver pedidos deles, chegam a quem
 * tem «Esvaziamentos» sem mexer no motor.
 *
 * A montagem de móveis, a jardinagem e o «Outro serviço» não dão grupo. Quem
 * os tinha gravados fica com eles (ver `normalizarCategorias`).
 */
export interface GrupoDeServicos {
  id: string;
  label: string;
  emoji: string;
  descricao: string;
  /** Os serviços que o cliente escolhe e que chegam a quem tem este grupo. */
  servicos: readonly string[];
  /** Os que ainda não se oferecem, mas já são deste grupo (ver a nota de cima). */
  servicosEmBreve: readonly string[];
}

export const GRUPOS_DE_SERVICOS: readonly GrupoDeServicos[] = [
  {
    id: "recolhas",
    label: "Recolhas",
    emoji: "🛋️",
    descricao: "Recolha de móveis, de monos e de entulho.",
    servicos: ["recolha_moveis", "recolha_monos", "recolha_entulho"],
    servicosEmBreve: [],
  },
  {
    id: "esvaziamentos",
    label: "Esvaziamentos",
    emoji: "🏠",
    descricao: "Esvaziamento de casas, apartamentos, garagens, sótãos e caves.",
    // A garagem, o sótão e a cave entraram a 29-10-2026 (estavam «em breve»).
    servicos: ["esvaziamento_casa", "esvaziamento_apartamento", "esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"],
    servicosEmBreve: [],
  },
  {
    id: "mudancas",
    label: "Mudanças",
    emoji: "🚚",
    descricao: "Mudanças de casa e de escritório, e transporte de móveis.",
    servicos: ["mudanca"],
    servicosEmBreve: [],
  },
  {
    id: "manutencao_da_casa",
    label: "Manutenção da casa",
    emoji: "🛠️",
    descricao: "Reparações e remodelações.",
    servicos: ["manutencao_casa"],
    servicosEmBreve: [],
  },
];

/** A lista que o profissional escolhe: os quatro grupos (nome antigo, mantido para quem o importa). */
export const CATEGORIAS_DOS_PROFISSIONAIS: readonly GrupoDeServicos[] = GRUPOS_DE_SERVICOS;

const GRUPO_POR_ID = new Map(GRUPOS_DE_SERVICOS.map((g) => [g.id, g]));

/** O grupo de um serviço do cliente (`recolha_monos` → `recolhas`); `null` se não tiver. */
export function grupoDoServico(servico: string | null | undefined): string | null {
  if (!servico) return null;
  if (GRUPO_POR_ID.has(servico)) return servico;
  for (const g of GRUPOS_DE_SERVICOS) {
    if (g.servicos.includes(servico) || g.servicosEmBreve.includes(servico)) return g.id;
  }
  return null;
}

/** Os ids que não dão grupo mas ficam gravados a quem já os tinha. */
const SEM_GRUPO_MAS_GUARDADOS: ReadonlySet<string> = new Set([...FORA_DO_PLANO, "outro"]);

/**
 * As categorias de um profissional, na forma de hoje: os grupos (pela ordem
 * da lista) e, a seguir, o que não dá grupo e ele já tinha (montagem,
 * jardinagem, «outro»). Um serviço antigo passa ao seu grupo; o que não se
 * conhece cai. Serve a migração dos dados e todas as gravações — uma app Pro
 * antiga que ainda mande `recolha_monos` grava «Recolhas».
 */
export function normalizarCategorias(categorias: readonly string[]): string[] {
  const grupos = new Set<string>();
  const outros: string[] = [];
  for (const c of categorias) {
    const g = grupoDoServico(c);
    if (g) grupos.add(g);
    else if (SEM_GRUPO_MAS_GUARDADOS.has(c) && !outros.includes(c)) outros.push(c);
  }
  return [...GRUPOS_DE_SERVICOS.filter((g) => grupos.has(g.id)).map((g) => g.id), ...outros];
}

/** Os grupos de um profissional, aceitando também os serviços antigos gravados. */
export function gruposDe(categorias: readonly string[]): string[] {
  return normalizarCategorias(categorias).filter((c) => GRUPO_POR_ID.has(c));
}

/**
 * Os serviços que chegam a um profissional com estas categorias — os dos
 * grupos (sem os «em breve») e os antigos sem grupo. Para as páginas públicas
 * (os serviços do perfil, as páginas de cidade), que falam de serviços.
 */
export function servicosDasCategorias(categorias: readonly string[]): string[] {
  const saida: string[] = [];
  for (const c of normalizarCategorias(categorias)) {
    const g = GRUPO_POR_ID.get(c);
    for (const s of g ? g.servicos : [c]) if (!saida.includes(s)) saida.push(s);
  }
  return saida;
}

/** O nome de uma categoria do profissional: o do grupo, ou o do serviço antigo. */
export function nomeDaCategoria(id: string): string {
  return GRUPO_POR_ID.get(id)?.label ?? NOMES_DOS_SERVICOS[id] ?? id;
}
