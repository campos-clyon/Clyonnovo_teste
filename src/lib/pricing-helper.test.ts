import { describe, it, expect } from "vitest";
import {
  countItemsFromDescription,
  resolveItemCount,
  calculateFastEstimate,
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

describe("FULL_LOAD_ITEM_THRESHOLD", () => {
  it("está fixado em 8 (1-7 itens = por item, 8+ = carga completa)", () => {
    expect(FULL_LOAD_ITEM_THRESHOLD).toBe(8);
  });
});
