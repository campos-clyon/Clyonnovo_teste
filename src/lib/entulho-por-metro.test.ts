import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRECOS } from "./precos-publicos";

/**
 * A GRELHA DO ENTULHO SAI DO PREÇO POR m³ — 01-10-2026, decisão do dono:
 * «Vale o 110 €/m³».
 *
 * A página dizia «até 3 m³: 180–280 €» ao lado de «desde 110 €/m³» — 60 €/m³
 * numa linha e 110 €/m³ no título. Os volumes passam a ser o preço por m³ de
 * `precos-publicos.ts` vezes o volume.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAGINA = semNotas(ler("src/app/recolha-de-entulho/page.tsx"));

describe("recolha de entulho por volume", () => {
  it("o preço por m³ continua a ser 110 €", () => {
    expect(PRECOS.recolha_entulho.minimo).toBe(110);
    expect(PRECOS.recolha_entulho.unidade).toBe("m³");
  });

  it("as linhas de 1, 3 e 5 m³ são calculadas, e a de cima de 5 é orçamento", () => {
    expect(PAGINA).toMatch(/até 1 m³\)", priceFrom: desdeOsMetros\(1\)/);
    expect(PAGINA).toMatch(/até 3 m³\)", priceFrom: desdeOsMetros\(3\)/);
    expect(PAGINA).toMatch(/até 5 m³\)", priceFrom: desdeOsMetros\(5\)/);
    expect(PAGINA).toMatch(/acima de 5 m³\)", priceFrom: "Orçamento personalizado"/);
  });

  it("e as faixas antigas não voltam", () => {
    for (const velho of ['"180 €"', '"280 €"', '"400 €"']) {
      expect(PAGINA, velho).not.toContain(velho);
    }
  });
});
