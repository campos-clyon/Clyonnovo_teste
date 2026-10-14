import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITE_DA_DESCRICAO } from "./descricoes-seo";
import { PAGINAS_EM_INGLES, PRECOS_EM_INGLES, enderecoEmIngles, equivalenteEmPortugues, precoEmIngles } from "./paginas-em-ingles";
import { PRECOS } from "./precos-publicos";
import { cabeNoGoogle } from "./titulos-seo";

/*
 * AS PÁGINAS EM INGLÊS — 14-10-2026 (auditoria de SEO, 90 dias).
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("as páginas em inglês", () => {
  it("são três — Lisboa, Cascais e Oeiras —, e cada uma liga à portuguesa da mesma terra", () => {
    expect(PAGINAS_EM_INGLES.map((p) => p.slugPt)).toEqual(["lisboa", "cascais", "oeiras"]);
    for (const p of PAGINAS_EM_INGLES) {
      expect(equivalenteEmPortugues(p)).toMatch(new RegExp(`recolha-moveis-${p.slugPt}$`));
      expect(enderecoEmIngles(p.slugPt)).toBe(`/en/${p.slug}`);
    }
    expect(enderecoEmIngles("moita")).toBeNull();
  });

  it("os títulos cabem no Google e as descrições nos 155", () => {
    for (const p of PAGINAS_EM_INGLES) {
      expect(cabeNoGoogle(`${p.titulo} — Quotes in 6h`), p.slug).toBe(true);
      expect(p.descricao.length, p.slug).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
    }
  });

  it("os preços são os da tabela portuguesa, ditos em inglês, com o IVA", () => {
    expect(precoEmIngles(PRECOS.recolha_moveis)).toBe(`€${PRECOS.recolha_moveis.minimo}–${PRECOS.recolha_moveis.maximo} + VAT`);
    expect(precoEmIngles(PRECOS.recolha_entulho)).toBe(`from €${PRECOS.recolha_entulho.minimo}/m³ + VAT`);
    for (const l of PRECOS_EM_INGLES) expect(l.preco).toContain("VAT");
  });

  it("estão no sitemap, marcadas em inglês, e com o hreflang nos dois sentidos", () => {
    const S = ler("src/app/sitemap.ts");
    for (const p of PAGINAS_EM_INGLES) expect(S).toContain(`url: \`\${SITE_URL}/en/${p.slug}\``);
    const P = ler("src/app/en/[pagina]/page.tsx");
    expect(P).toContain('<div lang="en"');
    expect(P).toContain('languages: { en: url, "pt-PT": `${SITE_URL}${equivalenteEmPortugues(p)}` }');
    expect(ler("src/app/[...slug]/page.tsx")).toContain("{ en: `${SITE_URL}${enderecoEmIngles(city.slug)}` }");
  });
});
