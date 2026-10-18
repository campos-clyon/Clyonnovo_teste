import { describe, it, expect } from "vitest";
import { eur, firstPositive, legacyPriceText, legacyHasPrice } from "./quote-price";

// Um total a 0 não quer dizer "sem preço" quando o intervalo tem valor. Estes
// testes existem para impedir que o painel volte a mostrar 0 € em pedidos que
// têm valor.

describe("fluxo legado (MySQL) — firstPositive / legacyPriceText", () => {
  // "0.00" é uma string truthy: `if (!v)` deixava passar zeros e as cadeias
  // `??` paravam no primeiro valor não-nulo mesmo sendo 0, com o intervalo
  // estimateMin/Max declarado no tipo e nunca consultado.
  it("firstPositive salta zeros e strings de zero", () => {
    expect(firstPositive("0.00", "0", 150)).toBe(150);
    expect(firstPositive(null, undefined, "", 0, "220.50")).toBe(220.5);
    expect(firstPositive(0, "0.00", null)).toBeNull();
  });

  it("mostra o intervalo quando os totais vêm a zero", () => {
    const o = { estimateTotal: "0.00", precoFinal: null, estimateMin: "196", estimateMax: "249" };
    expect(legacyPriceText(o)).toBe("196 – 249 €");
  });

  it("prefere o valor fechado quando existe", () => {
    const o = { estimateTotal: "180", precoFinal: "200", estimateMin: "150", estimateMax: "250" };
    expect(legacyPriceText(o)).toBe("200 €");
  });

  it("c/IVA usa precoFinalIva quando pedido", () => {
    const o = { precoFinalIva: "246", precoFinal: "200", estimateTotal: "180" };
    expect(legacyPriceText(o, { withVat: true })).toBe("246 €");
    expect(legacyPriceText(o)).toBe("200 €");
  });

  it("intervalo degenerado (min = max) mostra um só valor", () => {
    expect(legacyPriceText({ estimateMin: "199", estimateMax: "199" })).toBe("199 €");
  });

  it("sem nenhum valor positivo devolve null (o ecrã mostra —)", () => {
    expect(legacyPriceText({ estimateTotal: "0.00", precoFinal: "0" })).toBeNull();
    expect(legacyPriceText({})).toBeNull();
    expect(legacyPriceText(null)).toBeNull();
    expect(legacyHasPrice({ estimateTotal: "0" })).toBe(false);
    expect(legacyHasPrice({ estimateMin: "196", estimateMax: "249" })).toBe(true);
  });
});

describe("formatação", () => {
  it("formata inteiros sem decimais e não-inteiros com dois", () => {
    expect(eur(199)).toBe("199");
    expect(eur(199.5)).toBe("199,50");
    expect(eur(249.99)).toBe("249,99");
  });
});
