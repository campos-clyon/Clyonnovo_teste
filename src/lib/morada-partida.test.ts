import { describe, it, expect } from "vitest";
import { completarComAMorada, partirMorada } from "./morada-partida";

/**
 * *«Os dados do cliente, mesmo vindo com o código postal no endereço, ele não
 * vem no campo "Código postal".»* — 18-09-2026.
 *
 * O campo ficava vazio com um placeholder por baixo — `2845-513`, que é a
 * morada da CLYON — e quem olhasse de lado lia o placeholder como se fosse o
 * valor do cliente.
 */

describe("partir uma morada escrita numa linha", () => {
  it("o caso relatado, tal como veio", () => {
    expect(partirMorada("Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal")).toEqual({
      rua: "Praceta Carlos da Costa Frescata, 4",
      codigoPostal: "2910-758",
      localidade: "Setúbal",
    });
  });

  it("aguenta as formas em que as pessoas escrevem mesmo", () => {
    for (const [morada, cp, loc] of [
      ["R. Pascoal de Melo 127, 1000-169 Lisboa, Portugal", "1000-169", "Lisboa, Portugal"],
      ["Av. da Liberdade 12 — 1250-096 Lisboa", "1250-096", "Lisboa"],
      ["Rua X n.º 3, 4º Esq, 2845-513", "2845-513", null],
      ["2910-758 Setúbal", "2910-758", "Setúbal"],
    ] as const) {
      const r = partirMorada(morada);
      expect(r.codigoPostal, morada).toBe(cp);
      expect(r.localidade, morada).toBe(loc);
    }
  });

  /*
   * ⚠️ SEM HÍFEN NÃO É CÓDIGO POSTAL.
   *
   * «Avenida 1234 567» seria lido como um — e um número de porta a virar
   * código postal manda o trabalho para a outra ponta do país, porque são as
   * coordenadas que decidem que profissionais o alcançam.
   */
  it("não inventa um código postal onde não há", () => {
    for (const morada of [
      "Rua Sousa Viterbo 29",
      "Avenida 1234 567",
      "Rua 25 de Abril, 2910",
      "Praceta dos 12345-67 Amigos",
      "",
    ]) {
      expect(partirMorada(morada).codigoPostal, morada).toBeNull();
    }
  });

  it("uma morada sem código postal fica inteira na rua", () => {
    expect(partirMorada("Rua Sousa Viterbo 29")).toEqual({
      rua: "Rua Sousa Viterbo 29",
      codigoPostal: null,
      localidade: null,
    });
  });
});

describe("completar os campos vazios", () => {
  it("preenche o código postal e a localidade a partir da morada", () => {
    expect(
      completarComAMorada({
        address: "Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal",
        postalCode: "",
        city: "",
      }),
    ).toEqual({ postalCode: "2910-758", city: "Setúbal" });
  });

  /*
   * ⚠️ O TESTE QUE PROTEGE O TRABALHO DE UMA PESSOA.
   *
   * Se alguém corrigiu o código postal à mão porque a morada estava mal
   * escrita, a correcção é a verdade. Um preenchimento automático a passar-lhe
   * por cima desfazia isso com uma regra de três linhas.
   */
  it("nunca escreve por cima do que já lá está", () => {
    expect(
      completarComAMorada({
        address: "Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal",
        postalCode: "2845-513",
        city: "Seixal",
      }),
    ).toEqual({ postalCode: "2845-513", city: "Seixal" });
  });

  it("um campo cheio e outro vazio — só o vazio é tocado", () => {
    expect(
      completarComAMorada({
        address: "R. Pascoal de Melo 127, 1000-169 Lisboa",
        postalCode: "",
        city: "Arroios",
      }),
    ).toEqual({ postalCode: "1000-169", city: "Arroios" });
  });

  it("sem nada na morada, os campos ficam como estavam", () => {
    expect(
      completarComAMorada({ address: "Rua Sousa Viterbo 29", postalCode: "", city: "" }),
    ).toEqual({ postalCode: "", city: "" });
  });
});
