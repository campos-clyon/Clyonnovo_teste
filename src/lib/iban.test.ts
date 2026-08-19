import { describe, it, expect } from "vitest";
import { ibanValido, normalizarIban, formatarIban, ibanEncurtado } from "./iban";

// IBANs de teste com dígitos de controlo certos.
const PT = "PT50000201231234567890154";
const ES = "ES9121000418450200051332";
const DE = "DE89370400440532013000";

describe("ibanValido", () => {
  it("aceita IBAN certo, com ou sem espaços", () => {
    expect(ibanValido(PT)).toBe(true);
    expect(ibanValido("PT50 0002 0123 1234 5678 9015 4")).toBe(true);
    expect(ibanValido("pt50 0002 0123 1234 5678 9015 4")).toBe(true);
    expect(ibanValido(ES)).toBe(true);
    expect(ibanValido(DE)).toBe(true);
  });

  // É o engano que interessa apanhar: um dígito trocado só se descobre quando
  // a transferência é devolvida, e nessa altura ele já contava com o dinheiro.
  it("recusa um dígito trocado", () => {
    expect(ibanValido("PT50000201231234567890155")).toBe(false);
    expect(ibanValido("DE89370400440532013001")).toBe(false);
  });

  it("recusa comprimento errado para o país", () => {
    expect(ibanValido(PT.slice(0, 24))).toBe(false);
    expect(ibanValido(PT + "0")).toBe(false);
  });

  it("recusa o que não tem forma de IBAN", () => {
    for (const v of ["", "12345", "IBAN", "50PT0002", null, undefined, 42, {}]) {
      expect(ibanValido(v)).toBe(false);
    }
  });

  it("recusa número de conta sem país", () => {
    expect(ibanValido("000201231234567890154")).toBe(false);
  });
});

describe("normalizarIban", () => {
  it("tira espaços e traços e põe em maiúsculas", () => {
    expect(normalizarIban(" pt50-0002 0123 ")).toBe("PT5000020123");
  });

  it("devolve vazio para o que não é texto", () => {
    expect(normalizarIban(null)).toBe("");
    expect(normalizarIban(42)).toBe("");
  });
});

describe("como se mostra", () => {
  it("formata em grupos de quatro", () => {
    expect(formatarIban(PT)).toBe("PT50 0002 0123 1234 5678 9015 4");
  });

  it("encurta para país e últimos quatro", () => {
    expect(ibanEncurtado(PT)).toBe("PT50 ···· 0154");
  });

  it("não encurta o que não dá", () => {
    expect(ibanEncurtado("PT50")).toBe("");
  });
});
