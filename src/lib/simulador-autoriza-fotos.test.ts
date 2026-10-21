import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * «Junto a autorização das fotos no simulador?» — «SIM», o dono, 21-10-2026.
 * As fotos chegam para pedir orçamento; para as mostrar é preciso o «sim» de
 * quem as mandou, e esse sim nunca vem marcado de origem.
 */
const FORM = readFileSync("src/app/simulador/SimulatorThreePhaseForm.tsx", "utf8").replace(/\r\n/g, "\n");

describe("a autorização para mostrar as fotos no simulador", () => {
  it("é opcional e começa desmarcada", () => {
    expect(FORM).toContain("autorizaFotos?: boolean;");
    expect(FORM).toContain("checked={formData.autorizaFotos === true}");
    expect(FORM).not.toMatch(/autorizaFotos:\s*true/);
  });

  it("só aparece a quem juntou fotos, e diz que nada identifica a pessoa", () => {
    expect(FORM).toContain("{(formData.files ?? []).length > 0 && (");
    expect(FORM).toContain("sem nada que me identifique");
  });
});
