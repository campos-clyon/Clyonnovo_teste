import { tratarLinkDeFora } from "../lib/links";

/**
 * TODOS OS ENDEREÇOS QUE O SISTEMA ABRE NA APP PASSAM AQUI PRIMEIRO.
 *
 * Só dois chegam a um ecrã de link: `https://clyon.pt/entrar/app?t=…` (E1a) e
 * `https://clyon.pt/pedido/<token>` (E1b) — os de clyon.pt, que o Android
 * verifica (App Links). O token fica na memória da app e não no caminho.
 * O esquema próprio (`clyoncliente://…`) e tudo o resto vão para o início.
 * Nunca lança.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return tratarLinkDeFora(path);
  } catch {
    return "/";
  }
}
