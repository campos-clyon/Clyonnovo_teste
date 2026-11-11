import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ACTUALIZADO_EM } from "./datas-das-paginas";

/**
 * OS DADOS ESTRUTURADOS DIZEM SÓ O QUE A PÁGINA MOSTRA — 10-11-2026 (d29).
 *
 * /avaliacoes, /precos, /blog e /trabalhos não diziam nada ao Google sobre si.
 * Passam a dizer o caminho e o que são — e mais nada que não esteja à vista:
 * nem nota nem avaliações declaradas (são do Google, copiadas para cá), nem
 * um preço sem IVA sozinho numa oferta.
 */

/** O código sem os comentários de bloco nem os de linha inteira (regra ancorada ao início da linha). */
const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PAGINAS = ["avaliacoes", "precos", "blog", "trabalhos"] as const;

describe("d29: dados estruturados de /avaliacoes, /precos, /blog e /trabalhos", () => {
  it.each(PAGINAS)("/%s diz o seu caminho, pelo escape de json-ld.ts", (pagina) => {
    const codigo = ler(`src/app/${pagina}/page.tsx`);
    expect(codigo).toMatch(new RegExp(`caminhoDaPagina\\(\\[\\["[^"]+", "/${pagina}"\\]\\]\\)`));
    expect(codigo).toContain("jsonLd(breadcrumbSchema)");
    // Todos os application/ld+json passam por jsonLd(): nenhum JSON.stringify à mão.
    const scripts = codigo.match(/application\/ld\+json[^\n]*/g) ?? [];
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    for (const s of scripts) expect(s).toContain("__html: jsonLd(");
  });

  it.each(PAGINAS)("/%s não declara nota, avaliações nem preços", (pagina) => {
    const codigo = ler(`src/app/${pagina}/page.tsx`);
    expect(codigo).not.toContain("aggregateRating");
    expect(codigo).not.toMatch(/"@type":\s*"(Review|Rating|Offer|AggregateOffer)"/);
    // (`price:` sozinho é o campo dos cartões de /precos, que é texto do ecrã.)
    expect(codigo).not.toMatch(/\b(offers|lowPrice|highPrice|priceRange|priceSpecification)\s*:/);
  });

  it("as perguntas de /precos são a mesma lista que os cartões mostram", () => {
    const codigo = ler("src/app/precos/page.tsx");
    expect(codigo).toContain("mainEntity: faqs.map((faq) => ({");
    expect(codigo).toContain("{faqs.map((faq) => (");
    expect(codigo).toContain("itemListElement: PAGINAS_DE_PRECO.map(");
    expect(codigo).toContain("{PAGINAS_DE_PRECO.map((p) => (");
  });

  it("a lista de /blog é a dos artigos no ar, a mesma dos cartões", () => {
    const codigo = ler("src/app/blog/page.tsx");
    // Desde a d7 (11-11-2026) com o preço público das mudanças: a mesma lista nos cartões e no que se diz ao Google.
    expect(codigo).toContain("const posts = artigosPublicados(await precoPublicoDasMudancas());");
    expect(codigo).toContain("jsonLd(blogSchema(posts))");
    expect(codigo).toContain("{posts.map((post) => (");
  });

  it("as quatro páginas levam a data desta mudança", () => {
    for (const pagina of PAGINAS) expect(ACTUALIZADO_EM[`/${pagina}`] >= "2026-11-10", pagina).toBe(true);
  });
});
