import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { descricaoDaCidade } from "./descricoes-seo";
import { LOCALIDADES_DO_CONCELHO } from "./localidades-dos-concelhos";
import { LOCALIDADES_JUNTAS_AO_CONCELHO } from "./paginas-consolidadas";
import { ACTUALIZADO_EM } from "./datas-das-paginas";
import { cabeNoGoogle, emTerraDaPagina, tituloCompleto, tituloDaCidade } from "./titulos-seo";

/*
 * d68, 17-11-2026: sem desfazer a d13, a página para onde /recolha-moveis-amora
 * vai (a do Seixal) diz «Amora» no título, na descrição, no H1 e numa secção sua.
 */
describe("a Amora na página da recolha de móveis do Seixal (d68)", () => {
  it("o 301 da d13 continua: /recolha-moveis-amora → /recolha-moveis-seixal", () => {
    expect(LOCALIDADES_JUNTAS_AO_CONCELHO["recolha-moveis-amora"]).toBe("/recolha-moveis-seixal");
  });

  it("o título diz a Amora e cabe nos 60", () => {
    const titulo = tituloDaCidade("Recolha de Móveis", "Seixal", "recolha-moveis", "seixal");
    expect(titulo).toBe("Recolha de Móveis Seixal e Amora — Desde 60 € + IVA");
    expect(cabeNoGoogle(titulo)).toBe(true);
    expect(tituloCompleto(titulo).length).toBeLessThanOrEqual(60);
  });

  it("a descrição diz a Amora, cabe nos 155 e leva o preço com o IVA ao lado", () => {
    const d = descricaoDaCidade("recolha-moveis", "Recolha de Móveis", "Seixal", "seixal");
    expect(d).toContain("na Amora");
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d).toMatch(/\+ IVA \([^)]*com IVA\)/);
    expect(d).not.toMatch(/próprio dia|contentor|big bag/i);
  });

  it("o H1 da página sai do mesmo texto", () => {
    expect(emTerraDaPagina("recolha-moveis", "seixal", "Seixal")).toBe("no Seixal e na Amora");
    expect(emTerraDaPagina("recolha-moveis", "almada", "Almada")).toBe("em Almada");
    const pagina = readFileSync("src/app/[...slug]/page.tsx", "utf8");
    expect(pagina).toContain("`Recolha de Móveis ${emTerraDaPagina(service.slug, city.slug, city.name)}`");
  });

  it("as outras páginas de cidade não mudam", () => {
    expect(tituloDaCidade("Recolha de Móveis", "Almada", "recolha-moveis", "almada")).not.toContain("Amora");
    expect(descricaoDaCidade("recolha-monos", "Recolha de Monos", "Seixal", "seixal")).not.toContain("Amora e");
  });

  it("a secção da Amora nomeia as terras dela, sem prometer o que não se faz", () => {
    const amora = LOCALIDADES_DO_CONCELHO["recolha-moveis-seixal"].find((l) => l.nome === "Amora")!;
    expect(amora.titulo).toBe("Recolha de móveis na Amora");
    for (const terra of ["Amora", "Cruz de Pau", "Fogueteiro", "Paivas", "Foros de Amora", "Belverde"]) {
      expect(amora.texto).toContain(terra);
    }
    expect(amora.texto).toContain("parceiro");
    expect(amora.texto).toMatch(/com IVA/);
    expect(amora.texto).not.toMatch(/próprio dia|contentor|big bag/i);
  });

  it("a data da página mudou", () => {
    expect(ACTUALIZADO_EM["/recolha-moveis-seixal"]).toBe("2026-11-17");
  });
});
