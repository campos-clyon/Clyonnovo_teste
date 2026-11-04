import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { referenciaDoEntulho, linhasDoEntulho, comIvaEscrito, semIvaEscrito } from "./quanto-custa";
import { PEDIR_ENTULHO } from "@/app/recolha-de-entulho/CalculadoraDeEntulho";
import { servicoDaLigacao } from "./servico-na-ligacao";

const PAGINA = readFileSync(join(process.cwd(), "src/app/recolha-de-entulho/page.tsx"), "utf8");
const COMPONENTE = readFileSync(
  join(process.cwd(), "src/app/recolha-de-entulho/CalculadoraDeEntulho.tsx"),
  "utf8",
);

describe("calculadora de referência do entulho", () => {
  it("até 10 sacos é a faixa da grelha", () => {
    const r = referenciaDoEntulho(8, "sacos")!;
    expect(r.valor).toEqual(linhasDoEntulho()[0].valor);
    expect(semIvaEscrito(r.valor)).toBe("40 – 48 €");
  });

  it("os volumes da grelha dão a mesma faixa da grelha", () => {
    const grelha = linhasDoEntulho();
    expect(referenciaDoEntulho(1, "m3")!.valor).toEqual(grelha[1].valor);
    expect(referenciaDoEntulho(3, "m3")!.valor).toEqual(grelha[2].valor);
    expect(referenciaDoEntulho(5, "m3")!.valor).toEqual(grelha[3].valor);
  });

  // d4 (03-11-2026): os sacos contam-se um a um, a 4,00–4,80 € + IVA; e desde a d7 (04-11-2026)
  // o entulho a granel (m³) também, pelos sacos que faz — era «desde 120 €» o m³.
  it("os sacos contam-se um a um; a granel, pelos sacos que faz", () => {
    expect(referenciaDoEntulho(20, "sacos")!.valor).toEqual({ tipo: "faixa", de: 80, ate: 96 });
    expect(referenciaDoEntulho(11, "sacos")!.valor).toEqual({ tipo: "faixa", de: 44, ate: 52.8 });
    expect(referenciaDoEntulho(0.5, "m3")!.valor).toEqual({ tipo: "faixa", de: 80, ate: 96 });
  });

  it("o m³ a granel conta 40 sacos: 1 m³ = 40 sacos ensacados (d7)", () => {
    expect(referenciaDoEntulho(1, "m3")!.valor).toEqual({ tipo: "faixa", de: 160, ate: 192 });
    expect(referenciaDoEntulho(1, "m3")!.valor).toEqual(referenciaDoEntulho(40, "sacos")!.valor);
    expect(referenciaDoEntulho(2, "m3")!.valor).toEqual({ tipo: "faixa", de: 320, ate: 384 });
    expect(referenciaDoEntulho(4, "m3")!.valor).toEqual({ tipo: "faixa", de: 640, ate: 768 });
    // 2 big bags = 76 sacos, um a um (d4): 304 – 364,80 €.
    expect(referenciaDoEntulho(2, "bigbags")!.valor).toEqual({ tipo: "faixa", de: 304, ate: 364.8 });
  });

  it("converte pelas regras da casa: 40 sacos o m³, 38 o big bag", () => {
    expect(referenciaDoEntulho(2, "m3")!.sacos).toBe(80);
    expect(referenciaDoEntulho(2, "bigbags")!.sacos).toBe(76);
    expect(referenciaDoEntulho(2, "bigbags")!.m3).toBe(1.9);
  });

  it("acima de 5 m³ é proposta, como na grelha", () => {
    expect(referenciaDoEntulho(6, "m3")!.valor).toEqual({ tipo: "orcamento" });
  });

  it("o com IVA vai sempre ao lado", () => {
    expect(comIvaEscrito(referenciaDoEntulho(3, "m3")!.valor)).toBe("590,40 – 708,48 €");
  });

  it("zero, negativo ou lixo não dão referência", () => {
    expect(referenciaDoEntulho(0, "sacos")).toBeNull();
    expect(referenciaDoEntulho(-3, "m3")).toBeNull();
    expect(referenciaDoEntulho(Number.NaN, "sacos")).toBeNull();
  });

  it("está na página, e o componente não escreve euros à mão", () => {
    expect(PAGINA).toContain("<CalculadoraDeEntulho />");
    const semComentarios = COMPONENTE.replace(/^[ \t]*(\*|\/\/|\/\*).*$/gm, "");
    expect(semComentarios).not.toMatch(/\d+\s*€/);
  });

  it("o botão abre o simulador já em «Recolha de entulho»", () => {
    expect(servicoDaLigacao(PEDIR_ENTULHO.split("?")[1])).toBe("recolha_entulho");
  });
});
