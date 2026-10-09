import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import sitemap from "@/app/sitemap";
import { CIDADES_MUDANCAS, getAllCidadeSlugs } from "./mudancas-cidades";
import { CITIES } from "./seo-data";
import { servicoDaLigacao } from "./servico-na-ligacao";
import { PAGINAS_DE_TIPO_DE_MUDANCA, PEDIR_MUDANCA, TIPOS_DE_MUDANCA } from "./tipos-de-mudanca";

/**
 * AS MUDANÇAS COM O PESO DAS RECOLHAS — 09-10-2026.
 *
 * *«Quero fortalecer a nossa presença nas mudanças tanto quanto nas recolhas
 * — ter um SEO forte para receber vários pedidos de mudanças.»*
 *
 * Havia 13 páginas de mudanças contra ~117 de recolhas: faltavam 13 cidades
 * (Almada, Seixal, Setúbal, Cascais e Amadora entre elas), as que existiam
 * eram finas, quase nada do site lhes ligava, e quem chegava ao simulador
 * tinha de escolher «Mudança» outra vez. Este ficheiro guarda as quatro
 * coisas que se fizeram.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("as cidades", () => {
  it("as 26 localidades têm página, e nenhuma vizinha aponta para uma que não existe", () => {
    const slugs = new Set(getAllCidadeSlugs());
    expect(slugs.size).toBe(CITIES.length);
    for (const c of CIDADES_MUDANCAS) {
      for (const v of c.cidadesVizinhas) expect(slugs.has(v), `${c.slug} → ${v}`).toBe(true);
    }
  });

  it("cada cidade tem conteúdo seu: rotas, zonas, o desafio e pelo menos três perguntas", () => {
    for (const c of CIDADES_MUDANCAS) {
      expect(c.rotasComuns.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.landmarks.length, c.slug).toBeGreaterThanOrEqual(3);
      expect(c.desafio.length, c.slug).toBeGreaterThan(80);
      expect(c.faqs.length, c.slug).toBeGreaterThanOrEqual(2);
    }
    // As treze novas têm três perguntas cada.
    for (const slug of ["almada", "seixal", "setubal", "cascais", "amadora"]) {
      expect(CIDADES_MUDANCAS.find((c) => c.slug === slug)!.faqs.length, slug).toBe(3);
    }
  });

  it("nenhum desafio é cópia do de outra cidade", () => {
    const desafios = CIDADES_MUDANCAS.map((c) => c.desafio);
    expect(new Set(desafios).size).toBe(desafios.length);
  });

  it("o sitemap tem as 26 cidades e os três tipos de mudança", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    for (const slug of getAllCidadeSlugs()) expect(urls).toContain(`/mudancas/${slug}`);
    for (const t of TIPOS_DE_MUDANCA) expect(urls).toContain(t.href);
  });
});

describe("a página de cada cidade", () => {
  const P = ler("src/app/mudancas/[cidade]/page.tsx");

  it("o FAQPage sai uma vez só, com as perguntas da cidade e as gerais", () => {
    expect(P).toContain("const faqs = [...c.faqs, ...perguntasGerais(c.nome)];");
    expect(P).toContain("mainEntity: faqs.map((f) => ({");
    expect(P).toContain("includeSchema={false}");
  });

  it("mostra o estacionamento da zona, os outros serviços da cidade e quem faz mudanças lá", () => {
    expect(P).toContain("{local.estacionamento}");
    expect(P).toContain("href={caminhoDoServicoNaCidade(s.servico, c.slug)}");
    expect(P).toMatch(/<ProfissionaisComPagina\s+cidade=\{c\.nome\}\s+categoria="mudanca"/);
  });

  it("o pedido abre o simulador já em «Mudança»", () => {
    expect(P).not.toContain('href="/simulador"');
    expect(P).not.toContain('primaryHref="/simulador"');
    expect((P.match(/PEDIR_MUDANCA/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("o simulador abre com o serviço do link", () => {
  it("lê ?servico= pelo id ou pelo slug, e os nomes antigos de ?categoria=", () => {
    expect(PEDIR_MUDANCA).toBe("/simulador?servico=mudanca");
    expect(servicoDaLigacao("?servico=mudanca")).toBe("mudanca");
    expect(servicoDaLigacao("?servico=recolha-moveis")).toBe("recolha_moveis");
    expect(servicoDaLigacao("?categoria=mudancas")).toBe("mudanca");
    expect(servicoDaLigacao("?categoria=entulho")).toBe("recolha_entulho");
  });

  it("um valor que não conhece não escolhe nada", () => {
    expect(servicoDaLigacao("")).toBeNull();
    expect(servicoDaLigacao("?servico=qualquer-coisa")).toBeNull();
    expect(servicoDaLigacao("?outra=mudanca")).toBeNull();
  });

  it("o formulário usa-o ao montar, sem passar por cima de uma escolha já feita", () => {
    const F = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(F).toContain("const doLink = servicoDaLigacao(window.location.search);");
    expect(F).toContain("setFormData((prev) => (prev.serviceType ? prev : { ...prev, serviceType: doLink as ServiceType }));");
  });
});

describe("o resto do site liga às mudanças", () => {
  it("o rodapé tem a coluna das mudanças, e cada cidade dela tem página", () => {
    const R = ler("src/components/Footer.tsx");
    expect(R).toContain('<nav aria-label="Mudanças">');
    expect(R).toContain("{TIPOS_DE_MUDANCA.map((t) => (");
    const slugs = [...R.slice(R.indexOf("const MUDANCAS = ["), R.indexOf("];", R.indexOf("const MUDANCAS = ["))).matchAll(/slug: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThanOrEqual(6);
    for (const s of slugs) expect(getAllCidadeSlugs(), s).toContain(s);
  });

  it("a página principal das mudanças leva ao simulador, e as zonas são links", () => {
    const H = ler("src/app/mudancas/page.tsx");
    expect(H).not.toMatch(/href="\/contactos"/);
    expect(H).toContain('href={caminhoDoServicoNaCidade("mudancas", city.slug)}');
    expect(H).toContain("{TIPOS_DE_MUDANCA.map((t) => (");
  });

  it("as páginas de recolha de cada cidade ligam à mudança na mesma cidade", () => {
    const S = ler("src/app/[...slug]/page.tsx");
    expect((S.match(/caminhoDoServicoNaCidade\("mudancas", city\.slug\)/g) ?? []).length).toBe(2);
  });

  it("a página inicial, as áreas e os artigos de mudanças também", () => {
    expect(ler("src/app/page.tsx")).toContain('question: "Também tratam de mudanças?",');
    expect(ler("src/app/areas-de-atuacao/page.tsx")).toContain('{ name: "Mudanças", slug: "mudancas", hub: "/mudancas", color: "emerald" },');
    const Z = ler("src/lib/blog-zonas.ts");
    for (const a of ["quanto-custa-uma-mudanca-em-lisboa", "como-organizar-uma-mudanca-de-casa", "pequenas-mudancas-em-lisboa-quando-compensa"]) {
      expect(Z).toContain(`"${a}": "mudancas",`);
    }
  });
});

describe("os três tipos de mudança", () => {
  it("cada um tem página, e o middleware não os confunde com cidades", () => {
    for (const t of TIPOS_DE_MUDANCA) {
      const pagina = ler(`src/app${t.href}/page.tsx`);
      expect(pagina).toContain(`caminho: "${t.href}",`);
      expect(pagina).toContain(`canonical: \`\${SITE_URL}${t.href}\``);
    }
    expect(PAGINAS_DE_TIPO_DE_MUDANCA).toContain("/mudancas-de-escritorio");
    expect(ler("src/middleware.ts")).toContain("!PAGINAS_DE_TIPO_DE_MUDANCA.includes(nextUrl.pathname)");
  });

  it("nenhum anuncia preço: orçamento personalizado, como o resto das mudanças", () => {
    for (const f of [
      "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
      ...TIPOS_DE_MUDANCA.map((t) => `src/app${t.href}/page.tsx`),
    ]) {
      const t = ler(f);
      expect(t, f).not.toMatch(/desde \d+\s?€|\d+\s?€|\d+ euros/i);
      expect(t, f).not.toMatch(/\boffers:/);
    }
  });
});

describe("os profissionais da página", () => {
  it("o bloco filtra pelo serviço quando lho pedem", () => {
    const C = ler("src/components/ProfissionaisComPagina.tsx");
    expect(C).toContain(".filter((p) => !categoria || p.categorias.includes(categoria))");
  });
});
