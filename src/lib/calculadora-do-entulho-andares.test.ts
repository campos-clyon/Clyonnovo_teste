import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comIvaEscrito, semIvaEscrito } from "./quanto-custa";
import { valorDoEntulho } from "./preco-de-referencia";

/*
 * A CALCULADORA DAS PÁGINAS DO ENTULHO SOMA OS ANDARES — 03-11-2026 (d1 v2),
 * POR TRABALHO desde a d4 (o mesmo dia): +5 € + IVA por andar com elevador, +15 €
 * + IVA por andar sem elevador, o estacionamento longe como mais um andar sem
 * elevador. A mesma conta da referência (R12) e do motor: `valorDoEntulho`.
 */
const conta = (q: number, u: "sacos" | "m3" | "bigbags", floor: number, hasElevator: "yes" | "no" | null, longe = false) =>
  valorDoEntulho({ quantidade: q, unidade: u }, { floor, hasElevator, parkingDistance: longe ? "over_30m" : null })!.valor;

describe("a calculadora do entulho com os andares, por trabalho (d4)", () => {
  it("o exemplo do dono: 50 sacos num 2.º andar com elevador → 210 – 250 € + IVA (258,30 – 307,50 € com IVA)", () => {
    const v = conta(50, "sacos", 2, "yes");
    expect(semIvaEscrito(v)).toBe("210 – 250 €");
    expect(comIvaEscrito(v)).toBe("258,30 – 307,50 €");
  });
  it("rés-do-chão: 10 sacos → 40 – 48 €", () => {
    expect(semIvaEscrito(conta(10, "sacos", 0, null))).toBe("40 – 48 €");
  });
  it("3.º andar sem elevador, 10 sacos → 85 – 93 €", () => {
    expect(semIvaEscrito(conta(10, "sacos", 3, "no"))).toBe("85 – 93 €");
  });
  it("1 big bag no 1.º andar com elevador → 157 – 187,40 €", () => {
    expect(semIvaEscrito(conta(1, "bigbags", 1, "yes"))).toBe("157 – 187,40 €");
  });
  // A granel ao preço dos sacos desde a d7 (04-11-2026): era «desde 165 €» (120 + 45).
  it("a granel (m³) pelos sacos: 1 m³ num 3.º sem elevador → 205 – 237 € + IVA (252,15 – 291,51 € com IVA)", () => {
    const v = conta(1, "m3", 3, "no");
    expect(semIvaEscrito(v)).toBe("205 – 237 €");
    expect(comIvaEscrito(v)).toBe("252,15 – 291,51 €");
    expect(v).toEqual(conta(40, "sacos", 3, "no"));
  });
  it("o estacionamento longe conta como mais um andar sem elevador", () => {
    expect(conta(1, "m3", 2, "no", true)).toEqual(conta(1, "m3", 3, "no"));
    expect(semIvaEscrito(conta(10, "sacos", 0, null, true))).toBe("55 – 63 €");
  });
  it("a calculadora usa a mesma função, sem números escritos, e pergunta o elevador", () => {
    const f = readFileSync(join(process.cwd(), "src/app/recolha-de-entulho/CalculadoraDeEntulho.tsx"), "utf8");
    expect(f).toContain("valorDoEntulho(");
    expect(f).toContain("linhasDosAndares(");
    expect(f).toContain("Tem elevador");
    expect(f).not.toMatch(/\d+\s*€/);
  });
});
