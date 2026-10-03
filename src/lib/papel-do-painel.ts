/**
 * Os dois papéis que entram no backoffice, e o que cada um pode fazer.
 *
 * ADMINISTRADOR — vê tudo, faz tudo. É a conta que já existia.
 *
 * ASSISTENTE — vê as secções que o administrador lhe der, uma a uma, na
 * secção "Assistentes" do painel dele. A conta é criada, desactivada e reposta
 * lá. Não apaga nada — arquiva — e nunca vê a gestão de assistentes.
 *
 * 03-10-2026, decisão do dono: a lista do que se pode dar a um assistente
 * deixou de ser as seis secções do dia a dia (pedidos, profissionais,
 * negociações, agenda, WhatsApp, suporte) e passou a ser TODO o menu do
 * backoffice menos «Assistentes». Uma conta NOVA nasce sem nenhuma — o
 * administrador marca as que quer. As contas que já existiam ficam com o que
 * tinham: ver `seccoesGuardadas` e `SECCOES_DAS_CONTAS_ANTIGAS`.
 *
 * PORQUE UM FICHEIRO SÓ
 *
 * A mesma lista é lida em três sítios: o middleware (que página abre e que
 * chamada passa), o helper das rotas (segunda tranca, com a base de dados a
 * confirmar que a conta continua activa e que secções tem) e o painel (que
 * secções desenha). Três cópias da mesma lista eram três listas a divergir; a
 * que ficasse esquecida era a que deixava passar.
 *
 * Este módulo é PURO de propósito — sem base de dados, sem `node:` — porque o
 * middleware corre no edge e não pode importar nada disso.
 */

export type PapelDoPainel = "admin" | "assistente";

/** Onde cada papel cai depois de entrar. */
export const PAGINA_INICIAL: Record<PapelDoPainel, string> = {
  admin: "/admin",
  assistente: "/admin/assistente",
};

export function paginaInicialDoPapel(papel: PapelDoPainel): string {
  return PAGINA_INICIAL[papel];
}

/**
 * As secções do painel que se podem dar a um assistente — 03-10-2026.
 *
 * Os ids são os de `AdminSection` no LegacyAdminClient, e a ordem é a do menu
 * (`NAV_GRUPOS`): Operação, Plataforma, Quem contacta, Gerir. Há um teste que
 * compara esta lista com o menu — uma secção nova no menu tem de vir cá dizer
 * se se pode dar ou não.
 *
 * FICAM DE FORA, de propósito:
 *   · "equipa" — a secção «Assistentes». Um assistente a gerir assistentes é
 *     uma conta a multiplicar-se sozinha, e a comissão dele a mudar por ele.
 *   · "negociacoes" — o id antigo do ecrã das negociações, que só responde a
 *     links velhos. O do menu é "negociacoes_clyon".
 *   · "site" — o nome antigo de "configs".
 */
export const SECCOES_DO_ASSISTENTE = [
  "overview",
  "pedidos",
  "app_clyon",
  "profissionais",
  "negociacoes_clyon",
  "trabalhos_clyon",
  "agenda",
  "whatsapp",
  "carteiras",
  "pagamentos",
  "levantamentos",
  "leads",
  "contas",
  "suporte",
  "configs",
] as const;

export type SeccaoDoAssistente = (typeof SECCOES_DO_ASSISTENTE)[number];

/**
 * O QUE UMA CONTA COM `seccoesJson = NULL` VÊ — 03-10-2026.
 *
 * Até hoje, NULL queria dizer «todas» — e «todas» eram estas seis. Com a
 * lista a crescer para o menu inteiro, deixar NULL a querer dizer «todas»
 * dava de um dia para o outro carteiras, pagamentos, levantamentos, leads,
 * contas e configurações a quem nunca as teve, sem o administrador carregar em
 * nada. Por isso NULL fica PRESO a este conjunto, escrito à mão e congelado:
 * é o que essas contas viam ontem, e é o que vêem hoje.
 *
 * Não se acrescenta nada aqui. Uma secção nova dá-se a uma conta marcando-a no
 * painel, o que grava a lista dela e deixa de ser NULL.
 */
