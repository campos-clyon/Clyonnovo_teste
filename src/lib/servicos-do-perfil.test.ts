import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { servicosDoPerfil, terraComPagina, zonasDoPerfil } from "./servicos-do-perfil";
import { SERVICE_CATEGORIES } from "./service-categories";
import { CITIES, getAllCityServiceSlugs } from "./seo-data";
import { getAllCidadeSlugs } from "./mudancas-cidades";
import { GERADAS_COM_PAGINA_ESTATICA } from "./paginas-consolidadas";

/**
 * OS PERFIS LIGADOS ÀS PÁGINAS DAS TERRAS — 15-10-2026.
 *
 * *«Perfis e simulador»*, escolhido pelo dono. O que se guarda: que cada
 * serviço de um perfil leva à página dele na terra de onde o profissional
 * parte, que as zonas levam às páginas do serviço principal, que nenhuma
 * ligação vai dar a uma página que não existe ou que faz 301, e que o
 * «Pedir orçamento» abre o simulador no serviço dele.
 */

const geradas = new Set(getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`));
const mudancas = new Set(getAllCidadeSlugs().map((c) => `/mudancas/${c}`));
const estaticas = new Set(Object.values(GERADAS_COM_PAGINA_ESTATICA));
const hubs = new Set(SERVICE_CATEGORIES.map((c) => c.href));
const existe = (href: string) => geradas.has(href) || mudancas.has(href) || estaticas.has(href) || hubs.has(href);

describe("os serviços de um perfil", () => {
  it("levam à página do serviço na terra de onde parte, com a terra no texto", () => {
    expect(servicosDoPerfil(["recolha_moveis", "recolha_entulho"], "Seixal")).toEqual([
      expect.objectContaining({ ligacao: "Recolha de móveis no Seixal", href: "/recolha-moveis-seixal" }),
      expect.objectContaining({ ligacao: "Recolha de entulho no Seixal", href: "/recolha-entulho-seixal" }),
    ]);
  });

  it("vão à página própria quando a gerada faz 301 (Amadora)", () => {
    const [monos] = servicosDoPerfil(["recolha_monos"], "Amadora");
    expect(monos).toMatchObject({ ligacao: "Recolha de monos na Amadora", href: "/recolha-de-monos-amadora" });
  });

  it("as mudanças vão à página da cidade das mudanças", () => {
    expect(servicosDoPerfil(["mudanca"], "Setúbal")[0]).toMatchObject({
      ligacao: "Mudança em Setúbal",
      href: "/mudancas/setubal",
    });
  });

  it("casa e apartamento vão dar à mesma página, e aparecem uma vez", () => {
    const lista = servicosDoPerfil(["esvaziamento_casa", "esvaziamento_apartamento"], "Almada");
    expect(lista).toHaveLength(1);
    expect(lista[0].href).toBe("/esvaziamento-casas-almada");
  });

  it("sem terra com página, cada serviço leva à página geral dele", () => {
    const lista = servicosDoPerfil(["recolha_moveis", "montagem_moveis", "outro"], "Quinta do Conde");
    expect(lista.map((s) => [s.ligacao, s.href])).toEqual([
      ["Recolha de móveis", "/recolha-de-moveis"],
      ["Montagem e desmontagem de móveis", "/servicos/montagem-moveis"],
    ]);
    expect(servicosDoPerfil(["recolha_moveis"], null)[0].href).toBe("/recolha-de-moveis");
  });

  it("uma categoria que não se conhece não aparece", () => {
    expect(servicosDoPerfil(["coisa_velha"], "Lisboa")).toEqual([]);
  });

  it("a terra encontra-se sem olhar aos acentos nem às maiúsculas", () => {
    expect(terraComPagina("setubal")).toEqual({ slug: "setubal", nome: "Setúbal" });
    expect(terraComPagina("MONTE ABRAAO")).toEqual({ slug: "monte-abraao", nome: "Monte Abraão" });
    expect(terraComPagina("Amoreiras")).toBeNull();
  });

  it("nenhuma ligação, em nenhuma terra e em nenhum serviço, vai dar a uma página que não existe", () => {
    const todas = SERVICE_CATEGORIES.map((c) => c.id);
    const quebradas = [...CITIES.map((c) => c.name), null]
      .flatMap((cidade) => servicosDoPerfil(todas, cidade))
      .map((s) => s.href)
      .filter((h) => !existe(h));
    expect(quebradas).toEqual([]);
  });
});

describe("as zonas de um perfil", () => {
  it("as terras com páginas levam à do serviço principal lá; as outras ficam em texto", () => {
    expect(zonasDoPerfil(["Almada", "Quinta do Conde", "Seixal"], ["recolha_entulho", "recolha_moveis"])).toEqual([
      { nome: "Almada", href: "/recolha-entulho-almada", titulo: "Recolha de entulho em Almada" },
      { nome: "Quinta do Conde", href: null, titulo: null },
      { nome: "Seixal", href: "/recolha-entulho-seixal", titulo: "Recolha de entulho no Seixal" },
    ]);
  });

  it("sem serviço com páginas de terra, as zonas ficam em texto", () => {
    expect(zonasDoPerfil(["Lisboa"], ["jardinagem"])).toEqual([{ nome: "Lisboa", href: null, titulo: null }]);
  });

  it("nenhuma zona leva a uma página que não existe", () => {
    const quebradas = SERVICE_CATEGORIES.flatMap((c) => zonasDoPerfil(CITIES.map((x) => x.name), [c.id]))
      .map((z) => z.href)
      .filter((h): h is string => h != null && !existe(h));
    expect(quebradas).toEqual([]);
  });
});

describe("a página do perfil", () => {
  const PAGINA = readFileSync(join(process.cwd(), "src/app/profissionais/[slug]/page.tsx"), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("mostra os serviços ligados e as zonas ligadas", () => {
    expect(PAGINA).toContain("servicosDoPerfil(p.categorias, p.cidade)");
    expect(PAGINA).toContain("zonasDoPerfil(p.zonas, p.categorias)");
    expect(PAGINA).toMatch(/servicosLigados\.map\(/);
    expect(PAGINA).not.toContain('p.zonas.join(", ")');
  });

  it("o «Pedir orçamento» abre o simulador no serviço dele", () => {
    expect(PAGINA).toContain("`/simulador?servico=${servicoDoPedido}`");
  });

  it("os dados estruturados dizem as zonas onde trabalha", () => {
    expect(PAGINA).toMatch(/areaServed: p\.zonas\.map\(/);
  });
});
