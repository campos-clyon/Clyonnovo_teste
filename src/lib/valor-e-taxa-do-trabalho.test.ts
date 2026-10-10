import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ValorETaxaDoTrabalho from "@/components/admin/ValorETaxaDoTrabalho";

// Nos testes o JSX do componente sai como `React.createElement` (o Next
// compila-o de outra maneira), e precisa do `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * O QUE A CLYON GANHA, À VISTA — 10-10-2026.
 *
 * *«Quando eu colocar o valor e marcar a % ele devia já dizer quanto a CLYON
 * vai ganhar.»* Desenha-se o componente a sério e lê-se o que lá está escrito:
 * o #429 da captura, 350 € a 15 %.
 */

const desenhar = (valor: string, taxa: number | null) =>
  renderToStaticMarkup(
    createElement(ValorETaxaDoTrabalho, { valor, taxa, onValor: () => {}, onTaxa: () => {} }),
  ).replace(/<!-- -->/g, "");

describe("com o valor escrito", () => {
  it("cada taxa diz o que a CLYON ganha com ela, antes de se escolher", () => {
    const html = desenhar("350", null);
    expect(html).toContain("CLYON 35,00 €");
    expect(html).toContain("CLYON 52,50 €");
    expect(html).toContain("CLYON 70,00 €");
    // Sem taxa escolhida ainda não há resumo.
    expect(html).not.toContain("A CLYON ganha");
  });

  it("a taxa escolhida dá os três números, o da CLYON primeiro", () => {
    const html = desenhar("350", 0.15);
    const clyon = html.indexOf("A CLYON ganha");
    const pro = html.indexOf("O profissional recebe");
    const cliente = html.indexOf("O cliente paga");
    expect(clyon).toBeGreaterThan(-1);
    expect(pro).toBeGreaterThan(clyon);
    expect(cliente).toBeGreaterThan(pro);
    expect(html.slice(clyon, pro)).toContain("52,50 €");
    expect(html.slice(pro, cliente)).toContain("297,50 €");
    // O cliente paga com IVA: 350 € + 23 %.
    expect(html.slice(cliente)).toContain("430,50 €");
    expect(html).toContain("ganhos estimados de 297,50 €");
  });
});

describe("sem valor", () => {
  it("não há números para mostrar — nem nas taxas", () => {
    const html = desenhar("", 0.2);
    expect(html).not.toContain("CLYON 70,00 €");
    expect(html).not.toContain("A CLYON ganha");
  });
});