export const SECCOES_DAS_CONTAS_ANTIGAS: readonly SeccaoDoAssistente[] = [
  "pedidos",
  "profissionais",
  "negociacoes_clyon",
  "agenda",
  "whatsapp",
  "suporte",
];

export const ROTULO_DA_SECCAO: Record<SeccaoDoAssistente, string> = {
  overview: "Início",
  pedidos: "Pedidos",
  app_clyon: "App CLYON",
  profissionais: "Profissionais",
  negociacoes_clyon: "Negociações",
  trabalhos_clyon: "Trabalhos CLYON",
  agenda: "Agenda",
  whatsapp: "WhatsApp",
  carteiras: "Carteiras",
  pagamentos: "Pagamentos",
  levantamentos: "Levantamentos",
  leads: "Leads",
  contas: "Contas",
  suporte: "Suporte",
  configs: "Configs",
};

export function assistentePodeVerSeccao(seccao: string): seccao is SeccaoDoAssistente {
  return (SECCOES_DO_ASSISTENTE as readonly string[]).includes(seccao);
}

/**
 * Limpa uma lista de secções vinda do formulário do administrador. Fica só o
 * que existe, sem repetidos, na ordem do menu.
 *
 * VAZIO QUER DIZER NENHUMA — 03-10-2026. Até aqui, vazio (ou nada) queria
 * dizer «todas», com o argumento de que uma conta sem secções era mais
 * provavelmente um esquecimento. Com o menu inteiro na lista, «todas» passou a
 * ser carteiras, pagamentos e configurações — e um esquecimento não pode dar
 * isso. Quem não marca nada não dá nada.
 */
export function normalizarSeccoes(bruto: unknown): SeccaoDoAssistente[] {
  if (!Array.isArray(bruto)) return [];
  const pedidas = new Set(bruto.filter((s): s is string => typeof s === "string"));
  return SECCOES_DO_ASSISTENTE.filter((s) => pedidas.has(s));
}

/**
 * As secções de uma conta, lidas da coluna `seccoesJson` — 03-10-2026.
 *
 *   · NULL (ou vazio, ou ilegível) → `SECCOES_DAS_CONTAS_ANTIGAS`: as seis de
 *     sempre, e NÃO a lista nova inteira. Ver a nota dessa constante.
 *   · uma lista → só o que nela existe, como o administrador a gravou. Uma
 *     lista vazia é uma conta sem secções.
 *
 * O ilegível cai nas seis, e não em nenhuma, porque era isso que acontecia
 * antes desta mudança: uma conta antiga não pode perder acessos por isto.
 */
export function seccoesGuardadas(json: string | null | undefined): SeccaoDoAssistente[] {
  if (!json) return [...SECCOES_DAS_CONTAS_ANTIGAS];
  let lido: unknown;
  try {
    lido = JSON.parse(json);
  } catch {
    return [...SECCOES_DAS_CONTAS_ANTIGAS];
  }
  return Array.isArray(lido) ? normalizarSeccoes(lido) : [...SECCOES_DAS_CONTAS_ANTIGAS];
}

/** Uma secção é visível para este papel? O administrador vê todas. */
export function papelPodeVerSeccao(papel: PapelDoPainel, seccao: string): boolean {
  return papel === "admin" || assistentePodeVerSeccao(seccao);
}

/**
 * As páginas de /admin que o assistente pode abrir.
 *
 * Só a dele, e as poucas que são extensões do trabalho dela. As outras —
 * /admin, /admin/app-clyon/*, /admin/imagens, /admin/metricas… — são do
 * administrador; quem lá chegar com sessão de assistente volta ao painel de
 * assistente. Todas as secções que se lhe podem dar abrem DENTRO do painel
 * dele, por isso nenhuma precisa de página própria.
 *
 * `/admin/pedido/<id>` é uma dessas extensões: mostra o pedido tal como o
 * cliente o vê, para se conferir o que ele tem à frente. Quem trata das
 * negociações já lê esse pedido todo no painel — ver a mesma coisa pelos olhos
 * do cliente não lhe dá nada de novo, e sem isto o botão "Ver como o cliente"
 * atirava-o de volta para a página inicial sem explicar porquê.
 */
