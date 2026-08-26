import { describe, it, expect } from "vitest";
import { precisaoDaMorada, faltaNaMorada, partirViaENumero } from "./morada";

/**
 * A morada escrita à mão, sem escolher da lista.
 *
 * "A morada está a dar erro mesmo estando certa."
 *
 * E estava. «R. dos Jasmins 3, Amora» tem rua e tem número, e o formulário
 * respondia «isto é uma localidade, não uma morada» — duas coisas erradas na
 * mesma frase: recusava uma morada válida, e explicava-o com um motivo que
 * ninguém conseguia corrigir, porque não havia nada para corrigir.
 *
 * A causa não era a leitura da linha, que funcionava. Era o SÍTIO onde ela
 * corria: só no momento de escolher uma sugestão. Quem escrevia a morada certa
 * e seguia em frente ficava com a linha e mais nada, e uma linha sem
 * componentes caía sempre em «localidade».
 */

describe("uma morada escrita, sem componentes do Google", () => {
  const semComponentes = (linha: string, cidade?: string) => ({
    formattedAddress: linha,
    city: cidade ?? null,
  });

  it("a morada dele passa — é o caso que ele apanhou", () => {
    expect(precisaoDaMorada(semComponentes("R. dos Jasmins 3, Amora", "Amora"))).toBe("porta");
    expect(faltaNaMorada(semComponentes("R. dos Jasmins 3, Amora", "Amora"))).toBe("");
  });

  it("com o código postal e o país pelo meio, também", () => {
    expect(
      precisaoDaMorada(semComponentes("R. dos Jasmins 3, 2845-000 Amora, Portugal", "Amora")),
    ).toBe("porta");
  });

  it("a abreviatura conta tanto como a palavra inteira", () => {
    for (const linha of [
      "R. dos Jasmins 3",
      "Rua dos Jasmins 3",
      "Av. da República 12, Lisboa",
      "Travessa do Forno 7, Almada",
      "Praceta José Malhoa 2, Setúbal",
    ]) {
      expect(precisaoDaMorada(semComponentes(linha))).toBe("porta");
    }
  });

  it("rua sem número continua a pedir o número, e não a rua", () => {
    // O #186 real: "Rua Professor Simões Raposo". Chega-se à rua e procura-se
    // a porta — é uma falta a sério, e o pedido continua a apontá-la.
    const m = semComponentes("Rua Professor Simões Raposo, Lisboa", "Lisboa");
    expect(precisaoDaMorada(m)).toBe("rua");
    expect(faltaNaMorada(m)).toBe("Falta o número de porta.");
  });

  it("uma localidade a sério continua a ser recusada", () => {
    // O #12 real: "Ericeira, Mafra, Lisboa, Portugal" — uma vila inteira. A
    // carrinha ia parar a quilómetros do sítio, e é por isso que o guarda
    // existe. Alargá-lo não pode ser abri-lo.
    for (const [linha, cidade] of [
      ["Ericeira, Mafra, Lisboa, Portugal", "Ericeira"],
      ["Amora, Portugal", "Amora"],
      ["Montijo", null],
      ["Almada, Setúbal", "Almada"],
    ] as const) {
      expect(precisaoDaMorada(semComponentes(linha, cidade ?? undefined))).toBe("localidade");
    }
  });

  it("sem morada nenhuma continua a não haver morada", () => {
    expect(precisaoDaMorada({})).toBe("nenhuma");
    expect(precisaoDaMorada({ formattedAddress: "  " })).toBe("nenhuma");
  });
});

describe("os componentes do Google mandam quando existem", () => {
  it("um código postal a seguir à rua não vira número de porta", () => {
    // "Rua do Ouro, 1100-060 Lisboa" — só se olha para o pedaço antes da
    // primeira vírgula, por isso o 1100 nunca é confundido com uma porta.
    expect(
      precisaoDaMorada({ formattedAddress: "Rua do Ouro, 1100-060 Lisboa", city: "Lisboa" }),
    ).toBe("rua");
  });

  it("a rua do Google manda quando existe", () => {
    // Quem escolheu da lista tem componentes exactos. Voltar a adivinhar por
    // cima deles seria trocar a certeza por uma heurística.
    const escolhido = {
      street: "Rua Professor Simões Raposo",
      streetNumber: "12",
      formattedAddress: "Ericeira, Mafra, Lisboa, Portugal",
    };
    expect(precisaoDaMorada(escolhido)).toBe("porta");
  });

  it("com rua mas sem número, o número ainda se lê da linha", () => {
    const meio = {
      street: "R. dos Jasmins",
      streetNumber: "",
      formattedAddress: "R. dos Jasmins 3, Amora",
      city: "Amora",
    };
    // A rua veio do Google e fica; o número lê-se da linha, que o tem.
    expect(precisaoDaMorada(meio)).toBe("porta");
    expect(partirViaENumero(meio.formattedAddress, meio.city).streetNumber).toBe("3");
  });
});

describe("o número depois da vírgula — a forma portuguesa", () => {
  it("«Rua dos Jasmins, 3, 2845-483 Amora» tem número 3", () => {
    // O Google devolve exactamente isto ao escolher a sugestão. Apanhado a
    // atravessar o simulador a sério: o formulário pedia o número de porta que
    // a pessoa já tinha escolhido da lista.
    expect(partirViaENumero("Rua dos Jasmins, 3, 2845-483 Amora", "Amora")).toEqual({
      street: "Rua dos Jasmins",
      streetNumber: "3",
    });
    expect(
      precisaoDaMorada({ formattedAddress: "Rua dos Jasmins, 3, 2845-483 Amora", city: "Amora" }),
    ).toBe("porta");
  });

  it("um código postal nunca vira número de porta", () => {
    // 2845-483 tem dígitos depois do traço; um número de porta não tem.
    for (const linha of [
      "Rua do Ouro, 1100-060 Lisboa",
      "Avenida da Liberdade, 2845-483 Amora, Portugal",
    ]) {
      expect(partirViaENumero(linha, null).streetNumber).toBe("");
      expect(precisaoDaMorada({ formattedAddress: linha })).toBe("rua");
    }
  });

  it("«12-A» e «12 B» passam, porque são portas", () => {
    expect(partirViaENumero("Rua do Ouro, 12-A, Lisboa", "Lisboa").streetNumber).toBe("12-A");
    expect(partirViaENumero("Rua do Ouro, 12 B, Lisboa", "Lisboa").streetNumber).toBe("12 B");
  });
});
