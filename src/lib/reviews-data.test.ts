import { describe, expect, it } from "vitest";

import { dataISO, reviews } from "./reviews-data";

describe("dataISO", () => {
  it("converte o formato do Google para ISO-8601", () => {
    expect(dataISO("10 de jun. de 2026")).toBe("2026-06-10");
    expect(dataISO("8 de nov. de 2025")).toBe("2025-11-08");
    expect(dataISO("26 de mar. de 2026")).toBe("2026-03-26");
  });

  it("aceita o mês por extenso sem ponto", () => {
    expect(dataISO("1 de janeiro de 2026")).toBe("2026-01-01");
  });

  it("devolve undefined em vez de uma data inválida", () => {
    expect(dataISO("ontem")).toBeUndefined();
    expect(dataISO("10 de xxx. de 2026")).toBeUndefined();
  });

  it("todas as avaliações reais convertem — nenhuma fica sem data no schema", () => {
    for (const review of reviews) {
      expect(dataISO(review.date), review.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
