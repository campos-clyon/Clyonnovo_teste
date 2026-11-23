import { describe, expect, it } from "vitest";

import { descricaoDaCidade } from "./descricoes-seo";

/*
 * «Recolha de monos em Lisboa: … Preços de 30 – 100 €, sem IVA.» — o que o
 * Google mostrava a 22-10-2026. Os valores sem IVA nunca vão sozinhos.
 */
describe("a descrição das páginas de cidade", () => {
  it("diz o preço com IVA ao lado do sem IVA", () => {
    // Lisboa (monos e móveis) com descrição própria desde a d96 (23-11-2026): o par sem/com IVA fica.
    expect(descricaoDaCidade("recolha-monos", "Recolha de Monos", "Lisboa", "lisboa")).toContain(
      "desde 60 € + IVA (73,80 € com IVA).",
    );
    expect(descricaoDaCidade("recolha-moveis", "Recolha de Móveis", "Lisboa", "lisboa")).toContain(
      "desde 15 € + IVA (18,45 € com IVA) por peça; mínimo 60 € + IVA (73,80 € com IVA).",
    );
    expect(descricaoDaCidade("recolha-moveis", "Recolha de Móveis", "Almada", "almada")).toContain(
      // Por peça desde 03-11-2026 (d6 v2), com a recolha mínima desde a d7 (04-11-2026).
      "Por peça, 15 a 65 € + IVA (18,45 a 79,95 € com IVA), mínimo 60 € + IVA.",
    );
    // Desde 27-10-2026 (d9) o entulho abre pelo preço de entrada: os 10 sacos.
    expect(descricaoDaCidade("recolha-entulho", "Recolha de Entulho", "Lisboa", "lisboa")).toContain(
      "10 sacos 40 – 48 € + IVA (49,20 – 59,04 € com IVA).",
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
    // O «desde» é a recolha mínima desde a d7 (04-11-2026): 40 € + IVA, e não a peça pequena.
    expect(m).toBe(60);
    expect(d).toContain(`Móveis desde ${euros(m)} + IVA (${euros(comIva(m))} com IVA), contados por peça.`);
    expect([...d].length).toBeLessThanOrEqual(155);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fonte = readFileSync(join(process.cwd(), "src/app/orcamento-recolha-lisboa/page.tsx"), "utf8");
    expect(fonte).not.toMatch(/desde \d+ €/);
  }, 120_000);
});
