import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { destinoDasRegioesAntigas } from "./regioes-antigas";
import { tituloCompleto, tituloDaCidade, ENTULHO_DESDE_COM_IVA, LIMITE_DO_GOOGLE } from "./titulos-seo";
import { descricaoDaCidade, tamanho, LIMITE_DA_DESCRICAO } from "./descricoes-seo";
import { CITIES } from "./seo-data";

/*
 * TÍTULOS QUE DÃO RAZÃO PARA CLICAR, E AS /Regiões/* ANTIGAS — 27-10-2026 (d9).
 *
 * Regras do CEO: o prazo é sempre «em menos de 6 horas» (nunca «em 6h» nos
 * títulos novos); nos títulos só o valor com IVA («c/ IVA»); nas descrições
 * sempre «X + IVA (Y com IVA)».
 */

describe("monos e entulho, nas 26 terras", () => {
  for (const c of CITIES) {
    it(`${c.slug}: títulos sem «em 6h», cabem no Google, e o preço com IVA`, () => {
      const monos = tituloCompleto(tituloDaCidade("Recolha de Monos", c.name, "recolha-monos", c.slug));
      const entulho = tituloCompleto(tituloDaCidade("Recolha de Entulho", c.name, "recolha-entulho", c.slug));
      for (const t of [monos, entulho]) {
        expect(t.length).toBeLessThanOrEqual(LIMITE_DO_GOOGLE);
        expect(t).not.toMatch(/em 6h/);
        if (t.includes("€")) expect(t).toContain("c/ IVA");
        expect(t).not.toMatch(/\+ IVA/);
      }
    });

    it(`${c.slug}: descrições com o par sem/com IVA e o prazo por extenso`, () => {
      for (const s of ["recolha-monos", "recolha-entulho"]) {
        const d = descricaoDaCidade(s, "", c.name, c.slug);
        expect(tamanho(d)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
        expect(d).toMatch(/€ \+ IVA \([\d ,–]+€ com IVA\)/);
        expect(d).not.toMatch(/em 6 ?h/);
        expect(d).not.toMatch(/contentores|big bag|próprio dia/i);
      }
    });
  }

  it("Lisboa, Almada e Barreiro como a decisão os quer", () => {
    expect(tituloDaCidade("", "Lisboa", "recolha-monos", "lisboa")).toBe("Recolha de Monos em Lisboa — De Casa, Sem Esperar");
    expect(tituloDaCidade("", "Almada", "recolha-monos", "almada")).toBe("Recolha de Monos em Almada — De Casa, Sem Esperar");
    expect(tituloDaCidade("", "Lisboa", "recolha-entulho", "lisboa")).toBe("Recolha de Entulho em Lisboa — desde 49,20 € c/ IVA");
    expect(ENTULHO_DESDE_COM_IVA).toBe("desde 49,20 € c/ IVA");
    expect(descricaoDaCidade("recolha-monos", "", "Lisboa", "lisboa")).toBe(
      "Monos em Lisboa sem esperar pela Câmara: profissionais verificados tiram-nos de dentro de casa. 30 – 100 € + IVA (36,90 – 123 € com IVA). Propostas grátis.",
    );
    expect(descricaoDaCidade("recolha-entulho", "", "Lisboa", "lisboa")).toBe(
      "Entulho de obras em Lisboa, em sacos ou a granel e sem contentor: 10 sacos 40 – 50 € + IVA (49,20 – 61,50 € com IVA). Propostas grátis em menos de 6 horas.",
    );
  });
});

describe("as /Regiões/* antigas", () => {
  it("vão direitas à região, em qualquer grafia", () => {
    for (const [de, para] of [
      ["/Regi%C3%B5es/Lisboa", "/regioes/lisboa"],
      ["/Regi%C3%B5es/Lisboa/", "/regioes/lisboa"],
      ["/Regiões/Lisboa", "/regioes/lisboa"],
      ["/REGIOES/LISBOA", "/regioes/lisboa"],
      ["/regi%C3%B5es/lisboa", "/regioes/lisboa"],
      ["/Regi%C3%B5es/Margem-Sul", "/regioes/margem-sul"],
      ["/Regi%C3%B5es/Margem%20Sul", "/regioes/margem-sul"],
      ["/Regi%C3%B5es/Margem_Sul", "/regioes/margem-sul"],
      ["/Regi%C3%B5es/MargemSul", "/regioes/margem-sul"],
      ["/Regi%C3%B5es/Margem", "/regioes/margem-sul"],
      ["/Regi%C3%B5es/Setubal", "/regioes/setubal"],
      ["/Regi%C3%B5es/Set%C3%BAbal", "/regioes/setubal"],
      ["/Regi%C3%B5es", "/regioes"],
      ["/Regioes", "/regioes"],
      ["/Regi%C3%B5es/Almada", "/regioes"],
      ["/Regi%C3%B5es/Lisboa/Recolha", "/regioes/lisboa"],
    ]) {
      expect(destinoDasRegioesAntigas(de), de).toBe(para);
    }
  });

  it("não mexem no que já está certo nem no resto do site", () => {
    for (const p of ["/regioes", "/regioes/lisboa", "/regioes/margem-sul", "/regioes/setubal", "/regioes/porto", "/recolha-moveis-lisboa", "/"]) {
      expect(destinoDasRegioesAntigas(p), p).toBeNull();
    }
  });

  it("o middleware responde com 301", () => {
    const M = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    expect(M).toMatch(/destinoDasRegioesAntigas\(nextUrl\.pathname\)/);
    expect(M).toMatch(/NextResponse\.redirect\(new URL\(regiaoAntiga, request\.url\), 301\)/);
  });
});

describe("os dados estruturados", () => {
  it("servicePhone é um ContactPoint", () => {
    const s = readFileSync(join(process.cwd(), "src/app/recolha-de-moveis/page.tsx"), "utf8");
    expect(s).toMatch(/servicePhone: \{\s*"@type": "ContactPoint"/);
    expect(s).not.toMatch(/servicePhone: BUSINESS_PHONE/);
  });

  it("o Service das páginas em inglês já não leva inLanguage; vai no WebPage", () => {
    const s = readFileSync(join(process.cwd(), "src/app/en/[pagina]/page.tsx"), "utf8");
    const i = s.indexOf("const esquema = {");
    const bloco = s.slice(i, s.indexOf("};", i));
    expect(bloco).toContain('"@type": "WebPage"');
    const servico = bloco.slice(bloco.indexOf('"@type": "Service"'));
    expect(servico).not.toContain("inLanguage");
  });
});
