import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CITIES, SERVICES } from "./seo-data";
import { RECOLHA_MINIMA_DOS_MOVEIS } from "./precos-publicos";
import { comIva, euros } from "./quanto-custa";
import { cabeNoGoogle, tituloDaCidade } from "./titulos-seo";

/**
 * d13 (27-11-2026): nos títulos de recolha de móveis o valor com IVA vai ao lado
 * do valor sem IVA («60 € + IVA = 73,80 €», pelo mínimo das constantes) sempre que cabe nos 60 caracteres;
 * o og:title e o twitter:title são o mesmo título (o Next copia-o do Open Graph).
 */
describe("o título dos móveis com o IVA ao lado", () => {
  const moveis = SERVICES.find((s) => s.slug === "recolha-moveis")!;
  const titulos = CITIES.map((c) => tituloDaCidade(moveis.name, c.name, moveis.slug, c.slug));

  it("todos cabem nos 60 caracteres, com a marca", () => {
    for (const t of titulos) expect(cabeNoGoogle(t), t).toBe(true);
  });

  it("onde o par cabe, o valor com IVA está ao lado; nunca o sem IVA sozinho", () => {
    const par = `${RECOLHA_MINIMA_DOS_MOVEIS} € + IVA = ${euros(comIva(RECOLHA_MINIMA_DOS_MOVEIS))}`;
    expect(titulos.filter((t) => t.includes(par)).length).toBeGreaterThan(10);
    for (const t of titulos) if (/\d\s*€/.test(t)) expect(t, t).toMatch(/IVA/);
  });

  it("a página de cidade não define um twitter próprio que perca o título", () => {
    const pagina = readFileSync(join(process.cwd(), "src/app/[...slug]/page.tsx"), "utf8");
    expect(pagina).toMatch(/openGraph: og\(\{\s*title,/);
  });
});
