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
 * Os títulos já tinham cor; os cartões eram todos cinzentos, e numa lista
 * comprida não se via onde uma secção acabava. Agora cada cartão traz a
 * borda, o traço à esquerda e um fundo levemente tingido na cor do título.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

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
      corDoCartao: /\bcorDoCartao: "([^"]+)"/.exec(pedaco)?.[1] ?? "",
    }));
})();

/** O tom de uma lista de classes: «text-orange-300 …» → «orange». */
const tomDe = (classes: string) => /\btext-([a-z]+)-\d+/.exec(classes)?.[1];

describe("os pedidos levam a cor da secção onde estão", () => {
  it("encontra os blocos todos (senão os testes abaixo não provam nada)", () => {
    expect(BLOCOS.map((b) => b.chave)).toEqual(
      expect.arrayContaining(["porConfirmar", "n1", "aguardaCliente", "n2", "n3", "concluidos"]),
    );
  });

  it("todo o bloco tem uma cor para os cartões", () => {
    for (const b of BLOCOS) expect(b.corDoCartao, b.chave).not.toBe("");
  });

  it("e é a mesma cor do título — o traço à esquerda diz em que secção se está", () => {
    for (const b of BLOCOS) {
      const tom = tomDe(b.cor);
      expect(tom, b.chave).toBeTruthy();
      expect(b.corDoCartao, b.chave).toContain(`border-l-${tom}-`);
    }
  });

  it("«À espera de propostas» é azul claro, como o título", () => {
    const n2 = BLOCOS.find((b) => b.chave === "n2");
    expect(n2?.cor).toMatch(/^text-sky-/);
    expect(n2?.corDoCartao).toMatch(/\bborder-l-sky-/);
  });

  it("«A aguardar cliente» passou a laranja — no bloco e no separador", () => {
    const a = BLOCOS.find((b) => b.chave === "aguardaCliente");
    expect(a?.cor).toMatch(/^text-orange-/);
    expect(a?.corDoCartao).toMatch(/\bborder-l-orange-/);
    expect(MESA).toMatch(/bloco\(\s*"aguardaCliente",[^)]*"text-orange-300"/);
    expect(MESA).not.toMatch(/bloco\(\s*"aguardaCliente",[^)]*"text-cyan-/);
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
