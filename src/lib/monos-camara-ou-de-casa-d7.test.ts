import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllCityServiceSlugs } from "./seo-data";
import { MONOS_CAMARA_OU_DE_CASA, cabeNoGoogle, tituloCompleto, tituloDaCidade } from "./titulos-seo";
import { LIMITE_DA_DESCRICAO, descricaoDaCidade, tamanho } from "./descricoes-seo";
import { PRECOS } from "./precos-publicos";
import { faixaSemEComIva } from "./preco-de-referencia";
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

describe("monos: Câmara ou de casa (d7)", () => {
  it("as cinco páginas existem e as outras ficam de controlo", () => {
    expect(MUDAM.map(({ city }) => city.slug).sort()).toEqual([...MONOS_CAMARA_OU_DE_CASA].sort());
    expect(FICAM.length).toBeGreaterThanOrEqual(15);
  });

  it("título e descrição novos, dentro dos limites, com o preço das fontes e o IVA ao lado", () => {
    const preco = faixaSemEComIva(PRECOS.recolha_monos.minimo!, PRECOS.recolha_monos.maximo!);
    for (const { city, service } of MUDAM) {
      const titulo = tituloDaCidade(service.name, city.name, service.slug, city.slug);
      expect(titulo).toBe(`Recolha de Monos ${emTerra(city.name)}: Câmara ou de Casa`);
      expect(cabeNoGoogle(titulo)).toBe(true);
      expect(tituloCompleto(titulo).length).toBeLessThanOrEqual(60);

      const descricao = descricaoDaCidade(service.slug, service.name, city.name, city.slug);
      expect(descricao).toBe(
        `Pela Câmara é grátis e à porta, no dia marcado. Sem esperar e de dentro de casa: parceiros verificados, ${preco}.`,
      );
      expect(tamanho(descricao)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
      expect(descricao).toContain("com IVA");
    }
  });

  it("as outras páginas de monos não dizem «Câmara ou de Casa»", () => {
    for (const { city, service } of FICAM) {
      expect(tituloDaCidade(service.name, city.name, service.slug, city.slug)).not.toContain("Câmara ou de Casa");
      expect(descricaoDaCidade(service.slug, service.name, city.name, city.slug)).not.toContain("Pela Câmara é grátis");
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
