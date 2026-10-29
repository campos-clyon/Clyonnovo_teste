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

/*
 * A página do anúncio dizia «Móveis desde 40 € + IVA», escrito à mão e sem o
 * valor com IVA ao lado (28-10-2026). Lê a grelha, como o resto do site.
 */
describe("a descrição de /orcamento-recolha-lisboa", () => {
  it("diz o preço dos móveis da fonte, com o IVA ao lado, em até 155 caracteres", async () => {
    const { metadata } = await import("@/app/orcamento-recolha-lisboa/page");
    const { PRECOS } = await import("./precos-publicos");
    const { comIva, euros } = await import("./quanto-custa");
    const d = String(metadata.description);
    const m = PRECOS.recolha_moveis.minimo!;
    expect(d).toContain(`Móveis desde ${euros(m)} + IVA (${euros(comIva(m))} com IVA).`);
    expect([...d].length).toBeLessThanOrEqual(155);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fonte = readFileSync(join(process.cwd(), "src/app/orcamento-recolha-lisboa/page.tsx"), "utf8");
    expect(fonte).not.toMatch(/desde \d+ €/);
  }, 120_000);
});
