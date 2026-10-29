import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comIvaEscrito, referenciaDoEntulho, semIvaEscrito } from "./quanto-custa";
import { servicoParaOModelo } from "./nome-do-servico-no-orcamento";

// Nos testes o JSX das páginas sai como `React.createElement`, e precisa do
// `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * O QUE FALTAVA DA MANUTENÇÃO E DO IVA — 25-10-2026.
 *
 * Depois de manutencao-em-todo-o-lado-fecho.test.ts ficaram quatro sítios:
 *   1. na /sobre-nos, o FAQ «O que é a CLYON?», o parágrafo do herói, o
 *      cartão «Empresas e escritórios» e o convite aos profissionais ainda
 *      só falavam de recolhas, esvaziamentos e mudanças;
 *   2. a pesquisa de preços do orçamento recebia o código cru do serviço
 *      («manutencao_casa») e não contava com a manutenção;
 *   3. as /regioes não mudavam de data quando a introdução de uma região
 *      mudava em seo-data.ts;
 *   4. no hub /servicos, o exemplo do entulho dizia «desde N €, sem IVA»
 *      sozinho, e a frase do rodapé do cartão empurrava o «Ver mais» para
 *      duas linhas a 375 px.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** O texto que se vê, sem etiquetas nem entidades do HTML. */
const textoDe = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

/* Importar uma página custa uns segundos no meio da suite: prazo largo. */
const PRAZO = 120_000;

describe("1. a /sobre-nos diz a manutenção da casa onde só dizia três serviços", () => {
  it("o FAQ «O que é a CLYON?»", () => {
    const codigo = semComentarios(ler("src/app/sobre-nos/page.tsx"));
    const i = codigo.indexOf('question: "O que é a CLYON?"');
    expect(i).toBeGreaterThan(-1);
    const resposta = codigo.slice(i, codigo.indexOf("\n  },", i));
    expect(resposta).toContain("manutenção da casa");
  });

  it("o parágrafo do herói, logo a seguir ao título", async () => {
    const mod = await import("@/app/sobre-nos/page");
    const html = renderToStaticMarkup(React.createElement(mod.default));
    const heroi = html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/);
    expect(heroi).not.toBeNull();
    const texto = textoDe(heroi![1]);
    expect(texto).toContain("manutenção da casa");
    expect(texto).toContain("parceiros verificados");
  }, PRAZO);

  it("o cartão «Empresas e escritórios»", () => {
    const codigo = semComentarios(ler("src/app/sobre-nos/page.tsx"));
    const linha = codigo.split("\n").find((l) => l.includes('titulo: "Empresas e escritórios"'));
    expect(linha).toBeDefined();
    expect(linha).toMatch(/texto: "[^"]*manutenção[^"]*"/);
  });

  it("e o convite aos profissionais", async () => {
    const mod = await import("@/app/sobre-nos/page");
    const html = renderToStaticMarkup(React.createElement(mod.default));
    const convites = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]).filter((t) => t.startsWith("É profissional de"));
    expect(convites).toHaveLength(1);
    expect(convites[0]).toMatch(/manutenção\?$/);
  }, PRAZO);
});

describe("2. a pesquisa de preços do orçamento", () => {
  const rota = () => semComentarios(ler("src/app/api/simulator/analyze/route.ts"));

  it("recebe o nome legível do serviço, e não o código cru", () => {
    const codigo = rota();
    const linha = codigo.split("\n").find((l) => /const serviceLabel\s*=/.test(l));
    expect(linha).toBeDefined();
    expect(linha).toContain("servicoParaOModelo(order.serviceType)");
    expect(linha).not.toMatch(/=\s*order\.serviceType\s*\?\?/);
    // E o nome que lhe chega da manutenção não tem nada de código.
    expect(servicoParaOModelo("manutencao_casa")).not.toMatch(/_/);
  });

  it("a instrução 3 conta com a manutenção da casa", () => {
    const codigo = rota();
    const i = codigo.indexOf("INSTRUÇÕES IMPORTANTES:");
    expect(i).toBeGreaterThan(-1);
    const terceira = codigo.slice(i).split("\n").find((l) => l.startsWith("3. "));
    expect(terceira).toBeDefined();
    expect(terceira).toContain("manutenção da casa");
    // As de antes continuam lá.
    for (const s of ["recolha de móveis", "recolha de entulho", "mudanças", "esvaziamento de casas"]) {
      expect(terceira, s).toContain(s);
    }
  });
});

describe("3. as /regioes no sitemap", () => {
  it("não levam data: não há uma verdadeira por região (28-10-2026, d1)", () => {
    // Levavam a do git do grupo, que mudava com qualquer linha de seo-data.ts.
    const s = ler("src/app/sitemap.ts");
    const i = s.indexOf("const regionPages");
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, s.indexOf("}));", i))).not.toContain("lastModified");
  });
});

describe("4. o hub /servicos", () => {
  const cartaoDoEntulho = (html: string) => {
    const i = html.indexOf(">Recolha de Entulho</h3>");
    expect(i).toBeGreaterThan(-1);
    return html.slice(i, html.indexOf("</a>", i));
  };

  it("o exemplo do entulho diz o valor com IVA ao lado do sem IVA, os dois da grelha", async () => {
    const r = referenciaDoEntulho(2, "m3");
    expect(r?.valor.tipo).toBe("desde");
    const mod = await import("@/app/servicos/page");
    const texto = textoDe(cartaoDoEntulho(renderToStaticMarkup(React.createElement(mod.default))));
    expect(texto).toContain(`Com 2 m³, a referência é ${semIvaEscrito(r!.valor)} + IVA (${comIvaEscrito(r!.valor)} com IVA).`);
    // O sem IVA sozinho, como estava, não volta.
    expect(texto).not.toMatch(/\d €, sem IVA\./);
  }, PRAZO);

  it("e nenhum dos dois números se escreve à mão", () => {
    const codigo = semComentarios(ler("src/app/servicos/page.tsx"));
    const i = codigo.indexOf("const REFERENCIA_DE_2_M3");
    expect(i).toBeGreaterThan(-1);
    const bloco = codigo.slice(i, codigo.indexOf("})();", i));
    expect(bloco).toContain('referenciaDoEntulho(2, "m3")');
    expect(bloco).toContain("semIvaEscrito(r.valor)");
    expect(bloco).toContain("comIvaEscrito(r.valor)");
    expect(bloco).not.toMatch(/\d+(,\d+)?\s?€/);
  });

  it("a frase do rodapé do cartão do entulho deixa o «Ver mais» numa linha a 375 px", async () => {
    /*
     * Medido em clyon.pt a 375 px (25-10-2026): o rodapé tem 302 px úteis e o
     * «Ver mais» com a seta leva 75; em Plus Jakarta Sans a 14 px, a frase de
     * 40 letras («Restos de obra, sacos e materiais mistos») ocupava 267 px e
     * partia o «Ver mais» em duas linhas. Até 30 letras cabe com folga.
     */
    const mod = await import("@/app/servicos/page");
    const cartao = cartaoDoEntulho(renderToStaticMarkup(React.createElement(mod.default)));
    const rodape = cartao.match(/<p class="text-sm text-slate-600">([^<]*)<\/p>/);
    expect(rodape).not.toBeNull();
    const frase = textoDe(rodape![1]);
    expect(frase.length).toBeGreaterThan(0);
    expect(frase.length).toBeLessThanOrEqual(30);
    expect(cartao).toContain("Ver mais");
  }, PRAZO);
});
