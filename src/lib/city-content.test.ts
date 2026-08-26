import { describe, expect, it } from "vitest";

import { cidadeServicoDeveIndexar, getCityBaseContent } from "./city-content";
import { CITIES, SERVICES } from "./seo-data";

const SERVICOS_COM_PAGINA_PROPRIA = new Set(["mudancas"]);

describe("cidadeServicoDeveIndexar", () => {
  it("todas as cidades publicadas têm retrato local — nenhuma página nasce só de template", () => {
    const semConteudo = CITIES.filter((city) => getCityBaseContent(city.slug) === undefined);
    expect(semConteudo.map((c) => c.slug)).toEqual([]);
  });

  it("aceita as combinações que hoje existem", () => {
    for (const city of CITIES) {
      for (const service of SERVICES) {
        if (SERVICOS_COM_PAGINA_PROPRIA.has(service.slug)) continue;
        expect(
          cidadeServicoDeveIndexar(city.slug, service.slug),
          `${service.slug}-${city.slug}`,
        ).toBe(true);
      }
    }
  });

  it("recusa uma cidade que ainda não tenha conteúdo escrito", () => {
    expect(cidadeServicoDeveIndexar("cidade-que-nao-existe", "recolha-moveis")).toBe(false);
  });
});
