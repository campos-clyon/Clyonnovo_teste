import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { SERVICOS_PUBLICOS } from "./service-categories";
import { LIMITE_DA_DESCRICAO, tamanho } from "./descricoes-seo";
import { cabeNoGoogle } from "./titulos-seo";
import { PRECOS, maisIva } from "./precos-publicos";
import { REGIONS } from "./seo-data";
import { servicoNaPesquisa, servicoParaOModelo } from "./nome-do-servico-no-orcamento";

// Nos testes o JSX das páginas sai como `React.createElement`, e precisa do
// `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * A MANUTENÇÃO DA CASA EM TODO O LADO — O FECHO, 25-10-2026.
 *
 * O que ficou de fora da primeira passagem (manutencao-em-todo-o-lado.test.ts):
 * a /sobre-nos, os nomes dos serviços na rota do orçamento, a introdução da
 * região de Lisboa (que dizia «limpeza», um serviço futuro) e os títulos do
 * hub /servicos, cortados a 375 px ao lado do selo do preço.
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

const descricaoDe = (m: Metadata) => String(m.description ?? "");
const tituloDe = (m: Metadata) => (typeof m.title === "string" ? m.title : "");

/* Importar uma página custa uns segundos no meio da suite: prazo largo. */
const PRAZO = 120_000;

const MANUTENCAO = SERVICOS_PUBLICOS.find((c) => c.id === "manutencao_casa")!;

describe("a /sobre-nos", () => {
  it("o título diz a manutenção e cabe no Google com a marca", async () => {
    const mod = await import("@/app/sobre-nos/page");
    const titulo = tituloDe(mod.metadata);
    expect(titulo).toContain("Manutenção");
    expect(cabeNoGoogle(titulo)).toBe(true);
    const og = mod.metadata.openGraph as { title?: string } | undefined;
    expect(og?.title).toBe(titulo);
  }, PRAZO);

  it("a descrição diz a manutenção da casa e quem faz o trabalho, dentro dos 155", async () => {
    const mod = await import("@/app/sobre-nos/page");
    const descricao = descricaoDe(mod.metadata);
    expect(descricao).toContain("manutenção da casa");
    expect(descricao).toContain("esvaziamentos");
    expect(descricao).toContain("profissionais verificados");
    expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
  }, PRAZO);

  it("a grelha «O que se pede à CLYON» tem a manutenção, com o nome, a página e o preço das fontes", async () => {
    const mod = await import("@/app/sobre-nos/page");
    const html = renderToStaticMarkup(React.createElement(mod.default));
    const texto = textoDe(html);
    expect(html).toContain(`href="${MANUTENCAO.href}"`);
    expect(texto).toContain(MANUTENCAO.label);
    expect(texto).toContain(MANUTENCAO.description);
    expect(texto).toContain(maisIva(PRECOS.manutencao_casa.etiqueta));
    expect(texto).toContain("Recolhas, esvaziamentos, mudanças e manutenção — com o preço à vista");
  }, PRAZO);

  it("e o cartão não se escreve à mão: sai de SERVICOS_PUBLICOS", () => {
    const codigo = semComentarios(ler("src/app/sobre-nos/page.tsx"));
    const i = codigo.indexOf("const SERVICOS = [");
    expect(i).toBeGreaterThan(-1);
    const grelha = codigo.slice(i, codigo.indexOf("\n];", i));
    expect(grelha).toContain('SERVICOS_PUBLICOS.filter((c) => c.id === "manutencao_casa")');
    expect(grelha).not.toMatch(/titulo: "Manuten/);
    expect(grelha).not.toMatch(/href: "\/servicos\/manutencao-casa"/);
  });
});

describe("a rota do orçamento", () => {
  it("conhece a manutenção da casa: não vai à pesquisa como «serviço de transporte»", () => {
    expect(servicoNaPesquisa("manutencao_casa")).not.toBe("serviço de transporte");
    expect(servicoNaPesquisa("manutencao_casa")).toMatch(/manutenção/);
    expect(servicoParaOModelo("manutencao_casa")).toMatch(/^Manutenção da casa/);
  });

  it("cada serviço do site tem um nome legível na pesquisa e para o modelo", () => {
    for (const c of SERVICOS_PUBLICOS.filter((s) => s.id !== "outro")) {
      expect(servicoNaPesquisa(c.id), c.id).not.toBe("serviço de transporte");
      expect(servicoParaOModelo(c.id), c.id).not.toBe(c.id);
      expect(servicoParaOModelo(c.id), c.id).not.toMatch(/_/);
    }
  });

  it("os nomes de antes ficam como estavam", () => {
    expect(servicoNaPesquisa("recolha_moveis")).toBe("recolha de móveis");
    expect(servicoNaPesquisa("mudanca")).toBe("mudança de casa");
    expect(servicoNaPesquisa(undefined)).toBe("serviço de transporte");
    expect(servicoParaOModelo("recolha_monos")).toBe("Recolha de monos/volumosos");
    expect(servicoParaOModelo(undefined)).toBe("(não especificado)");
  });

  it("e a rota usa-os, sem mapas próprios", () => {
    const rota = semComentarios(ler("src/app/api/simulator/analyze/route.ts"));
    expect(rota).toContain("servicoNaPesquisa(order.serviceType)");
    expect(rota).toContain("servicoParaOModelo(serviceType)");
    expect(rota).not.toMatch(/const serviceMap\b/);
    expect(rota).not.toMatch(/const names: Record<string, string>/);
  });
});

describe("a região de Lisboa", () => {
  it("a introdução diz os serviços de hoje, sem a limpeza", () => {
    const lisboa = REGIONS.find((r) => r.slug === "lisboa")!;
    expect(lisboa.intro).not.toMatch(/limpeza/i);
    for (const s of ["recolhas", "esvaziamentos", "mudanças", "manutenção"]) {
      expect(lisboa.intro, s).toContain(s);
    }
  });

  it("e nenhuma região promete a limpeza na introdução", () => {
    for (const r of REGIONS) expect(r.intro, r.slug).not.toMatch(/limpeza/i);
  });
});

describe("os títulos dos cartões do hub /servicos", () => {
  it("quebram a linha em vez de serem cortados, e o selo do preço não encolhe", async () => {
    const mod = await import("@/app/servicos/page");
    const html = renderToStaticMarkup(React.createElement(mod.default));
    const titulos = [...html.matchAll(/<h3 class="([^"]*)">([^<]*)<\/h3>/g)].filter((m) =>
      /text-\[15px\]/.test(m[1]),
    );
    expect(titulos.length).toBeGreaterThanOrEqual(6);
    for (const [, classes, titulo] of titulos) {
      expect(classes, titulo).not.toMatch(/\btruncate\b/);
      expect(classes, titulo).toMatch(/\bbreak-words\b/);
    }
    // O selo fica numa linha e não aperta o título até ao corte.
    const selos = [...html.matchAll(/<span class="([^"]*rounded-full bg-white\/95[^"]*)">/g)];
    expect(selos.length).toBe(titulos.length);
    for (const [, classes] of selos) {
      expect(classes).toMatch(/\bshrink-0\b/);
      expect(classes).toMatch(/\bwhitespace-nowrap\b/);
    }
  }, PRAZO);
});
