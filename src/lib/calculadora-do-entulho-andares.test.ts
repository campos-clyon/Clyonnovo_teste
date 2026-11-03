import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comIvaEscrito, comOSuplemento, referenciaDoEntulho, semIvaEscrito, suplementoDoEntulho } from "./quanto-custa";

/*
 * A CALCULADORA DAS PÁGINAS DO ENTULHO SOMA OS ANDARES — 03-11-2026 (d1 v2).
 * A mesma conta da referência (R12) e do motor: `suplementoDoEntulho` + `comOSuplemento`.
 */
const conta = (q: number, u: "sacos" | "m3", floor: number, longe = false) => {
  const ref = referenciaDoEntulho(q, u)!;
  const s = suplementoDoEntulho(ref.sacos, { floor, hasElevator: floor > 0 ? "no" : "yes", parkingDistance: longe ? "over_30m" : null });
  return comOSuplemento(ref.valor, s.valor);
};

describe("a calculadora do entulho com os andares sem elevador", () => {
  it("1 m³ num 3.º andar → 165 € + IVA (202,95 € com IVA)", () => {
    const v = conta(1, "m3", 3);
    expect(semIvaEscrito(v)).toContain("165");
    expect(comIvaEscrito(v)).toContain("202,95");
  });
  it("50 sacos num 2.º andar → 217,50 € + IVA", () => {
    expect(semIvaEscrito(conta(50, "sacos", 2))).toContain("217,50");
  });
  it("rés-do-chão ou com elevador: a grelha sem nada a mais", () => {
    expect(conta(1, "m3", 0)).toEqual(referenciaDoEntulho(1, "m3")!.valor);
  });
  it("o estacionamento longe conta como mais um andar", () => {
    expect(conta(1, "m3", 2, true)).toEqual(conta(1, "m3", 3));
  });
  it("a calculadora usa estas funções, sem números escritos", () => {
    const f = readFileSync(join(process.cwd(), "src/app/recolha-de-entulho/CalculadoraDeEntulho.tsx"), "utf8");
    expect(f).toContain("suplementoDoEntulho(");
    expect(f).toContain("comOSuplemento(");
    expect(f).not.toMatch(/\d+\s*€/);
  });
});
