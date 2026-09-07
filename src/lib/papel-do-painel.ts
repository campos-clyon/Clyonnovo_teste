/**
 * Os dois papéis que entram no backoffice, e o que cada um pode fazer.
 *
 * ADMINISTRADOR — vê tudo, faz tudo. É a conta que já existia.
 *
 * ASSISTENTE — trabalha no dia a dia da plataforma: pedidos, profissionais,
 * negociações, agenda e WhatsApp. Não vê leads, contas de clientes, suporte,
 * configurações, carteiras nem levantamentos, e não apaga nada — arquiva. A
 * conta é criada, desactivada e reposta pelo administrador, na secção
 * "Assistentes" do painel dele.
 *
 * PORQUE UM FICHEIRO SÓ
 *
 * A mesma lista é lida em três sítios: o middleware (que página abre e que
 * chamada passa), o helper das rotas (segunda tranca, com a base de dados a
 * confirmar que a conta continua activa) e o painel (que secções desenha).
 * Três cópias da mesma lista eram três listas a divergir; a que ficasse
 * esquecida era a que deixava passar.
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
 * As secções do painel que o assistente vê.
 *
 * Os ids são os de `AdminSection` no LegacyAdminClient. "negociacoes_clyon"
 * é o ecrã "Negociações" do menu — o id antigo "negociacoes" ficou a
 * responder a links velhos e não entra aqui.
 */
export const SECCOES_DO_ASSISTENTE = [
  "pedidos",
  "profissionais",
  "negociacoes_clyon",
  "agenda",
  "whatsapp",
] as const;

export type SeccaoDoAssistente = (typeof SECCOES_DO_ASSISTENTE)[number];

export const ROTULO_DA_SECCAO: Record<SeccaoDoAssistente, string> = {
  pedidos: "Pedidos",
  profissionais: "Profissionais",
  negociacoes_clyon: "Negociações",
  agenda: "Agenda",
  whatsapp: "WhatsApp",
};

export function assistentePodeVerSeccao(seccao: string): seccao is SeccaoDoAssistente {
  return (SECCOES_DO_ASSISTENTE as readonly string[]).includes(seccao);
}

/**
 * Limpa uma lista de secções vinda de fora — do formulário do administrador
 * ou da coluna JSON na base. Fica só o que existe, sem repetidos, na ordem
 * do menu. `null` ou lista vazia quer dizer "todas": uma conta sem nenhuma
 * secção não serve para nada, e é mais provável ser um esquecimento do que
 * uma intenção.
 */
export function normalizarSeccoes(bruto: unknown): SeccaoDoAssistente[] {
  if (!Array.isArray(bruto)) return [...SECCOES_DO_ASSISTENTE];
  const pedidas = new Set(bruto.filter((s): s is string => typeof s === "string"));
  const limpas = SECCOES_DO_ASSISTENTE.filter((s) => pedidas.has(s));
  return limpas.length > 0 ? limpas : [...SECCOES_DO_ASSISTENTE];
}

/** Uma secção é visível para este papel? O administrador vê todas. */
export function papelPodeVerSeccao(papel: PapelDoPainel, seccao: string): boolean {
  return papel === "admin" || assistentePodeVerSeccao(seccao);
}

/**
 * As páginas de /admin que o assistente pode abrir.
 *
 * Só a dele. As outras — /admin, /admin/app-clyon/*, /admin/imagens,
 * /admin/metricas… — são do administrador; quem lá chegar com sessão de
 * assistente volta ao painel de assistente.
 */
export function assistentePodeAbrirPagina(pathname: string): boolean {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  return limpo === PAGINA_INICIAL.assistente || limpo === "/admin/login";
}

/**
 * As rotas de API que servem as cinco secções do assistente.
 *
 * Escritas como lista de prefixos, e não como "tudo menos": uma rota criada
 * amanhã nasce fechada ao assistente até alguém a pôr aqui de propósito.
 *
 * /api/admin/convites está aqui porque o painel de convites vive DENTRO da
 * secção Profissionais — convidar um profissional é parte de gerir
 * profissionais. /api/admin/fotos é o proxy das fotografias dos pedidos.
 */
const PREFIXOS_DE_API_DO_ASSISTENTE = [
  "/api/admin/pedidos",
  "/api/admin/profissionais",
  "/api/admin/convites",
  "/api/admin/negociacoes",
  "/api/admin/agenda",
  "/api/admin/whatsapp",
  "/api/admin/fotos",
  "/api/admin/sessao",
] as const;

/**
 * Que secções dão acesso a cada rota — para o assistente a quem o
 * administrador tirou secções.
 *
 * Uma rota pode ser servida por mais do que uma secção: o painel de
 * negociações abre o detalhe do pedido (rota dos pedidos) e a ficha da agenda
 * corrige o valor de um trabalho (rota das negociações). Quem tem QUALQUER uma
 * das secções listadas passa. Uma rota sem entrada aqui — a sessão, por
 * exemplo — é de todos os assistentes.
 */
const SECCOES_QUE_ABREM: Array<{ prefixo: string; seccoes: SeccaoDoAssistente[] }> = [
  { prefixo: "/api/admin/negociacoes/valor", seccoes: ["negociacoes_clyon", "agenda"] },
  { prefixo: "/api/admin/negociacoes", seccoes: ["negociacoes_clyon"] },
  { prefixo: "/api/admin/pedidos", seccoes: ["pedidos", "negociacoes_clyon", "agenda"] },
  { prefixo: "/api/admin/fotos", seccoes: ["pedidos", "negociacoes_clyon", "agenda"] },
  { prefixo: "/api/admin/profissionais", seccoes: ["profissionais"] },
  { prefixo: "/api/admin/convites", seccoes: ["profissionais"] },
  { prefixo: "/api/admin/agenda", seccoes: ["agenda"] },
  { prefixo: "/api/admin/whatsapp", seccoes: ["whatsapp"] },
];

/** As secções que abrem esta rota; vazio quer dizer "qualquer assistente". */
export function seccoesQueAbrem(pathname: string): SeccaoDoAssistente[] {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  // A primeira entrada que casa ganha — as mais específicas vêm primeiro.
  return SECCOES_QUE_ABREM.find((e) => comecaPor(limpo, e.prefixo))?.seccoes ?? [];
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
  const precisas = seccoesQueAbrem(pathname);
  return precisas.length === 0 || precisas.some((s) => seccoes.includes(s));
}

/**
 * O que fica fechado mesmo dentro dos prefixos de cima.
 *
 * Apagar é do administrador: um pedido apagado não volta, e o assistente
 * tem sempre o arquivar à mão para o mesmo efeito visível.
 */
const ROTAS_FECHADAS_AO_ASSISTENTE = ["/api/admin/negociacoes/apagar"] as const;

function comecaPor(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(prefixo + "/");
}

export function assistentePodeChamar(pathname: string, method: string): boolean {
  const metodo = method.toUpperCase();
  // Nenhum DELETE, em rota nenhuma. Ver acima.
  if (metodo === "DELETE") return false;
  const limpo = pathname.replace(/\/+$/, "") || "/";
  if (ROTAS_FECHADAS_AO_ASSISTENTE.some((r) => comecaPor(limpo, r))) return false;
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
