import { describe, it, expect } from "vitest";
import {
  countItemsFromDescription,
  resolveItemCount,
  calculateFastEstimate,
  estimateLaborHours,
  FULL_LOAD_ITEM_THRESHOLD,
} from "./pricing-helper";

describe("countItemsFromDescription", () => {
  // Caso do bug documentado em CORRECOES-motor-precos.md: descrições mistas
  // (números por extenso + dígitos) eram subcontadas antes da correção.
  it("conta corretamente itens mistos (extenso + dígitos)", () => {
    expect(
      countItemsFromDescription("Uma cama com mesa e 1 frigorífico mais uma máquina de lavar"),
    ).toBe(4);
  });

  it("conta um único item simples", () => {
    expect(countItemsFromDescription("um sofá")).toBe(1);
  });

  it("conta itens com quantificador numérico", () => {
    expect(countItemsFromDescription("3 cadeiras")).toBe(3);
  });

  it("reconhece palavras-chave de carga completa", () => {
    expect(countItemsFromDescription("quero esvaziar toda a casa")).toBe(6);
  });

  it("devolve null quando não há palavras-chave reconhecíveis", () => {
    expect(countItemsFromDescription("preciso de ajuda com uma coisa qualquer")).toBeNull();
  });

  it("devolve null para descrição vazia", () => {
    expect(countItemsFromDescription("")).toBeNull();
  });
});

describe("resolveItemCount", () => {
  it("prioriza heavyItems[] sobre a descrição", () => {
    const count = resolveItemCount({
      heavyItems: ["sofá", "cama", "mesa"],
      description: "só um item pequeno",
    });
    expect(count).toBe(3);
  });

  it("usa a descrição quando heavyItems está vazio", () => {
    const count = resolveItemCount({ heavyItems: [], description: "duas cadeiras" });
    expect(count).toBe(2);
  });

  it("nunca devolve 0 — mínimo conservador de 1", () => {
    const count = resolveItemCount({ description: "" });
    expect(count).toBe(1);
  });

  it("usa volumeTier quando descrição e heavyItems estão vazios", () => {
    expect(resolveItemCount({ description: "", volumeTier: "carrinha" })).toBe(4);
    expect(resolveItemCount({ description: "", volumeTier: "camiao_caixa" })).toBe(10);
    expect(resolveItemCount({ description: "", volumeTier: "camiao_lixo" })).toBe(18);
  });

  it("descrição tem prioridade sobre volumeTier", () => {
    const count = resolveItemCount({
      description: "duas cadeiras",
      volumeTier: "camiao_lixo",
    });
    expect(count).toBe(2);
  });

  it("volumeTier 'incerto' não influencia a contagem", () => {
    expect(resolveItemCount({ description: "", volumeTier: "incerto" })).toBe(1);
  });
});

describe("calculateFastEstimate — margem de 'Outro Serviço'", () => {
  const base = {
    floor: "0",
    hasElevator: "yes",
    parkingDistance: "easy",
    distanceFromBase: { distanceKm: 10 },
    description: "preciso de ajuda com um serviço qualquer",
  };

  it("aplica 30% de margem para serviceType 'outro', independente da margem configurada", async () => {
    const result = await calculateFastEstimate({ ...base, serviceType: "outro" });
    const note = result.internalNotes.find((n) => n.includes("Custo total"));
    expect(note).toContain("margem 30%");
  });

  // Regra comercial em vigor desde o commit aa37b12 (13 Jul 2026):
  // margem padrão 0,40 → 0,50. Este teste valida a margem de 50%.
  it("usa a margem por defeito (50%) para outras categorias", async () => {
    const result = await calculateFastEstimate({
      ...base,
      serviceType: "recolha_moveis",
      heavyItems: ["sofá"],
    });
    const note = result.internalNotes.find((n) => n.includes("Custo total"));
    expect(note).toContain("margem 50%");
  });
});

