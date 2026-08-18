import { describe, it, expect } from "vitest";
import {
  quantoOClientePaga,
  quantoOProfissionalRecebe,
  comissaoDaClyon,
  TAXA_CLIENTE,
  TAXA_PROFISSIONAL,
  TAXA_TOTAL,
  TAXA_IVA,
  decomporIva,
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

describe("IVA — sempre 23%, decomposto e não somado", () => {
  it("decompõe 350 € em base e IVA que somam exactamente 350", () => {
    const { base, iva } = decomporIva(350);
    expect(base).toBe(284.55);
    expect(iva).toBe(65.45);
    expect(base + iva).toBe(350);
  });

  // O IVA sai por diferença e não por multiplicação, senão o arredondamento
  // deixava um cêntimo a sobrar e a conta no ecrã não fechava.
  it("base mais IVA dá sempre o valor de partida, sem cêntimos a sobrar", () => {
    for (const v of [5, 33.33, 99.99, 100, 237.5, 1000, 12345.67]) {
      const { base, iva } = decomporIva(v);
      expect(Number((base + iva).toFixed(2))).toBe(v);
    }
  });

  it("a taxa é a normal portuguesa", () => {
    expect(TAXA_IVA).toBe(0.23);
  });

  // O valor negociado JÁ inclui o IVA. Se fosse somado, 350 combinados
  // passavam a 430,50 na confirmação — um salto que ninguém aceita depois de
  // ter fechado um número.
  it("a base é menor do que o valor acordado, nunca maior", () => {
    for (const v of [10, 350, 5000]) {
      expect(decomporIva(v).base).toBeLessThan(v);
    }
  });

  it("zero continua zero", () => {
    expect(decomporIva(0)).toEqual({ base: 0, iva: 0 });
  });
});
