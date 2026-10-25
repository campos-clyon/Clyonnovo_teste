import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { SERVICE_CATEGORIES } from "./service-categories";
import { LIMITE_DA_DESCRICAO, tamanho } from "./descricoes-seo";
import { cabeNoGoogle } from "./titulos-seo";
import { buildAnalysisPrompt } from "./prompt-do-orcamento";

// Nos testes o JSX das páginas sai como `React.createElement`, e precisa do
// `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * A MANUTENÇÃO DA CASA EM TODO O LADO — 25-10-2026.
 *
 * O dono aprovou o texto e «Sim, em todo o lado»: a página da manutenção
 * deixa de responder «Não» a «Fazem obras?», e a manutenção entra onde o site
 * só falava de recolhas, esvaziamentos e mudanças — o hub /servicos, a
 * resposta dos contactos, as descrições que listam os serviços e as
 * instruções ao modelo do orçamento.
 */

const FAZEM_OBRAS =
  "Reparações e remodelações, sim: pintura, canalização, electricidade, carpintaria, pavimentos, casas de banho e cozinhas, feitas por profissionais verificados da sua zona. Envie fotografias e recebe propostas. Obras de construção, com estrutura ou licenças, ainda não.";

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

describe("a página da manutenção da casa", () => {
  it("responde a «Fazem obras?» com o texto aprovado, palavra por palavra", async () => {
    const mod = await import("@/app/servicos/[slug]/page");
    const pagina = await mod.default({ params: Promise.resolve({ slug: "manutencao-casa" }) });
    const html = renderToStaticMarkup(pagina);
    const texto = textoDe(html);
    expect(texto).toContain("Fazem obras?");
    expect(texto).toContain(FAZEM_OBRAS);
    // A resposta antiga não volta, nem no ecrã nem no FAQ do Google.
    expect(html).not.toContain("não remodelação");
    expect(html).not.toMatch(/Fazem obras\?[\s\S]{0,200}?Não\./);
  }, PRAZO);

  it("não pára nos pequenos arranjos: a descrição do serviço diz reparações e remodelações", () => {
    const cat = SERVICE_CATEGORIES.find((c) => c.id === "manutencao_casa")!;
    expect(cat.description).toMatch(/remodelaç/i);
    expect(cat.description).not.toMatch(/^Pequenas reparações/);
  });
});

describe("o hub /servicos", () => {
  it("tem a manutenção num cartão como os outros, a ligar à página dela", async () => {
    const mod = await import("@/app/servicos/page");
    const html = renderToStaticMarkup(React.createElement(mod.default));
    expect(html).toContain('href="/servicos/manutencao-casa"');
    expect(textoDe(html)).toContain("Manutenção da Casa");
    // O preço do cartão é o da fonte, com o IVA dito ao lado.
    const codigo = semComentarios(ler("src/app/servicos/page.tsx"));
    expect(codigo).toContain('price: etiquetaDe("manutencao_casa")');
    const cartao = codigo.slice(codigo.indexOf('title: "Manutenção da Casa"'));
    expect(codigo.indexOf('title: "Manutenção da Casa"')).toBeGreaterThan(-1);
    const conversa = cartao.slice(0, cartao.indexOf("],"));
    expect(conversa).not.toMatch(/\d+ ?€/);
  }, PRAZO);

  it("o título, a descrição e a resposta «Que tipo de pedidos» dizem a manutenção", async () => {
    const mod = await import("@/app/servicos/page");
    const titulo = tituloDe(mod.metadata);
    expect(titulo).toContain("Manutenção");
    expect(cabeNoGoogle(titulo)).toBe(true);
    const descricao = descricaoDe(mod.metadata);
    expect(descricao).toContain("manutenção da casa");
    expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
    const codigo = semComentarios(ler("src/app/servicos/page.tsx"));
    const resposta = codigo.match(/q: "Que tipo de pedidos a CLYON aceita\?",\s*a: "([^"]*)"/);
    expect(resposta).not.toBeNull();
    expect(resposta![1]).toContain("manutenção da casa");
  }, PRAZO);
});

describe("os contactos", () => {
  it("«Que serviços posso pedir por aqui?» inclui a manutenção da casa", () => {
    const codigo = semComentarios(ler("src/app/contactos/page.tsx"));
    const resposta = codigo.match(/q: "Que serviços posso pedir por aqui\?",\s*a: "([^"]*)"/);
    expect(resposta).not.toBeNull();
    expect(resposta![1]).toContain("manutenção da casa");
    expect(resposta![1]).toMatch(/remodelaç/);
  });

  it("e a descrição da página também, dentro dos 155", async () => {
    const mod = await import("@/app/contactos/page");
    const descricao = descricaoDe(mod.metadata);
    expect(descricao).toContain("manutenção da casa");
    expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
  }, PRAZO);
});

describe("as descrições que listam os serviços", () => {
  it("a da página inicial diz a manutenção da casa e cabe", async () => {
    const mod = await import("@/app/page");
    const descricao = descricaoDe(mod.metadata);
    expect(descricao).toContain("manutenção da casa");
    expect(descricao).toContain("profissionais");
    expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
  }, PRAZO);

  it("a do layout também (lê-se o ficheiro: o layout carrega as fontes do next/font)", () => {
    const codigo = semComentarios(ler("src/app/layout.tsx"));
    const descricao = codigo.match(/description:\s*"([^"]+)"/);
    expect(descricao).not.toBeNull();
    expect(descricao![1]).toContain("manutenção da casa");
    expect(descricao![1]).toContain("profissionais");
    expect(tamanho(descricao![1])).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
  });
});

describe("as instruções ao modelo do orçamento", () => {
  it("a linha dos serviços inclui a manutenção da casa, e não as obras de construção", () => {
    const linhas = buildAnalysisPrompt("(o pedido)", "(as regras)").split("\n");
    const servicos = linhas.find((l) => l.startsWith("A CLYON presta serviços de"));
    expect(servicos).toBeDefined();
    expect(servicos).toContain("mudanças e manutenção da casa");
    expect(servicos).toContain("obras de construção, com estrutura ou licenças, ainda não");
  });
});
