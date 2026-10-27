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
    // Sem taxa escolhida ainda não há conta.
    expect(html).not.toContain("Como fica a conta");
  });

  /*
   * DESDE 15-10-2026 A TAXA ESCOLHIDA DÁ A CONTA EM DEGRAUS (*«seja
   * didático»*): o cliente com IVA, menos o IVA, o sem IVA, menos a taxa com
   * a sua percentagem, o que vai para o profissional — e o que fica para a
   * CLYON por baixo.
   */
  it("a taxa escolhida dá a conta em degraus, de cima para baixo", () => {
    const html = desenhar("350", 0.15);
    const ordem = [
      "Como fica a conta",
      "O cliente paga",
      "430,50 €",
      "IVA",
      "80,50 €",
      "Valor sem IVA",
      "350,00 €",
      "Taxa da plataforma",
      "15 %",
      "52,50 €",
      "A pagar ao profissional",
      "297,50 €",
      "Fica para a CLYON",
      "52,50 €",
    ];
    let desde = 0;
    for (const pedaco of ordem) {
      const i = html.indexOf(pedaco, desde);
      expect(i, pedaco).toBeGreaterThan(-1);
      desde = i;
    }
    expect(html).toContain("Miragem Dourada");
    expect(html).toContain("ganhos estimados de 297,50 €");
  });
});

describe("sem valor", () => {
  it("não há números para mostrar — nem nas taxas", () => {
    const html = desenhar("", 0.2);
    expect(html).not.toContain("CLYON 70,00 €");
    expect(html).not.toContain("Como fica a conta");
  });
});
