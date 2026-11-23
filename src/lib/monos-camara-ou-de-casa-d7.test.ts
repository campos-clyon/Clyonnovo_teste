import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllCityServiceSlugs } from "./seo-data";
import { MONOS_CAMARA_OU_DE_CASA, TITULO_PROPRIO, cabeNoGoogle, tituloCompleto, tituloDaCidade } from "./titulos-seo";
import { DESCRICAO_PROPRIA, LIMITE_DA_DESCRICAO, descricaoDaCidade, tamanho } from "./descricoes-seo";
import { PRECOS } from "./precos-publicos";
import { desdeSemEComIva } from "./preco-de-referencia";
import { emTerra } from "./preposicao-da-terra";

/**
 * MONOS: «CÂMARA OU DE CASA» — 31-10-2026 (d7).
 *
 * Só as cinco páginas mudam (Cascais, Oeiras, Odivelas, Sintra e Queluz); as
 * outras de monos ficam como estavam, para comparar no Search Console.
 */

const MONOS = getAllCityServiceSlugs().filter(({ service }) => service.slug === "recolha-monos");
const MUDAM = MONOS.filter(({ city }) => (MONOS_CAMARA_OU_DE_CASA as readonly string[]).includes(city.slug));
const FICAM = MONOS.filter(({ city }) => !(MONOS_CAMARA_OU_DE_CASA as readonly string[]).includes(city.slug));
// Desde a d96 (23-11-2026) há monos com título e descrição próprios (TITULO_PROPRIO): Odivelas e Cascais
// entre as cinco, e outras que deixam de ser de controlo.
const PROPRIA = (slug: string) => `recolha-monos-${slug}` in TITULO_PROPRIO;

describe("monos: Câmara ou de casa (d7)", () => {
  it("as cinco páginas existem e as outras ficam de controlo", () => {
    expect(MUDAM.map(({ city }) => city.slug).sort()).toEqual([...MONOS_CAMARA_OU_DE_CASA].sort());
    expect(FICAM.length).toBeGreaterThanOrEqual(15);
  });

  it("título e descrição novos, dentro dos limites, com o preço das fontes e o IVA ao lado", () => {
    // d63: o «desde» da recolha mínima (era a faixa 30 – 100 €).
    const preco = desdeSemEComIva(PRECOS.recolha_monos.minimo!);
    const vistas = new Set<string>();
    for (const { city, service } of MUDAM) {
      const titulo = tituloDaCidade(service.name, city.name, service.slug, city.slug);
      expect(titulo).toBe(PROPRIA(city.slug) ? TITULO_PROPRIO[`recolha-monos-${city.slug}`] : `Recolha de Monos ${emTerra(city.name)}: Câmara ou de Casa`);
      expect(cabeNoGoogle(titulo)).toBe(true);
      expect(tituloCompleto(titulo).length).toBeLessThanOrEqual(60);

      const descricao = descricaoDaCidade(service.slug, service.name, city.name, city.slug);
      // d51 (16-11-2026): uma por terra — com a terra, o preço das fontes e o IVA ao lado.
      if (PROPRIA(city.slug)) expect(descricao).toBe(DESCRICAO_PROPRIA[`recolha-monos-${city.slug}`]);
      else expect(descricao).toMatch(new RegExp(`^Monos em ${city.name}`));
      expect(descricao).toContain(preco);
      vistas.add(descricao);
      expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
      expect(descricao).toContain("com IVA");
    }
    // As cinco, cada uma a sua (d51).
    expect(vistas.size).toBe(MUDAM.length);
  });

  it("as outras páginas de monos não dizem «Câmara ou de Casa»", () => {
    for (const { city, service } of FICAM.filter(({ city }) => !PROPRIA(city.slug))) {
      expect(tituloDaCidade(service.name, city.name, service.slug, city.slug)).not.toContain("Câmara ou de Casa");
      expect(descricaoDaCidade(service.slug, service.name, city.name, city.slug)).not.toMatch(/recolhem? grátis/);
    }
  });

  it("Cascais diz «monstros» no primeiro parágrafo e a de móveis liga à de monos", () => {
    const fonte = readFileSync(join(process.cwd(), "src", "app", "[...slug]", "page.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(fonte).toMatch(/serviceSlug === "recolha-monos" && citySlug === "cascais"\) \{\n\s+return `[^`]*«monstros»/);
    expect(fonte).toMatch(
      /service\.slug === "recolha-moveis" && monosCamaraOuDeCasa\(city\.slug\)[\s\S]{0,400}caminhoDoServicoNaCidade\("recolha-monos", city\.slug\)/,
    );
  });
});
