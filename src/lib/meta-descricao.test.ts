import { describe, expect, it } from "vitest";

import { LIMITE_DESCRICAO, limitarDescricao } from "./meta-descricao";

describe("limitarDescricao", () => {
  it("deixa passar o que já cabe", () => {
    const curta = "Recolha de móveis em Almada. Orçamento grátis em 24h.";
    expect(limitarDescricao(curta)).toBe(curta);
  });

  it("fica pelas frases inteiras que cabem", () => {
    const texto =
      "Recolha de móveis em Lisboa: sofás, camas, armários, colchões e eletrodomésticos. " +
      "Desmontagem, carga porta a porta e transporte incluídos. " +
      "Preços desde 40€. Orçamento grátis por WhatsApp.";
    const r = limitarDescricao(texto);
    expect(r.length).toBeLessThanOrEqual(LIMITE_DESCRICAO);
    expect(r.endsWith(".")).toBe(true);
    expect(r).not.toContain("Orçamento grátis por WhatsApp.");
  });

  it("não parte palavras quando nem a primeira frase cabe", () => {
    const texto = `${"palavra ".repeat(40)}fim.`;
    const r = limitarDescricao(texto);
    expect(r.length).toBeLessThanOrEqual(LIMITE_DESCRICAO);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/palavr…$/);
  });

  it("normaliza espaços e quebras de linha", () => {
    expect(limitarDescricao("  Recolha\n  de   móveis. ")).toBe("Recolha de móveis.");
  });
});
