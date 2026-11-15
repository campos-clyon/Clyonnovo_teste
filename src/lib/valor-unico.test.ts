import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { valorUnicoSugerido } from "./valor-unico";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("d39 — o valor único sugerido ao «Passar a valor fixo»", () => {
  it("a mediana das propostas abertas: 125 / 140 / 150 → 140", () => {
    expect(valorUnicoSugerido([150, 125, 140])).toBe(140);
  });

  it("com duas, a média, arredondada a 5 €", () => {
    expect(valorUnicoSugerido([125, 140])).toBe(135); // 132,5 → 135
    expect(valorUnicoSugerido([120, 130])).toBe(125);
  });

  it("arredonda sempre a 5 €", () => {
    expect(valorUnicoSugerido([143])).toBe(145);
    expect(valorUnicoSugerido([142])).toBe(140);
    expect(valorUnicoSugerido([100, 110, 121, 300])).toBe(115); // (110 + 121) / 2 = 115,5
  });

  it("sem propostas, nada a sugerir; e nunca 0 €", () => {
    expect(valorUnicoSugerido([])).toBeNull();
    expect(valorUnicoSugerido([Number.NaN, 0, -3])).toBeNull();
    expect(valorUnicoSugerido([2])).toBe(5);
  });

  it("a Mesa passa a sugestão ao formulário, pelas propostas que o cliente veria", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain("valorUnicoSugerido(propostasParaOCliente(p.negociacoes).map((x) => x.semIva))");
    expect(MESA).toMatch(/<FormularioDaOferta[\s\S]{0,400}valorInicial=\{valorSugerido/);
  });
});
