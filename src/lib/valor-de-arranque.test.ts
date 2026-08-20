import { describe, it, expect } from "vitest";
import { valorDeArranque, valorDeArranqueDaEstimativa } from "./valor-de-arranque";
import type { EstimateResult } from "@/app/simulador/types";

describe("valorDeArranqueDaEstimativa", () => {
  /*
   * O teste que faltava.
   *
   * Este objecto é montado com o tipo REAL da estimativa. Se alguém lhe mudar
   * o nome a `estimatedPriceWithVat`, isto deixa de compilar — que é
   * exactamente o aviso que não existiu quando a rota foi escrita a ler
   * `estimativa.total`, um campo que nunca existiu em lado nenhum.
   */
  const base = {
    status: "ok",
    estimatedPriceWithoutVat: 107.38,
    vatAmount: 24.7,
    estimatedPriceWithVat: 132.08,
    difficultyLevel: "muito_facil",
    summary: "",
    assumptions: [],
    missingFields: [],
    customerMessage: "",
    internalNotes: [],
  } as unknown as EstimateResult;

  it("usa o preço com IVA — o número que o cliente viu", () => {
    expect(valorDeArranqueDaEstimativa(base)).toBe(132.08);
  });

  it("cai para o preço sem IVA quando não há com IVA", () => {
    expect(valorDeArranqueDaEstimativa({ ...base, estimatedPriceWithVat: null })).toBe(107.38);
  });

  it("cai para o máximo do intervalo quando não há preço fechado", () => {
    expect(
      valorDeArranqueDaEstimativa({
        estimatedPriceWithVat: null,
        estimatedPriceWithoutVat: null,
        estimateMaxWithoutVat: 90,
      }),
    ).toBe(90);
  });

  it("sem estimativa nenhuma não há arranque", () => {
    expect(valorDeArranqueDaEstimativa(null)).toBeNull();
    expect(valorDeArranqueDaEstimativa(undefined)).toBeNull();
    expect(valorDeArranqueDaEstimativa({})).toBeNull();
  });

  // Um zero não é um valor de partida: é a ausência de um. Deixá-lo passar
  // punha o profissional a receber um pedido de 0 €.
  it("zero e lixo não contam", () => {
    expect(valorDeArranqueDaEstimativa({ estimatedPriceWithVat: 0 })).toBeNull();
    expect(valorDeArranqueDaEstimativa({ estimatedPriceWithVat: NaN })).toBeNull();
    expect(
      valorDeArranqueDaEstimativa({ estimatedPriceWithVat: -5, estimatedPriceWithoutVat: 40 }),
    ).toBe(40);
  });

  // A prova do bug: nenhum destes três campos existe no objecto real.
  it("um objecto com total/max/min NÃO serve de arranque", () => {
    expect(
      valorDeArranqueDaEstimativa({ total: 132, max: 140, min: 120 } as never),
    ).toBeNull();
  });
});

describe("valorDeArranque", () => {
  it("o que o cliente escreveu manda sobre a estimativa", () => {
    expect(valorDeArranque(340, { estimatedPriceWithVat: 132.08 })).toBe(340);
    expect(valorDeArranque("340", { estimatedPriceWithVat: 132.08 })).toBe(340);
  });

  it("sem valor do cliente, vale a estimativa", () => {
    expect(valorDeArranque(null, { estimatedPriceWithVat: 132.08 })).toBe(132.08);
    expect(valorDeArranque("", { estimatedPriceWithVat: 132.08 })).toBe(132.08);
    expect(valorDeArranque(undefined, { estimatedPriceWithVat: 132.08 })).toBe(132.08);
  });

  it("sem nada, não há arranque", () => {
    expect(valorDeArranque(null, null)).toBeNull();
  });
});
