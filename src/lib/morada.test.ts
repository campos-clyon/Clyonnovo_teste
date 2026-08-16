import { describe, it, expect } from "vitest";
import {
  precisaoDaMorada,
  moradaCompleta,
  faltaNaMorada,
  moradaServeParaTrabalhar,
  numeroDePortaValido,
  linkGoogleMaps,
} from "./morada";

/**
 * Os dois casos reais que motivaram isto. As duas moradas pareciam
 * preenchidas no ecrã e as duas deram distância à base — só que a segunda é
 * uma vila inteira.
 */
describe("precisaoDaMorada — os pedidos reais", () => {
  it("#186: rua sem número — chega-se à rua e depois procura-se a porta", () => {
    const m = { street: "Rua Professor Simões Raposo", city: "Lisboa", postalCode: "1600-608" };
    expect(precisaoDaMorada(m)).toBe("rua");
    expect(moradaServeParaTrabalhar(m)).toBe(false);
    expect(faltaNaMorada(m)).toBe("Falta o número de porta.");
  });

  it("#12: uma vila inteira em vez de uma morada", () => {
    const m = { formattedAddress: "Ericeira, Mafra, Lisboa, Portugal", city: "Mafra" };
    expect(precisaoDaMorada(m)).toBe("localidade");
    expect(moradaServeParaTrabalhar(m)).toBe(false);
    expect(faltaNaMorada(m)).toContain("Escreva o nome da rua");
  });

  it("com número, serve para mandar a equipa", () => {
    const m = { street: "Rua Professor Simões Raposo", streetNumber: "12", city: "Lisboa", postalCode: "1600-608" };
    expect(precisaoDaMorada(m)).toBe("porta");
    expect(moradaServeParaTrabalhar(m)).toBe(true);
    expect(faltaNaMorada(m)).toBe("");
  });

  it("sem nada é 'nenhuma', e não 'localidade'", () => {
    expect(precisaoDaMorada({})).toBe("nenhuma");
    expect(precisaoDaMorada({ street: "  ", city: "  " })).toBe("nenhuma");
  });
});

describe("moradaCompleta", () => {
  it("junta na ordem portuguesa", () => {
    expect(moradaCompleta({
      street: "Rua Professor Simões Raposo",
      streetNumber: "12",
      postalCode: "1600-608",
      city: "Lisboa",
    })).toBe("Rua Professor Simões Raposo, 12, 1600-608 Lisboa");
  });

  it("cada pedaço só entra se existir — sem vírgulas soltas", () => {
    expect(moradaCompleta({ street: "Rua das Flores", city: "Setúbal" }))
      .toBe("Rua das Flores, Setúbal");
    expect(moradaCompleta({ street: "Rua das Flores", streetNumber: "3" }))
      .toBe("Rua das Flores, 3");
    expect(moradaCompleta({ street: "Rua das Flores" }))
      .toBe("Rua das Flores");
  });

  it("nunca escreve undefined nem deixa pontuação a mais", () => {
    const s = moradaCompleta({ street: "Rua X", streetNumber: null, postalCode: undefined, city: null });
    expect(s).toBe("Rua X");
    expect(s).not.toContain("undefined");
    expect(s).not.toContain("null");
    expect(s).not.toMatch(/,\s*$/);
    expect(s).not.toMatch(/,\s*,/);
  });

  it("sem componentes, vale o que o Google mostrou", () => {
    expect(moradaCompleta({ formattedAddress: "Ericeira, Mafra, Lisboa, Portugal" }))
      .toBe("Ericeira, Mafra, Lisboa, Portugal");
  });
});

describe("numeroDePortaValido", () => {
  it("aceita o que as pessoas escrevem mesmo", () => {
    for (const v of ["12", "12-A", "12 A", "1", "104", "S/N", "s/n", "SN", "Lote 4", "12, 3º Esq"]) {
      expect(numeroDePortaValido(v), v).toBe(true);
    }
  });

  it("recusa vazio e texto sem número", () => {
    for (const v of ["", "   ", null, undefined, "não sei", "porta"]) {
      expect(numeroDePortaValido(v), String(v)).toBe(false);
    }
  });

  /**
   * O erro comum: escrever a morada inteira no campo do número, por não se
   * perceber para que serve. Fica de fora pelo tamanho.
   */
  it("recusa uma morada inteira escrita no campo do número", () => {
    expect(numeroDePortaValido("Rua Professor Simões Raposo 12, Lisboa")).toBe(false);
  });
});

describe("linkGoogleMaps", () => {
  it("junta as partes em vez de mandar só o campo da rua", () => {
    const url = linkGoogleMaps({
      street: "Rua Professor Simões Raposo",
      streetNumber: "12",
      postalCode: "1600-608",
      city: "Lisboa",
    });
    expect(url).toContain("1600-608");
    expect(url).toContain(encodeURIComponent("Rua Professor Simões Raposo, 12, 1600-608 Lisboa"));
  });

  /**
   * Um ponto é sempre mais exacto do que um texto que o Maps tem de voltar a
   * interpretar. Quando temos coordenadas, são elas que mandam.
   */
  it("com coordenadas, usa o ponto e não o texto", () => {
    const url = linkGoogleMaps({ street: "Rua X", lat: 38.7223, lng: -9.1393 });
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=38.7223,-9.1393");
  });

  it("sem morada nenhuma não inventa um link", () => {
    expect(linkGoogleMaps({})).toBeNull();
    expect(linkGoogleMaps({ street: "   " })).toBeNull();
  });
});
