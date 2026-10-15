import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CITIES } from "./seo-data";
import { recolhaDaCamara } from "./recolha-da-camara";
import { getCidadeLocal } from "./cidades-local";

/**
 * AS PÁGINAS DE CIDADE MAIS PRÓPRIAS — 15-10-2026.
 *
 * *«Cidades mais diferentes»* — escolhido pelo dono. Cerca de 44 % do texto
 * de cada página de cidade era igual ao das outras. Sem tirar o que vende
 * (os passos, os preços, as avaliações), entra o que é de cada terra: a regra
 * da câmara nas páginas de móveis e de esvaziamento, e os bairros na pergunta
 * das zonas.
 */
const PAGINA = readFileSync(join(process.cwd(), "src/app/[...slug]/page.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("cada terra tem com que se distinguir", () => {
  it.each(CITIES.map((c) => [c.slug]))("%s: a câmara tem regras dos monos, e a terra tem bairros", (slug) => {
    expect(recolhaDaCamara(slug)?.monos?.texto, slug).toBeTruthy();
    expect((getCidadeLocal(slug)?.zonas ?? []).length, slug).toBeGreaterThanOrEqual(2);
  });
});

describe("e a página usa-o", () => {
  it("a pergunta das zonas diz os bairros, nas duas listas de perguntas", () => {
    expect(PAGINA.match(/a: respostaDasZonas\(cityName, citySlug, regionLabel, relatedCities\),/g)?.length).toBe(2);
    expect(PAGINA).toContain("pode pedir em toda a área: ${zonas.slice(0, -1).join(\", \")} e ${zonas[zonas.length - 1]}");
  });

  it("móveis e esvaziamento ganham a pergunta da câmara da terra", () => {
    expect(PAGINA).toContain("q: `A Câmara ${monosDaCamara.de} recolhe móveis velhos?`,");
    expect(PAGINA).toContain("q: `A Câmara ${monosDaCamara.de} leva o recheio de uma casa?`,");
    expect(PAGINA).toContain("...(perguntaDaCamaraSobreMoveis ? [perguntaDaCamaraSobreMoveis] : []),");
  });

  it("a nota dos móveis diz a regra da câmara e liga à página de monos da terra", () => {
    expect(PAGINA).toContain("{regraDosMonos} As regras completas, com os contactos e as fontes, estão na");
    expect(PAGINA).toContain('href={caminhoDoServicoNaCidade("recolha-monos", city.slug)}');
  });
});
