import { describe, expect, it } from "vitest";

import { descricaoDaCidade } from "./descricoes-seo";

/*
 * «Recolha de monos em Lisboa: … Preços de 30 – 100 €, sem IVA.» — o que o
 * Google mostrava a 22-10-2026. Os valores sem IVA nunca vão sozinhos.
 */
describe("a descrição das páginas de cidade", () => {
  it("diz o preço com IVA ao lado do sem IVA", () => {
    expect(descricaoDaCidade("recolha-monos", "Recolha de Monos", "Lisboa", "lisboa")).toContain(
      "30 – 100 € + IVA (36,90 – 123 € com IVA).",
    );
    expect(descricaoDaCidade("recolha-moveis", "Recolha de Móveis", "Lisboa", "lisboa")).toContain(
      "40 – 120 € + IVA (49,20 – 147,60 € com IVA).",
    );
    // Desde 27-10-2026 (d9) o entulho abre pelo preço de entrada: os 10 sacos.
    expect(descricaoDaCidade("recolha-entulho", "Recolha de Entulho", "Lisboa", "lisboa")).toContain(
      "10 sacos 40 – 50 € + IVA (49,20 – 61,50 € com IVA).",
    );
  });

  it("em nenhuma página de cidade o sem IVA aparece sozinho", () => {
    for (const s of ["recolha-monos", "recolha-moveis", "recolha-entulho"]) {
      for (const [nome, cidade] of [["Lisboa", "lisboa"], ["Vila Franca de Xira", "vila-franca-de-xira"], ["Almada", "almada"]]) {
        const d = descricaoDaCidade(s, "Serviço", nome, cidade);
        expect(d).not.toMatch(/sem IVA\./);
        if (d.includes("+ IVA")) expect(d).toContain("com IVA");
      }
    }
  });
});