export function assistentePodeAbrirPagina(pathname: string): boolean {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  if (limpo === PAGINA_INICIAL.assistente || limpo === "/admin/login") return true;
  return /^\/admin\/pedido\/\d+$/.test(limpo);
}

/**
 * As rotas de API que servem as secções que se podem dar a um assistente.
 *
 * Escritas como lista de prefixos, e não como "tudo menos": uma rota criada
 * amanhã nasce fechada ao assistente até alguém a pôr aqui de propósito.
 *
 * Esta é a lista do PAPEL — o que o middleware deixa passar a qualquer
 * assistente. Quem decide se ESTE assistente passa é `SECCOES_QUE_ABREM`, no
 * `requireAdmin`, com as secções dele lidas da base.
 *
 * /api/admin/convites está aqui porque o painel de convites vive DENTRO da
 * secção Profissionais — convidar um profissional é parte de gerir
 * profissionais. /api/admin/fotos é o proxy das fotografias dos pedidos.
 *
 * /api/media/gallery (as imagens do site, em Configs) não começa por
 * /api/admin e por isso o middleware não a vê; a tranca dela é a da rota.
 */
export const PREFIXOS_DE_API_DO_ASSISTENTE = [
  // Início — 03-10-2026.
  "/api/admin/resumo",
  "/api/admin/pedidos",
  "/api/admin/fotos",
  // App CLYON — 03-10-2026.
  "/api/admin/app-clyon",
  "/api/admin/app-pedidos",
  "/api/admin/profissionais",
  "/api/admin/convites",
  // As candidaturas do site vivem no mesmo ecrã dos convites, e quem trata de
  // um trata do outro.
  "/api/admin/candidaturas",
  "/api/admin/negociacoes",
  // Trabalhos CLYON — 03-10-2026.
  "/api/admin/trabalhos-clyon",
  "/api/admin/agenda",
  "/api/admin/whatsapp",
  // Carteiras, Pagamentos e Levantamentos — 03-10-2026. Dentro de
  // /api/admin/pagamentos há quatro rotas que continuam só do administrador:
  // ver `ROTAS_FECHADAS_AO_ASSISTENTE`.
  "/api/admin/carteiras",
  "/api/admin/pagamentos",
  "/api/admin/levantamentos",
  // Leads e Contas — 03-10-2026.
  "/api/admin/leads",
  "/api/admin/lead-events",
  "/api/admin/users",
  /*
   * O suporte entrou nas SECÇÕES a 21-09-2026 (e em `SECCOES_QUE_ABREM`), mas
   * não aqui — e é esta lista que decide se a chamada passa. O assistente via
   * o separador «Suporte» e cada pedido dele levava 403. As mesmas travas
   * valem aqui: só com a secção dada, e nunca DELETE.
   */
  "/api/admin/suporte",
  // Os pedidos de ajuda «Da plataforma», desenhados no fundo do Suporte —
  // 03-10-2026. Até aqui davam 403 a quem tinha o Suporte.
  "/api/admin/ajuda",
  // Configs — 03-10-2026: as taxas, a retenção e as imagens do site.
  "/api/admin/taxas",
  "/api/admin/retencao",
  "/api/admin/arquivo",
  "/api/media/gallery",
  "/api/admin/sessao",
] as const;

/**
 * As rotas que qualquer assistente chama, tenha as secções que tiver: quem
 * sou eu, e sair. Tudo o resto precisa de uma secção — ver abaixo.
 */
const ROTAS_DE_TODOS_OS_ASSISTENTES = ["/api/admin/sessao"] as const;

type EntradaDaRota = { seccoes: SeccaoDoAssistente[] } & (
  | { prefixo: string }
  | { padrao: RegExp }
);

