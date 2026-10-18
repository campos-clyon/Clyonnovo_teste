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
 */
export function caminhoDoLink(entrada: string): string {
  try {
    const url = new URL(entrada, "clyonpro://app");
    const trabalho = /^\/trabalho\/([\w-]+)$/.exec(url.pathname);
    if (trabalho) return url.pathname;
    return "/";
  } catch {
    return "/";
  }
}
