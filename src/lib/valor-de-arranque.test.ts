import { describe, it, expect } from "vitest";
import { valorDeArranque, valorDeArranqueDaEstimativa } from "./valor-de-arranque";
import type { EstimateResult } from "@/app/simulador/types";

describe("valorDeArranqueDaEstimativa", () => {
  /*
   * O teste que faltava.
   *
   * Este objeto é montado com o tipo REAL da estimativa. Se alguém lhe mudar
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

  it("usa o preço SEM IVA, mesmo com o outro ao lado", () => {
    /*
     * "Nós sempre vamos mostrar o valor sem IVA; caso o cliente deseje
     * factura será mais 23 %." — 22-09-2026.
     *
     * Este teste dizia o contrário e exigia 132,08 — o preço com imposto.
     * Era esse número que ia parar ao `valorDesejadoCliente`, e daí ao
     * cartão do profissional por baixo da etiqueta «sem IVA». Se ele o
     * aceitasse, o `contaDoCliente` somava os 23 % OUTRA VEZ.
     */
    expect(valorDeArranqueDaEstimativa(base)).toBe(107.38);
    // E o de 132,08 continua lá na estimativa: o que mudou foi qual se escolhe.
    expect(base.estimatedPriceWithVat).toBe(132.08);
  });

  it("sem preço sem IVA não há arranque — o com IVA não serve de suplente", () => {
    /*
     * Um último recurso «melhor isto do que nada» seria reintroduzir o
     * defeito em silêncio, no único caso em que ninguém está a olhar.
     */
    expect(
      valorDeArranqueDaEstimativa({
        estimatedPriceWithVat: 132.08,
        estimatedPriceWithoutVat: null,
        estimateMaxWithoutVat: null,
        estimateMinWithoutVat: null,
      }),
    ).toBeNull();
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

  // A prova do bug: nenhum destes três campos existe no objeto real.
  it("um objeto com total/max/min NÃO serve de arranque", () => {
    expect(
      valorDeArranqueDaEstimativa({ total: 132, max: 140, min: 120 } as never),
    ).toBeNull();
  });
});

describe("valorDeArranque", () => {
  /*
   * As estimativas destes casos passaram a trazer o preço SEM IVA, que é o
   * que a função escolhe. Antes traziam só o `estimatedPriceWithVat` e a
   * conta saía com imposto lá dentro.
   */
  const estimativa = { estimatedPriceWithoutVat: 107.38, estimatedPriceWithVat: 132.08 };

  it("o que o cliente escreveu manda sobre a estimativa", () => {
    expect(valorDeArranque(340, estimativa)).toBe(340);
    expect(valorDeArranque("340", estimativa)).toBe(340);
  });

  it("sem valor do cliente, vale a estimativa — e é a de sem IVA", () => {
    for (const vazio of [null, "", undefined]) {
      expect(valorDeArranque(vazio, estimativa)).toBe(107.38);
    }
  });

  it("sem nada, não há arranque", () => {
    expect(valorDeArranque(null, null)).toBeNull();
  });
});
