/**
 * OS LINKS DE FORA QUE ABREM A APP — e só estes dois (versão 2, 28-10-2026).
 *
 * 1. `https://clyon.pt/entrar/app?t=…` — o link de entrada pedido NA APP, que
 *    chega por email. Abre o ecrã «Confirmar a entrada» (E1a), que pergunta ao
 *    site de quem é a conta e espera por um toque em «Entrar».
 * 2. `https://clyon.pt/pedido/<token>` — o link de um pedido (email, ou o
 *    WhatsApp quando a equipa o envia). Abre o E1b, que pergunta ao site se o
 *    pedido é desta conta ou se se pode juntar a ela.
 *
 * TUDO O RESTO VAI PARA O INÍCIO, e em especial o esquema próprio da app
 * (`clyoncliente://…`): qualquer app do telemóvel pode abrir um endereço desses,
 * e só os de `https://clyon.pt` passam pela verificação do Android (App Links,
 * `autoVerify`). O esquema fica para o desenvolvimento e a navegação interna.
 *
 * O TOKEN NÃO VAI NO CAMINHO: fica na memória deste módulo (`linkPendente`) e o
 * ecrã tira-o daqui. Assim nem um `clyoncliente://entrar/confirmar?t=…` feito à
 * mão chega a um ecrã com um token — o ecrã só confia no que o
 * `+native-intent.tsx` guardou depois de ver que o link era de clyon.pt. Nunca
 * se grava no telemóvel: fechar a app esquece-o.
 *
 * Puro de propósito (sem Expo nem React Native): os testes do site importam-no.
 */

export const ORIGEM_DO_SITE = "https://clyon.pt";
export const CAMINHO_DA_ENTRADA = "/entrar/app";
export const PREFIXO_DO_PEDIDO = "/pedido/";

/** Os ecrãs da app que estes links abrem — nomes que não são os caminhos do site. */
export const ECRA_DA_ENTRADA = "/entrar/confirmar";
export const ECRA_DO_PEDIDO_DO_LINK = "/pedido-do-link";
export const INICIO = "/";

/** Os tokens do site são base64url (o da entrada tem 43 caracteres; o do pedido, até 200). */
const FORMA_DO_TOKEN = /^[A-Za-z0-9_-]{1,200}$/;

export type LinkDeFora =
  | { tipo: "entrada"; token: string }
  | { tipo: "pedido"; token: string }
  | { tipo: "inicio" };

const INICIO_DE_FORA: LinkDeFora = { tipo: "inicio" };

function parametro(consulta: string, nome: string): string | null {
  for (const par of consulta.split("&")) {
    const i = par.indexOf("=");
    const chave = i < 0 ? par : par.slice(0, i);
    if (chave !== nome) continue;
    try {
      return decodeURIComponent((i < 0 ? "" : par.slice(i + 1)).replace(/\+/g, " "));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Lê um endereço que o sistema quer abrir na app. Sem `URL` de propósito: a
 * regra é a mesma no Node dos testes e no Hermes do telemóvel.
 *
 * Só `https://clyon.pt` em minúsculas ou maiúsculas, sem porta, sem utilizador
 * e sem nada colado ao nome (`clyon.pt.outro.pt`, `clyon.pt@outro.pt` não são).
 */
export function lerLinkDeFora(entrada: string): LinkDeFora {
  if (typeof entrada !== "string") return INICIO_DE_FORA;
  const m = /^https:\/\/clyon\.pt(\/[^?#]*)?(?:\?([^#]*))?(?:#.*)?$/i.exec(entrada.trim());
  if (!m) return INICIO_DE_FORA;
  const caminho = (m[1] ?? "/").replace(/\/+$/, "") || "/";
  const consulta = m[2] ?? "";

  if (caminho === CAMINHO_DA_ENTRADA) {
    const t = parametro(consulta, "t");
    // Um link sem «t», ou com um «t» que não é um token, também abre o E1a:
    // o site diz a frase certa («Falta o link», «Este link não é válido»).
    return { tipo: "entrada", token: t && FORMA_DO_TOKEN.test(t) ? t : "" };
  }

  const pedido = /^\/pedido\/([^/]+)$/.exec(caminho);
  if (pedido && FORMA_DO_TOKEN.test(pedido[1])) return { tipo: "pedido", token: pedido[1] };

  return INICIO_DE_FORA;
}

/* ─── A memória do link (nunca gravada) ───────────────────────────────────── */

let entradaPendente: string | null = null;
let pedidoPendente: string | null = null;

/**
 * O que o `+native-intent.tsx` faz com cada endereço: guarda o token (só se o
 * link for de clyon.pt) e devolve o ecrã da app, sem o token.
 */
export function tratarLinkDeFora(entrada: string): string {
  const link = lerLinkDeFora(entrada);
  if (link.tipo === "entrada") {
    entradaPendente = link.token;
    return ECRA_DA_ENTRADA;
  }
  if (link.tipo === "pedido") {
    pedidoPendente = link.token;
    return ECRA_DO_PEDIDO_DO_LINK;
  }
  return INICIO;
}

/** O token do link de entrada que abriu a app, ou `null` (nenhum, ou já tratado). `""` = link sem token. */
export const linkDeEntradaPendente = (): string | null => entradaPendente;
export function esquecerLinkDeEntrada(): void {
  entradaPendente = null;
}

/** O token do link do pedido que abriu a app — só para a R10, nunca para ler o pedido. */
export const linkDoPedidoPendente = (): string | null => pedidoPendente;
export function esquecerLinkDoPedido(): void {
  pedidoPendente = null;
}

/** Os endereços do site para abrir no navegador («Ver no navegador»). */
export const enderecoDoPedidoNoSite = (token: string) => `${ORIGEM_DO_SITE}${PREFIXO_DO_PEDIDO}${encodeURIComponent(token)}`;

/* ─── Os avisos no telemóvel ──────────────────────────────────────────────── */

/**
 * Para onde vai a app quando o cliente toca num aviso: os avisos do cliente
 * trazem `{ pedidoId, tipo, negociacaoId? }` nos dados (R6, S10) e abrem esse
 * pedido. Sem `pedidoId` (os avisos de antes), abre a lista.
 */
export function caminhoDoAviso(dados: unknown): string {
  const d = (dados ?? {}) as { pedidoId?: unknown };
  const v = typeof d.pedidoId === "string" ? Number(d.pedidoId) : d.pedidoId;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? `/pedido/${v}` : INICIO;
}
