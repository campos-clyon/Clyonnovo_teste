import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estimativaParaOCliente } from "./estimativa-para-o-cliente";
import type { EstimateResult } from "@/app/simulador/types";

/** A rota pública da estimativa não mostra a fórmula de custo interna (11-11-2026). */
describe("a estimativa que o público recebe", () => {
  const completa = {
    status: "estimated",
    estimatedPriceWithoutVat: 100,
    vatAmount: 23,
    estimatedPriceWithVat: 123,
    estimateMinWithoutVat: 90,
    estimateMaxWithoutVat: 110,
    difficultyLevel: 2,
    summary: "Estimativa calculada com fórmula de custo real: margem 40%",
    assumptions: ["9 €/h por pessoa"],
    missingFields: [],
    customerMessage: "Estimativa de referência",
    internalNotes: ["Total s/IVA"],
    labor: { estimatedHours: 2, laborCost: 54 },
    recommendedPriceWithoutVat: 130,
    analysisSource: "clyon_pricing",
    confidence: "high",
  } as unknown as EstimateResult;

  it("leva os números e tira a mão de obra, a fórmula e as notas", () => {
    const p = estimativaParaOCliente(completa) as unknown as Record<string, unknown>;
    expect(p).toMatchObject({ estimatedPriceWithoutVat: 100, estimatedPriceWithVat: 123, difficultyLevel: 2, analysisSource: "clyon_pricing" });
    expect(p.labor).toBeUndefined();
    expect(p.recommendedPriceWithoutVat).toBeUndefined();
    expect(p.internalNotes).toEqual([]);
    expect(p.assumptions).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/margem|€\/h por pessoa|overhead/i);
  });

  it("a rota responde ao público pela função, e à equipa com tudo", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/simulator/analyze/route.ts"), "utf8");
    expect(rota).toContain("daEquipa ? r : estimativaParaOCliente(r)");
    expect(rota).not.toMatch(/return Response\.json\(result\)/);
    expect(rota).not.toMatch(/return Response\.json\(\{\s*\.\.\.fastEstimate/);
  });
});
