import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Botões sem nome, interruptores mudos, e um botão que só existia com rato.
 *
 * Um leitor de ecrã anunciava "botão" três vezes seguidas no seletor de itens
 * sem dizer de quê; os interruptores dos cookies diziam "premido" sem dizer o
 * quê; e o botão de tirar uma fotografia do simulador era `opacity-0` até
 * haver hover — num telemóvel, nunca.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("os interruptores dos cookies", () => {
  it("são interruptores, com estado e nome", () => {
    const COOKIES = ler("src/components/CookieConsent.tsx");
    expect(COOKIES).toContain('role="switch"');
    expect(COOKIES).toContain("aria-checked={enabled}");
    expect(COOKIES).toContain("aria-label={title}");
    expect(COOKIES).not.toContain("aria-pressed={enabled}");
  });
});

describe("as fotografias do simulador", () => {
  const DETALHES = ler("src/app/simulador/components/CompactOrderDetails.tsx");

  it("o botão de remover vê-se num ecrã de toque e tem nome", () => {
    expect(DETALHES).toContain('"Remover fotografia"');
    // Escondido só para quem tem rato — `pointer-fine`.
    expect(DETALHES).toContain("pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100");
    expect(DETALHES).not.toContain("p-0.5 opacity-0 group-hover:opacity-100");
    // 32 px de alvo, e não 14.
    expect(DETALHES).toContain("h-8 w-8");
  });

  it("o rótulo da descrição está ligado à caixa", () => {
    expect(DETALHES).toContain("htmlFor={idDaDescricao}");
    expect(DETALHES).toContain("id={idDaDescricao}");
  });
});

describe("o seletor de itens", () => {
  it("os botões de mais e menos dizem de que é a quantidade", () => {
    const SELETOR = ler("src/app/simulador/components/MovelItemSelector.tsx");
    expect(SELETOR).toContain("aria-label={`Diminuir quantidade de ${nome}`}");
    expect(SELETOR).toContain("aria-label={`Aumentar quantidade de ${nome}`}");
  });
});

describe("a área do cliente", () => {
  it("o recorte da fotografia: fechar e zoom", () => {
    const DADOS = ler("src/app/conta/components/DadosPessoais.tsx");
    for (const nome of ['aria-label="Fechar"', 'aria-label="Diminuir o zoom"', 'aria-label="Aumentar o zoom"']) {
      expect(DADOS).toContain(nome);
    }
  });

  it("a paginação dos pedidos", () => {
    const LISTA = ler("src/app/conta/components/MeusPedidos.tsx");
    expect(LISTA).toContain('aria-label="Página anterior"');
    expect(LISTA).toContain('aria-label="Página seguinte"');
  });

  it("as estrelas da avaliação", () => {
    const DETALHE = ler("src/app/conta/components/OrderDetailModal.tsx");
    expect(DETALHE).toContain('aria-label={`Avaliar com ${star} ${star === 1 ? "estrela" : "estrelas"}`}');
  });
});
