/*
 * A PÁGINA DO SITE DE ONDE A PESSOA VEIO — 31-10-2026 (d6 de 28-10).
 *
 * Para a candidatura dizer de onde veio quem a enviou (a página inicial, o
 * rodapé de uma página de cidade, /profissionais/entrar…). O `document.referrer`
 * não serve: no Next.js a navegação entre páginas não recarrega o documento, e
 * ele fica a dizer o site de onde se entrou, não a página anterior.
 *
 * `OrigemECliques` (no layout, em todas as páginas) regista cada caminho por
 * onde a pessoa passa nesta visita; quem precisa lê a anterior. Fica na
 * sessão do browser — fecha-se o separador, e vai-se.
 */

const ACTUAL = "clyon_pagina_actual";
const ANTERIOR = "clyon_pagina_anterior";

/** Um caminho do site, sem endereço, pesquisa nem âncora; o resto não serve. */
export function caminhoDoSite(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.split(/[?#]/)[0].trim().slice(0, 200);
  return /^\/[\w\-./]*$/.test(c) ? c : null;
}

/** Chamar a cada página vista. Um recarregar da mesma página não conta. */
export function registarPagina(caminho: string): void {
  const c = caminhoDoSite(caminho);
  if (!c) return;
  try {
    const actual = window.sessionStorage.getItem(ACTUAL);
    if (actual === c) return;
    if (actual) window.sessionStorage.setItem(ANTERIOR, actual);
    window.sessionStorage.setItem(ACTUAL, c);
  } catch {
    /* sem armazenamento: a candidatura vai sem a página anterior */
  }
}

/** A página do site vista antes desta, nesta visita; null se entrou por esta. */
export function paginaAnterior(): string | null {
  try {
    return caminhoDoSite(window.sessionStorage.getItem(ANTERIOR));
  } catch {
    return null;
  }
}