describe("calculateFastEstimate — volumeTier como carga completa", () => {
  it("camiao_caixa sem descrição gera preço de carga completa, não de 1 item", async () => {
    const result = await calculateFastEstimate({
      serviceType: "recolha_moveis",
      description: "",
      volumeTier: "camiao_caixa",
      floor: "0",
      hasElevator: "yes",
      distanceFromBase: { distanceKm: 15 },
    });
    expect(result.itemCount).toBe(10);
    expect(result.isFullLoad).toBe(true);
    expect(result.estimatedPriceWithoutVat).toBeGreaterThanOrEqual(220);
  });

  it("carrinha sem descrição gera preço de 4 itens soltos", async () => {
    const result = await calculateFastEstimate({
      serviceType: "recolha_moveis",
      description: "",
      volumeTier: "carrinha",
      floor: "0",
      hasElevator: "yes",
      distanceFromBase: { distanceKm: 10 },
    });
    expect(result.itemCount).toBe(4);
    expect(result.isFullLoad).toBe(false);
  });
});

describe("estimateLaborHours — desconto de eficiência (itens soltos)", () => {
  const base = {
    serviceType: "recolha_moveis" as const,
    floor: "0",
    hasElevator: "yes" as const,
    parkingDistance: "easy" as const,
  };

  // Resultado final arredondado a 0.5h com mínimo de 1h (LABOR_MIN_HOURS).
  // Fórmula bruta: 0.5 + (n-1)×0.3, depois round(h*2)/2, depois max(1, h).

  it("1 item = 1h (bruto 0.5 → arred. 0.5 → mín. 1h)", () => {
    expect(estimateLaborHours({ ...base, heavyItems: ["sofá"] })).toBe(1);
  });

  it("2 itens = 1h (bruto 0.8 → arred. 1.0 → mín. 1h)", () => {
    expect(estimateLaborHours({ ...base, heavyItems: ["sofá", "cama"] })).toBe(1);
  });

  it("4 itens = 1.5h (bruto 1.4 → arred. 1.5)", () => {
    expect(estimateLaborHours({ ...base, heavyItems: ["a", "b", "c", "d"] })).toBe(1.5);
  });

  it("7 itens = 2.5h (bruto 2.3 → arred. 2.5) — último nível antes de carga completa", () => {
    expect(estimateLaborHours({ ...base, heavyItems: ["a", "b", "c", "d", "e", "f", "g"] })).toBe(2.5);
  });

  it("8+ itens = carga completa (4h base), NÃO usa desconto de eficiência", () => {
    expect(estimateLaborHours({
      ...base,
      heavyItems: ["a", "b", "c", "d", "e", "f", "g", "h"],
    })).toBe(4);
  });

  it("horas crescem sub-linearmente com mais itens", () => {
    const h1 = estimateLaborHours({ ...base, heavyItems: ["a"] });
    const h4 = estimateLaborHours({ ...base, heavyItems: ["a", "b", "c", "d"] });
    const h7 = estimateLaborHours({ ...base, heavyItems: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(h4).toBeLessThan(4 * h1);
    expect(h7).toBeLessThan(7 * h1);
  });
});

describe("calculateFastEstimate — mínimo por item com desconto de eficiência", () => {
  it("2 itens: mínimo = 48.78 + 29.27 = 78.05€ (não 2×48.78)", async () => {
    const result = await calculateFastEstimate({
      serviceType: "recolha_moveis",
      heavyItems: ["sofá", "cama"],
      description: "",
      floor: "0",
      hasElevator: "yes",
      parkingDistance: "easy",
      distanceFromBase: { distanceKm: 5 },
    });
    const minNote = result.assumptions.find((n: string) => n.includes("Mínimo por item"));
    if (minNote) {
      expect(minNote).toContain("60%");
      expect(minNote).toContain("78.05");
    }
  });

  it("sem distância (km=0), Motor B ainda entrega preço coerente (não zero)", async () => {
    const result = await calculateFastEstimate({
      serviceType: "recolha_moveis",
      heavyItems: ["sofá"],
      description: "",
      floor: "2",
      hasElevator: "no",
      parkingDistance: "easy",
      distanceFromBase: { distanceKm: 0 },
    });
    expect(result.ok).toBe(true);
    expect(result.estimatedPriceWithoutVat).toBeGreaterThan(0);
  });
});

describe("FULL_LOAD_ITEM_THRESHOLD", () => {
  it("está fixado em 8 (1-7 itens = por item, 8+ = carga completa)", () => {
    expect(FULL_LOAD_ITEM_THRESHOLD).toBe(8);
  });
});
