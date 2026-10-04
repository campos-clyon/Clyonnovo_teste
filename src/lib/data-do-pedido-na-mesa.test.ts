import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A DATA DO PEDIDO NA MESA, E O CARTÃO BAIXO — 04-10-2026.
 *
 * "Coloque a data de criação do pedido … em baixo do botão Abrir Pedido."
 * Depois, no mesmo dia: "Estou sentindo os cards muito grossos/altos e as
 * datas de criação muito pequenas; coloque as datas na cor vermelha."
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
// Sem comentários — a regra ancorada ao início da linha (ver
// tirar-comentarios-sem-comer-codigo.test.ts).
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx").replace(
  /^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm,
  "",
);

describe("a data do pedido", () => {
  it("é lida da base como UTC e escrita no relógio de Lisboa", () => {
    expect(MESA).toMatch(
      /function quandoEntrou\(createdAt: string\): string \{\s*const d = instanteDaBase\(createdAt\);\s*return d \? dataEHoraEmLisboa\(d\) : "";\s*\}/,
    );
  });

  it("fica debaixo do botão de abrir, a vermelho e num tamanho que se lê", () => {
    const botao = MESA.indexOf("onClick={alternarAberto}");
    expect(botao).toBeGreaterThan(-1);
    const data = MESA.indexOf("{quandoEntrou(p.createdAt)}", botao);
    expect(data).toBeGreaterThan(botao);
    const entre = MESA.slice(botao, data);
    expect(entre).toContain("</button>");
    expect(entre).toMatch(/className="[^"]*\btext-red-400\b[^"]*"/);
    expect(entre).toMatch(/className="[^"]*\btext-xs\b[^"]*"/);
  });
});

describe("o cartão é baixo", () => {
  it("o «Anotar» mora debaixo do número, e não numa linha só dele no fundo", () => {
    const anotar = [...MESA.matchAll(/^\s*Anotar\s*$/gm)].map((m) => m.index ?? -1);
    expect(anotar).toHaveLength(1);
    const numero = MESA.indexOf("#{p.id}</span>");
    expect(numero).toBeGreaterThan(-1);
    expect(anotar[0]).toBeGreaterThan(numero);
    // E antes da nota escrita, que é o que fica no fundo do cartão.
    expect(anotar[0]).toBeLessThan(MESA.indexOf("p.notasInternas ? ("));
  });
});