/**
 * Que secções dão acesso a cada rota.
 *
 * Uma rota pode ser servida por mais do que uma secção: o painel de
 * negociações abre o detalhe do pedido (rota dos pedidos) e a ficha da agenda
 * corrige o valor de um trabalho (rota das negociações). Quem tem QUALQUER uma
 * das secções listadas passa.
 *
 * A primeira entrada que casa ganha — as mais específicas vêm primeiro.
 *
 * UMA ROTA SEM ENTRADA AQUI ESTÁ FECHADA — 03-10-2026. Até aqui, sem entrada
 * queria dizer «qualquer assistente», o que só era seguro enquanto cada
 * prefixo tinha a sua entrada. Agora o «qualquer assistente» é uma lista
 * própria e curta (`ROTAS_DE_TODOS_OS_ASSISTENTES`), e uma rota esquecida
 * nasce fechada em vez de aberta a todos.
 *
 * Cada entrada diz o ecrã que a chama. Há um teste que lê o código de cada
 * secção e confirma que tudo o que ela chama está aqui.
 */
const SECCOES_QUE_ABREM: EntradaDaRota[] = [
  // Início: o resumo do dia.
  { prefixo: "/api/admin/resumo", seccoes: ["overview"] },

  // O valor de um trabalho corrige-se nas negociações, na ficha da agenda, e
  // nas linhas das carteiras e dos pagamentos. Desde 03-10-2026 é escrita só
  // do administrador (`ESCRITAS_SO_DO_ADMINISTRADOR`): a entrada fica para o
  // dia em que a rota tiver uma leitura.
  { prefixo: "/api/admin/negociacoes/valor", seccoes: ["negociacoes_clyon", "agenda", "carteiras", "pagamentos"] },
  // Registar um pedido e mandá-lo aos profissionais (`RegistarPedido`) vive nas
  // negociações, nos pedidos (o detalhe do pedido), na agenda e nos Trabalhos
  // CLYON.
  { prefixo: "/api/admin/negociacoes/promover", seccoes: ["negociacoes_clyon", "pedidos", "agenda", "trabalhos_clyon"] },
  // Cancelar um pedido (`CancelarPedido`) está nas negociações e na ficha da agenda.
  { prefixo: "/api/admin/negociacoes/cancelar", seccoes: ["negociacoes_clyon", "agenda"] },
  { prefixo: "/api/admin/negociacoes", seccoes: ["negociacoes_clyon"] },

  // `RegistarPedido` cria, lê e edita o pedido — também nos Trabalhos CLYON.
  { prefixo: "/api/admin/pedidos/criar", seccoes: ["pedidos", "negociacoes_clyon", "agenda", "trabalhos_clyon"] },
  { padrao: /^\/api\/admin\/pedidos\/\d+(\/editar)?$/, seccoes: ["pedidos", "negociacoes_clyon", "agenda", "trabalhos_clyon"] },
  { prefixo: "/api/admin/pedidos", seccoes: ["pedidos", "negociacoes_clyon", "agenda"] },
  { prefixo: "/api/admin/fotos", seccoes: ["pedidos", "negociacoes_clyon", "agenda"] },

  { prefixo: "/api/admin/app-clyon", seccoes: ["app_clyon"] },
  { prefixo: "/api/admin/app-pedidos", seccoes: ["app_clyon"] },

  // A LISTA dos profissionais serve também os Trabalhos CLYON, para escolher
  // a quem oferecer. Mexer num profissional é só de quem tem Profissionais.
  { padrao: /^\/api\/admin\/profissionais$/, seccoes: ["profissionais", "trabalhos_clyon"] },
  { prefixo: "/api/admin/profissionais", seccoes: ["profissionais"] },
  { prefixo: "/api/admin/convites", seccoes: ["profissionais"] },
  { prefixo: "/api/admin/candidaturas", seccoes: ["profissionais"] },

  { prefixo: "/api/admin/trabalhos-clyon", seccoes: ["trabalhos_clyon"] },
  { prefixo: "/api/admin/agenda", seccoes: ["agenda"] },
  { prefixo: "/api/admin/whatsapp", seccoes: ["whatsapp"] },

  { prefixo: "/api/admin/carteiras", seccoes: ["carteiras"] },
  // Nos pagamentos, só a lista e as duas anotações do ecrã. As outras rotas
  // de /api/admin/pagamentos não têm entrada — ficam fechadas.
  { padrao: /^\/api\/admin\/pagamentos$/, seccoes: ["pagamentos"] },
  { prefixo: "/api/admin/pagamentos/recebido", seccoes: ["pagamentos"] },
  { prefixo: "/api/admin/pagamentos/pago-ao-profissional", seccoes: ["pagamentos"] },
  { prefixo: "/api/admin/levantamentos", seccoes: ["levantamentos"] },

  { prefixo: "/api/admin/leads", seccoes: ["leads"] },
  { prefixo: "/api/admin/lead-events", seccoes: ["leads"] },
  { prefixo: "/api/admin/users", seccoes: ["contas"] },

  { prefixo: "/api/admin/suporte", seccoes: ["suporte"] },
  { prefixo: "/api/admin/ajuda", seccoes: ["suporte"] },

  { prefixo: "/api/admin/taxas", seccoes: ["configs"] },
  { prefixo: "/api/admin/retencao", seccoes: ["configs"] },
  { prefixo: "/api/admin/arquivo", seccoes: ["configs"] },
  { prefixo: "/api/media/gallery", seccoes: ["configs"] },
];

