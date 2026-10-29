/**
 * PARA ONDE VAI A APP QUANDO ELE TOCA NUM AVISO OU NUM LINK.
 *
 * Os avisos do site trazem `{url, tag, negociacaoId}` (ver `push-nativo.ts` no
 * site). O `negociacaoId` é o caminho directo para o trabalho; o resto é para
 * avisos antigos e para os links do WhatsApp e do email, que apontam para
 * páginas do site (`/profissionais/pedidos/<token>`, `/profissionais/painel`).
 * O token desses links não diz qual é o trabalho, por isso abrem a lista.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export type Destino =
  | { tipo: "trabalho"; negociacaoId: number }
  | { tipo: "pedido"; pedidoId: number }
  | { tipo: "lista" };

function inteiroPositivo(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

export function destinoDoAviso(dados: unknown): Destino {
  const d = (dados ?? {}) as { negociacaoId?: unknown; tag?: unknown };
  const id = inteiroPositivo(d.negociacaoId);
  if (id) return { tipo: "trabalho", negociacaoId: id };
  const contratado = typeof d.tag === "string" ? /^contratado-(\d+)$/.exec(d.tag) : null;
  if (contratado) return { tipo: "pedido", pedidoId: Number(contratado[1]) };
  return { tipo: "lista" };
}

/** O caminho da app para um destino. */
export function caminhoDe(destino: Destino): string {
  if (destino.tipo === "trabalho") return `/trabalho/${destino.negociacaoId}`;
  if (destino.tipo === "pedido") return `/trabalho/pedido-${destino.pedidoId}`;
  return "/";
}

/**
 * Um link de fora (App Link do Android, Universal Link do iPhone) traduzido
 * para um caminho da app. Tudo o que é do painel do profissional abre a
 * lista; qualquer outra coisa também — nunca um ecrã de erro.
 *
 * O link de um pedido (`/profissionais/pedidos/<token>`, versão 12) abre o
 * ecrã `abrir/<token>`, que pergunta ao site qual é o trabalho e o abre.
 *
 * O painel com `?ecra=` e `&trabalho=` (29-10-2026, A12) abre a secção ou o
 * trabalho correspondente — ver `caminhoDoPainel`.
 *
 * O link do email para escolher a palavra-passe
 * (`/profissionais/definir-senha/<token>`, desde 20-10-2026) abre o ecrã da
 * app que faz o mesmo, com o mesmo token.
 */
export function caminhoDoLink(entrada: string): string {
  try {
    const url = new URL(entrada, "clyonpro://app");
    const trabalho = /^\/trabalho\/([\w-]+)$/.exec(url.pathname);
    if (trabalho) return url.pathname;
    if (/^\/profissionais\/painel\/?$/.test(url.pathname)) return caminhoDoPainel(url.searchParams);
    const pedido = /^\/profissionais\/pedidos\/([\w-]+)\/?$/.exec(url.pathname);
    if (pedido) return `/abrir/${pedido[1]}`;
    const senha = /^\/(?:profissionais\/)?definir-senha\/([\w-]+)\/?$/.exec(url.pathname);
    if (senha) return `/definir-senha/${senha[1]}`;
    return "/";
  } catch {
    return "/";
  }
}

/**
 * AS SECÇÕES DO PAINEL NA APP — 29-10-2026 (A12 da especificação v3).
 *
 * O painel guarda a secção aberta no endereço (`?ecra=carteira`) e o trabalho
 * aberto também (`&trabalho=<negociacaoId>`); os emails e os avisos usam-nos.
 * Na app, cada secção tem o seu ecrã. Uma secção que a app não conheça abre a
 * lista dos trabalhos.
 */
export const ECRA_DO_PAINEL_NA_APP: Record<string, string> = {
  menu: "/conta",
  trabalhos: "/",
  agenda: "/agenda",
  carteira: "/carteira",
  historico: "/carteira/historico",
  avaliacoes: "/conta/avaliacoes",
  ajuda: "/conta/ajuda",
  "como-funciona": "/conta/como-funciona",
  dados: "/conta/perfil",
  servicos: "/conta/servicos",
  faturacao: "/conta/faturacao",
  banco: "/conta/banco",
  seguranca: "/conta/palavra-passe",
};

export function caminhoDoPainel(params: URLSearchParams): string {
  const trabalho = inteiroPositivo(params.get("trabalho"));
  if (trabalho) return `/trabalho/${trabalho}`;
  const ecra = params.get("ecra");
  return (ecra && ECRA_DO_PAINEL_NA_APP[ecra]) || "/";
}

/**
 * O CAMINHO QUE PRECISA DE SESSÃO — 29-10-2026 (A12).
 *
 * Um link aberto sem sessão (o pedido no WhatsApp com a app acabada de
 * instalar, ou depois de sair) caía no «Entrar», e depois de entrar a app
 * abria a lista: o pedido perdia-se. Os caminhos que só existem dentro da
 * sessão ficam guardados e abrem-se logo a seguir a entrar
 * (`destino-pendente.ts`). Escolher a palavra-passe não precisa de sessão.
 */
export function precisaDeSessao(caminho: string): boolean {
  if (caminho === "/" || caminho === "") return false;
  return !caminho.startsWith("/definir-senha/");
}
