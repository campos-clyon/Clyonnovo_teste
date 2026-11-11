import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS } from "./blog-data";
import { CIDADES_MUDANCAS } from "./mudancas-cidades";
import { PESSOAS_NA_EQUIPA, PRECO_POR_HORA } from "./tabela-das-mudancas";
import {
  SEM_PARCEIROS,
  precoDaMudancaNaDescricao,
  precoDaMudancaNoTitulo,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";
import { cabeNoGoogle, tituloCompleto, tituloDaMudanca } from "./titulos-seo";

/*
 * «MANTENHA AS MUDANÇAS A 50 € + IVA POR HORA» — o dono, 14-10-2026.
 *
 * E DESDE 11-11-2026, AO PREÇO DE CADA PARCEIRO: o título e a descrição dizem
 * o preço público — o «desde» dos parceiros da lista, ou, sem nenhum, a
 * referência (e dizem que é referência). As URLs e a estrutura não mudam.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const COM_PARCEIROS: PrecoPublicoDasMudancas = { tipo: "parceiros", parceiros: 2, desde: { semIvaCent: 4250, comIvaCent: 5228 } };

describe("o preço das mudanças no título", () => {
  it("com parceiros, o «desde» deles; sem nenhum, a referência — sempre com o IVA", () => {
    expect(precoDaMudancaNoTitulo(COM_PARCEIROS)[0]).toBe("Desde 42,50 €/h + IVA");
    expect(precoDaMudancaNoTitulo(SEM_PARCEIROS)[0]).toBe(`Referência ${PRECO_POR_HORA} €/h + IVA`);
    expect(tituloDaMudanca("Moita")).toBe(`Mudanças na Moita — Referência ${PRECO_POR_HORA} €/h + IVA`);
    expect(tituloDaMudanca("Moita", COM_PARCEIROS)).toBe("Mudanças na Moita — Desde 42,50 €/h + IVA");
  });

  it("todas as terras cabem nos 60 caracteres, e nenhuma tem o número sem IVA", () => {
    const maus: string[] = [];
    for (const p of [SEM_PARCEIROS, COM_PARCEIROS]) {
      for (const c of CIDADES_MUDANCAS) {
        const t = tituloDaMudanca(c.nome, p);
        if (!cabeNoGoogle(t) || !t.includes(c.nome) || (t.includes("€") && !t.includes("+ IVA"))) {
          maus.push(`${tituloCompleto(t).length} ${tituloCompleto(t)}`);
        }
      }
    }
    expect(maus).toEqual([]);
  });

  it("a página geral e as das terras usam-no, pelo preço público", () => {
    expect(ler("src/app/mudancas/page.tsx")).toContain(
      'comOPrimeiroQueCabe("Mudanças em Lisboa e Setúbal", ...precoDaMudancaNoTitulo(preco))',
    );
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toContain("const title = tituloDaMudanca(c.nome, preco);");
  });
});

describe("o preço das mudanças na descrição", () => {
  it("com parceiros, o «desde» com o com IVA ao lado; sem eles, a referência", () => {
    expect(precoDaMudancaNaDescricao(COM_PARCEIROS)).toBe("desde 42,50 €/h + IVA (52,28 € com IVA), equipa de 2 — compare parceiros e escolha");
    expect(precoDaMudancaNaDescricao(SEM_PARCEIROS)).toContain(`referência ${PRECO_POR_HORA} €/h + IVA`);
    expect(precoDaMudancaNaDescricao(SEM_PARCEIROS)).toContain(`equipa de ${PESSOAS_NA_EQUIPA}`);
    for (const f of ["src/app/mudancas/page.tsx", "src/app/mudancas/[cidade]/page.tsx"]) {
      expect(ler(f), f).toContain("${precoDaMudancaNaDescricao(preco)}.");
    }
  });
});

describe("as terras das mudanças levam a preposição certa", () => {
  it("nada de «Mudanças em Barreiro»", () => {
    const P = ler("src/app/mudancas/[cidade]/page.tsx");
    expect(P).not.toMatch(/\b[Ee]m \$?\{(c\.nome|nome)\}/);
    expect(P).toContain("Mudanças {emTerra(c.nome)}");
  });
});

describe("os artigos de mudanças dizem o modelo e a referência", () => {
  const artigo = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug)!;

  it("«Quanto custa uma mudança em Lisboa» dá as horas e o preço de referência de cada tipologia", () => {
    const a = artigo("quanto-custa-uma-mudanca-em-lisboa");
    const texto = JSON.stringify(a);
    expect(texto).not.toContain("e não de uma tabela");
    expect(texto).toContain("cada parceiro tem o seu preço por hora");
    expect(a.description).toContain(`${PRECO_POR_HORA} €/h + IVA`);
    const linhas = a.sections.flatMap((s) => s.bullets ?? []);
    // Em intervalo e com a proteção (11-11-2026).
    expect(linhas).toContain("T2: entre 5 e 7 h com 3 pessoas — 310–410 € + IVA (381,30–504,30 € com IVA) na referência, com a proteção");
    expect(linhas).toContain("T3: entre 7 e 9 h, só com 3 pessoas — 442–542 € + IVA (543,66–666,66 € com IVA) na referência, com a proteção");
    expect(a.updatedDate).toBe("2026-11-11");
  });

  it("as pequenas mudanças já não prometem «uma a duas horas» — o mínimo são 3, na referência", () => {
    const texto = JSON.stringify(artigo("pequenas-mudancas-em-lisboa-quando-compensa"));
    expect(texto).not.toContain("uma a duas horas");
    expect(texto).toContain("mínimo de 3 horas");
  });
});
