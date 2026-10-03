import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CADA SECÇÃO DA MESA TEM A SUA COR, E OS PEDIDOS LEVAM-NA — 03-10-2026.
 *
 * "Quero que mude a cor das caixas dos pedidos, ex. o «À espera de
 * propostas» tem a cor azul clara no nome mas os pedidos estão com as mesmas
 * cores do resto; vamos deixar com a mesma cor, assim vemos melhor quando
 * acaba uma secção e quando começa outra. «A aguardar cliente» coloque na
 * cor laranja."
 *
 * E no mesmo dia, com a paleta dele: "Feitos, à espera de confirmação e A
 * aguardar cliente estão com fundos idênticos, e Precisa de si e Concluídos
 * também estão iguais; coloque cores diferentes, use essa paleta de cores
 * para o backoffice."
 *
 * A paleta vive no `@theme` do globals.css; cada secção usa o tom que a
 * paleta lhe dá, e nenhum tom se repete.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const CSS = ler("src/app/globals.css");

/** Cada bloco da lista BLOCOS, com a cor do título e a dos cartões. */
const BLOCOS = (() => {
  const i = MESA.indexOf("const BLOCOS");
  const lista = MESA.slice(i, MESA.indexOf("\n];", i));
  return lista
    .split(/\bchave: "/)
    .slice(1)
    .map((pedaco) => ({
      chave: pedaco.slice(0, pedaco.indexOf('"')),
      cor: /\bcor: "([^"]+)"/.exec(pedaco)?.[1] ?? "",
      corDoNumero: /\bcorDoNumero: "([^"]+)"/.exec(pedaco)?.[1] ?? "",
      corDoCartao: /\bcorDoCartao: "([^"]+)"/.exec(pedaco)?.[1] ?? "",
    }));
})();

/** O tom de uma lista de classes: «text-laranja-texto …» → «laranja». */
const tomDe = (classes: string) => /\btext-([a-z]+)-texto\b/.exec(classes)?.[1];

/** A paleta do dono, tal como ele a mandou: o texto e o traço do backoffice. */
const PALETA: Record<string, [texto: string, traco: string]> = {
  ciano: ["#67E8F9", "#22D3EE"],
  azul: ["#93C5FD", "#60A5FA"],
  violeta: ["#C4B5FD", "#A78BFA"],
  magenta: ["#F0ABFC", "#E879F9"],
  coral: ["#FDA4AF", "#FB7185"],
  laranja: ["#FDBA74", "#FB923C"],
  ambar: ["#FCD34D", "#FBBF24"],
  lima: ["#BEF264", "#A3E635"],
  esmeralda: ["#6EE7B7", "#34D399"],
  ardosia: ["#CBD5E1", "#94A3B8"],
};

/** O tom que a paleta dá a cada secção da mesa. */
const TOM_DA_SECCAO: Record<string, string> = {
  porConfirmar: "ambar",
  n1: "ciano",
  aguardaCliente: "laranja",
  porEnviar: "magenta",
  n2: "azul",
  n3: "violeta",
  concluidos: "esmeralda",
  cancelados: "ardosia",
};

describe("a paleta do backoffice está no tema", () => {
  it("os dez tons, com os valores dele", () => {
    for (const [tom, [texto, traco]] of Object.entries(PALETA)) {
      expect(CSS, tom).toMatch(new RegExp(`--color-${tom}-texto:\\s*${texto};`, "i"));
      expect(CSS, tom).toMatch(new RegExp(`--color-${tom}:\\s*${traco};`, "i"));
    }
  });

  it("dentro do @theme — fora dele não gera classe nenhuma", () => {
    const tema = CSS.slice(CSS.indexOf("@theme {"), CSS.indexOf("\n}", CSS.indexOf("@theme {")));
    for (const tom of Object.keys(PALETA)) expect(tema, tom).toContain(`--color-${tom}:`);
  });
});

describe("os pedidos levam a cor da secção onde estão", () => {
  it("encontra os blocos todos (senão os testes abaixo não provam nada)", () => {
    expect(BLOCOS.map((b) => b.chave).sort()).toEqual(Object.keys(TOM_DA_SECCAO).sort());
  });

  it("cada secção tem o tom que a paleta lhe dá — no título, no número e nos cartões", () => {
    for (const b of BLOCOS) {
      const tom = TOM_DA_SECCAO[b.chave];
      expect(tomDe(b.cor), b.chave).toBe(tom);
      expect(b.cor, b.chave).toContain(`border-${tom}`);
      expect(b.corDoNumero, b.chave).toBe(`text-${tom}-texto`);
      expect(b.corDoCartao, b.chave).toContain(`border-l-${tom}`);
    }
  });

  it("o fundo do cartão é o traço a 14 %, como a paleta manda", () => {
    for (const b of BLOCOS) {
      expect(b.corDoCartao, b.chave).toContain(`bg-${TOM_DA_SECCAO[b.chave]}/14`);
    }
  });

  it("e nenhuma secção repete o fundo de outra — era essa a queixa", () => {
    const fundos = BLOCOS.map((b) => /\bbg-\S+/.exec(b.corDoCartao)?.[0]);
    expect(new Set(fundos).size).toBe(BLOCOS.length);
  });

  it("«A aguardar cliente» é laranja também no separador", () => {
    expect(MESA).toMatch(/bloco\(\s*"aguardaCliente",[^)]*"text-laranja-texto"/);
  });

  it("o cartão recebe a cor do bloco que o desenha", () => {
    expect(MESA).toMatch(/pedidosDoBloco\(b\.chave\)\.map\(\(p\) => cartaoDoPedido\(p, b\.corDoCartao\)\)/);
    expect(MESA).toMatch(/function cartaoDoPedido\(p: Pedido, corDoBloco = "[^"]+"\)/);
  });

  it("e as linhas do «Por enviar», que não são cartões, também a levam", () => {
    expect(MESA).toMatch(
      /const COR_DE_POR_ENVIAR = BLOCOS\.find\(\(b\) => b\.chave === "porEnviar"\)\?\.corDoCartao/,
    );
    expect(MESA).toMatch(/const linha = \(p: PorPromover\) => \(\s*<div\s+key=\{p\.id\}\s+className=\{`[^`]*\$\{COR_DE_POR_ENVIAR\}`\}/);
  });

  it("o traço à esquerda é grosso o bastante para se ver", () => {
    expect(MESA).toContain("scroll-mt-24 rounded-2xl border border-l-4");
  });
});
