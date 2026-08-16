import { describe, it, expect } from "vitest";
import {
  quantoOClientePaga,
  quantoOProfissionalRecebe,
  comissaoDaClyon,
  TAXA_CLIENTE,
  TAXA_PROFISSIONAL,
  TAXA_TOTAL,
} from "./taxas-plataforma";

describe("taxas da plataforma", () => {
  // O exemplo que está escrito na homepage e na página dos profissionais. Se
  // este teste falhar, o site passa a mostrar contas que não batem certo.
  it("sobre 200 € acordados: cliente paga 212, profissional recebe 190", () => {
    expect(quantoOClientePaga(200)).toBe(212);
    expect(quantoOProfissionalRecebe(200)).toBe(190);
    expect(comissaoDaClyon(200)).toBe(22);
  });

  it("as percentagens são as decididas", () => {
    expect(TAXA_CLIENTE).toBe(0.06);
    expect(TAXA_PROFISSIONAL).toBe(0.05);
    expect(TAXA_TOTAL).toBeCloseTo(0.11, 10);
  });

  it("a CLYON fica com 11 % do acordado", () => {
    for (const v of [50, 100, 237.5, 1000]) {
      expect(comissaoDaClyon(v)).toBeCloseTo(v * 0.11, 2);
    }
  });

  it("arredonda aos cêntimos sem lixo de vírgula flutuante", () => {
    expect(quantoOClientePaga(33.33)).toBe(35.33);
    expect(quantoOProfissionalRecebe(33.33)).toBe(31.66);
    expect(Number.isInteger(quantoOClientePaga(10) * 100)).toBe(true);
  });

  it("o profissional recebe sempre menos do que o cliente paga", () => {
    for (const v of [1, 10, 99.99, 5000]) {
      expect(quantoOProfissionalRecebe(v)).toBeLessThan(quantoOClientePaga(v));
    }
  });

  it("zero continua zero", () => {
    expect(quantoOClientePaga(0)).toBe(0);
    expect(quantoOProfissionalRecebe(0)).toBe(0);
  });
});