function casa(entrada: EntradaDaRota, limpo: string): boolean {
  return "prefixo" in entrada ? comecaPor(limpo, entrada.prefixo) : entrada.padrao.test(limpo);
}

/** As secções que abrem esta rota; vazio quer dizer FECHADA a assistentes. */
export function seccoesQueAbrem(pathname: string): SeccaoDoAssistente[] {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  return SECCOES_QUE_ABREM.find((e) => casa(e, limpo))?.seccoes ?? [];
}

/** Rotas que qualquer assistente chama, sem precisar de secção. */
export function rotaDeTodosOsAssistentes(pathname: string): boolean {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  return ROTAS_DE_TODOS_OS_ASSISTENTES.some((r) => comecaPor(limpo, r));
}

/**
 * A verificação completa para um assistente concreto: a lista geral do papel
 * E as secções que o administrador lhe deu.
 */
export function assistenteComSeccoesPodeChamar(
  seccoes: readonly string[],
  pathname: string,
  method: string,
): boolean {
  if (!assistentePodeChamar(pathname, method)) return false;
  if (rotaDeTodosOsAssistentes(pathname)) return true;
  const precisas = seccoesQueAbrem(pathname);
  return precisas.some((s) => seccoes.includes(s));
}

/**
 * O que fica fechado mesmo dentro dos prefixos de cima — seja qual for a
 * secção.
 *
 * Apagar é do administrador: um pedido apagado não volta, e o assistente
 * tem sempre o arquivar à mão para o mesmo efeito visível.
 *
 * Dentro de /api/admin/pagamentos (03-10-2026), quatro rotas que não são do
 * ecrã dos Pagamentos ou que o dono reservou para si:
 *   · criar / conferir — gerar e conferir a referência euPago de um pedido
 *     («Vamos colocar apenas para o admin gerar as referências», 18-09-2026);
 *   · excluir — tirar um trabalho dos pagamentos, que já era só do
 *     administrador e com motivo;
 *   · testar — a prova da chave do euPago, que é configuração.
 */
const ROTAS_FECHADAS_AO_ASSISTENTE = [
  "/api/admin/negociacoes/apagar",
  "/api/admin/pagamentos/criar",
  "/api/admin/pagamentos/conferir",
  "/api/admin/pagamentos/excluir",
  "/api/admin/pagamentos/testar",
] as const;

