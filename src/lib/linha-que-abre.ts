import type { KeyboardEvent, MouseEvent } from "react";

/**
 * A LINHA ABRE AO CLIQUE — 09-10-2026.
 *
 * *«Remova os botões abrir; clicar no pedido já deve abrir, sem um botão. Faça
 * isso em todo o backoffice.»* O botão «Abrir» era um alvo de meio centímetro
 * no canto de uma linha que, ela própria, não fazia nada ao clique.
 *
 * Duas coisas NÃO abrem a linha:
 *
 *   · o clique num controlo de dentro dela — a caixa de marcar, o telefone, um
 *     botão de acção: esse clique é do controlo;
 *   · o clique que acaba com texto seleccionado lá dentro. Quem arrasta para
 *     copiar um número de telefone não quer abrir o pedido.
 *
 * É o padrão que a Agenda já tinha («o resto da linha abre»), num sítio só.
 */

const CONTROLOS = "a, button, input, select, textarea, label, summary, [role='button'], [contenteditable='true']";

type ComoElemento = {
  closest?: (seletor: string) => unknown;
};
// Em forma de método: o `contains` do DOM pede um Node, e assim o HTMLElement serve.
type ComoLinha = { contains(outro: unknown): boolean };
type Seleccao = { isCollapsed: boolean; toString: () => string; anchorNode: unknown } | null;

/** Este clique é para abrir a linha? */
export function cliqueParaAbrir(alvo: unknown, linha: ComoLinha, seleccao: Seleccao = seleccaoActual()): boolean {
  const el = alvo as ComoElemento | null;
  if (el && typeof el.closest === "function") {
    const controlo = el.closest(CONTROLOS);
    if (controlo && controlo !== linha && linha.contains(controlo)) return false;
  }
  if (seleccao && !seleccao.isCollapsed && seleccao.toString().trim() && linha.contains(seleccao.anchorNode)) {
    return false;
  }
  return true;
}

function seleccaoActual(): Seleccao {
  return typeof window === "undefined" ? null : window.getSelection();
}

/**
 * O que se espalha na linha que abre: o clique, o teclado (Enter e espaço) e o
 * nome para quem lê o ecrã com um leitor.
 */
export function linhaQueAbre(abrir: () => void, rotulo: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": rotulo,
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (cliqueParaAbrir(e.target, e.currentTarget)) abrir();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // Só quando o foco está na própria linha: Enter num botão de dentro é dele.
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    },
  };
}

/** Numa linha de tabela (`<tr>`) só o clique: o papel de botão desfazia a tabela. */
export function cliqueDeLinhaDeTabela(abrir: () => void) {
  return (e: MouseEvent<HTMLElement>) => {
    if (cliqueParaAbrir(e.target, e.currentTarget)) abrir();
  };
}
