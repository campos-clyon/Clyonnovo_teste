import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS } from "./blog-data";
import { CIDADES_MUDANCAS } from "./mudancas-cidades";
import {
  HORAS_POR_TIPOLOGIA,
  PESSOAS_NA_EQUIPA,
  PRECO_DA_MUDANCA_NA_DESCRICAO,
  PRECO_DA_MUDANCA_NO_TITULO,
  PRECO_POR_HORA,
} from "./tabela-das-mudancas";
import { cabeNoGoogle, tituloCompleto, tituloDaMudanca } from "./titulos-seo";

/*
 * «MANTENHA AS MUDANÇAS A 50 € + IVA POR HORA» — o dono, 14-10-2026.
 *
 * O preço fica, e passa a ir ao Google com a equipa ao lado: as páginas de
 * mudanças diziam «Sem Stress» e «Orçamento em 6h», e o artigo «Quanto custa
 * uma mudança em Lisboa» não dava preço nenhum.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("o preço das mudanças no título", () => {
  it("diz o número, o IVA e para quantos é, onde couber", () => {
    expect(PRECO_DA_MUDANCA_NO_TITULO[0]).toBe(`Equipa de ${PESSOAS_NA_EQUIPA} a ${PRECO_POR_HORA} €/h + IVA`);
    expect(tituloDaMudanca("Moita")).toBe(`Mudanças na Moita — Equipa de 3 a ${PRECO_POR_HORA} €/h + IVA`);
  });

  it("todas as terras cabem nos 60 caracteres, e nenhuma tem o número sem IVA", () => {
    const maus: string[] = [];
    for (const c of CIDADES_MUDANCAS) {
      const t = tituloDaMudanca(c.nome);
      if (!cabeNoGoogle(t) || !t.includes(c.nome) || (t.includes("€") && !t.includes("+ IVA"))) {
        maus.push(`${tituloCompleto(t).length} ${tituloCompleto(t)}`);
      }
    }
    expect(maus).toEqual([]);
  });

  it("a página geral e as das terras usam-no", () => {
    expect(ler("src/app/mudancas/page.tsx")).toContain(
      'comOPrimeiroQueCabe("Mudanças em Lisboa e Setúbal", ...PRECO_DA_MUDANCA_NO_TITULO)',
    );
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toContain("const title = tituloDaMudanca(c.nome);");
  });
});

describe("o preço das mudanças na descrição", () => {
  it("vai com a equipa e o mínimo", () => {
    expect(PRECO_DA_MUDANCA_NA_DESCRICAO).toContain(`${PRECO_POR_HORA} €/h + IVA pela equipa de ${PESSOAS_NA_EQUIPA}`);
    expect(PRECO_DA_MUDANCA_NA_DESCRICAO).toMatch(/mínimo \d+ horas$/);
    for (const f of ["src/app/mudancas/page.tsx", "src/app/mudancas/[cidade]/page.tsx"]) {
      expect(ler(f), f).toContain("${PRECO_DA_MUDANCA_NA_DESCRICAO}.");
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

describe("os artigos de mudanças dizem a tabela", () => {
  const artigo = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug)!;

  it("«Quanto custa uma mudança em Lisboa» dá as horas e o preço de cada tipologia", () => {
    const a = artigo("quanto-custa-uma-mudanca-em-lisboa");
    const texto = JSON.stringify(a);
    expect(texto).not.toContain("e não de uma tabela");
    expect(a.description).toContain(`${PRECO_POR_HORA} €/h + IVA`);
    const linhas = a.sections.flatMap((s) => s.bullets ?? []);
    expect(linhas).toContain(`T2: cerca de ${HORAS_POR_TIPOLOGIA.T2} horas — ${HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA} € + IVA`);
    expect(a.updatedDate).toBe("2026-10-14");
  });

  it("as pequenas mudanças já não prometem «uma a duas horas» — o mínimo são 3", () => {
    const texto = JSON.stringify(artigo("pequenas-mudancas-em-lisboa-quando-compensa"));
    expect(texto).not.toContain("uma a duas horas");
    expect(texto).toContain("mínimo de 3 horas");
  });
});