/**
 * «SÓ VER NESSAS SECÇÕES» — 03-10-2026, decisão do dono.
 *
 * Nas Carteiras, nos Pagamentos, nos Levantamentos, na App CLYON e nas
 * Configs, o assistente VÊ tudo e não mexe em nada que seja dinheiro ou
 * taxas. Nestas rotas só passa a LEITURA (GET); qualquer escrita é do
 * administrador. As rotas repetem a tranca do lado delas (`requireAdminGeral`
 * nos métodos de escrita), e o painel não mostra os botões ao assistente
 * (`papelMexeNoDinheiro`).
 *
 * CORRIGIR O VALOR DE UM TRABALHO é dinheiro — é ele que decide o que o
 * cliente paga e o profissional recebe —, e por isso fica só do administrador
 * EM TODO O LADO, também na Agenda.
 *
 * Na App CLYON ficam com o assistente as escritas que não mexem em dinheiro:
 * notas, arquivar, a ficha do profissional, o catálogo (nome, ícone, ordem) e
 * avançar ou mudar o estado de um pedido SEM tocar no preço — essas duas rotas
 * recusam elas próprias, ao assistente, o preço e as fases que o fixam.
 */
const ESCRITAS_SO_DO_ADMINISTRADOR: Array<string | RegExp> = [
  "/api/admin/carteiras",
  "/api/admin/pagamentos",
  "/api/admin/levantamentos",
  "/api/admin/negociacoes/valor",
  "/api/admin/taxas",
  "/api/admin/app-clyon/creditos",
  "/api/admin/app-clyon/credit-fee-rules",
  "/api/admin/app-clyon/cupons",
  "/api/admin/app-clyon/referencias",
  "/api/admin/app-clyon/reservas-por-pagar",
  /^\/api\/admin\/app-pedidos\/[^/]+\/(proposta|motor)$/,
];

/** Esta rota só deixa o assistente ler? */
export function escritaSoDoAdministrador(pathname: string): boolean {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  return ESCRITAS_SO_DO_ADMINISTRADOR.some((r) =>
    typeof r === "string" ? comecaPor(limpo, r) : r.test(limpo),
  );
}

/**
 * Quem mexe em dinheiro e em taxas no backoffice: só o administrador. É o que
 * o painel pergunta antes de desenhar um botão de dinheiro — 03-10-2026.
 */
export function papelMexeNoDinheiro(papel: PapelDoPainel | null | undefined): boolean {
  return papel === "admin";
}

function comecaPor(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(prefixo + "/");
}

export function assistentePodeChamar(pathname: string, method: string): boolean {
  const metodo = method.toUpperCase();
  // Nenhum DELETE, em rota nenhuma. Ver acima.
  if (metodo === "DELETE") return false;
  const limpo = pathname.replace(/\/+$/, "") || "/";
  if (ROTAS_FECHADAS_AO_ASSISTENTE.some((r) => comecaPor(limpo, r))) return false;
  // Só ver, nas rotas de dinheiro e de taxas. Ver acima.
  if (metodo !== "GET" && metodo !== "HEAD" && escritaSoDoAdministrador(limpo)) return false;
  return PREFIXOS_DE_API_DO_ASSISTENTE.some((p) => comecaPor(limpo, p));
}

/**
 * Uma chamada de API é permitida a este papel? O administrador chama tudo.
 */
export function papelPodeChamar(papel: PapelDoPainel, pathname: string, method: string): boolean {
  return papel === "admin" || assistentePodeChamar(pathname, method);
}

/**
 * Os prefixos de API onde a verificação de papel se aplica. Fora disto o
 * middleware não olha para o token de colaborador — as rotas públicas e as
 * dos clientes têm a sua própria autenticação.
 */
export function rotaDeApiDoPainel(pathname: string): boolean {
  return comecaPor(pathname, "/api/admin") || comecaPor(pathname, "/api/colaboradores");
}

export const ROTULO_DO_PAPEL: Record<PapelDoPainel, string> = {
  admin: "Administração",
  assistente: "Assistente",
};
