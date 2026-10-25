import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateFastEstimate, entulhoPelaGrelha } from "./pricing-helper";
import { ENTULHO_ATE_10_SACOS, ENTULHO_POR_M3_ACIMA_DE_1, desdeDoVolume } from "./precos-publicos";
import { referenciaDoEntulho } from "./quanto-custa";

/**
 * O MOTOR DO SIMULADOR FALA COMO A GRELHA — 25-10-2026.
 *
 * Três sítios ainda diziam outra coisa:
 *   1. o motor somava 3 € por saco ao custo do entulho — 10 sacos davam mais
 *      de 100 €, com a grelha publicada a dizer 40 a 50 €;
 *   2. o texto de recurso das instruções ao modelo ainda mandava somar
 *      «Urgência hoje +40€ | amanhã +20€» ao preço;
 *   3. o título de /servicos anunciava «Limpezas», que não é serviço activo.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("o entulho do motor é a linha da grelha", () => {
  it("até 10 sacos é a faixa publicada", () => {
    const g = entulhoPelaGrelha("8")!;
    expect(g.minimo).toBe(ENTULHO_ATE_10_SACOS.minimo);
    expect(g.maximo).toBe(ENTULHO_ATE_10_SACOS.maximo);
    expect(g.semIva).toBe(ENTULHO_ATE_10_SACOS.maximo);
    expect(g.proposta).toBe(false);
  });

  it("até 5 m³ é o «desde» da calculadora da página, e o intervalo nunca desce dele", () => {
    for (const sacos of [11, 20, 40, 80, 120, 200]) {
      const g = entulhoPelaGrelha(String(sacos))!;
      const ref = referenciaDoEntulho(sacos, "sacos")!;
      expect(ref.valor.tipo).toBe("desde");
      if (ref.valor.tipo === "desde") {
        expect(g.semIva).toBe(ref.valor.de);
        expect(g.minimo).toBe(ref.valor.de);
      }
      expect(g.maximo).toBeGreaterThanOrEqual(g.semIva);
    }
    expect(entulhoPelaGrelha("120")!.semIva).toBe(desdeDoVolume(3));
    expect(entulhoPelaGrelha("200")!.semIva).toBe(desdeDoVolume(5));
  });

  it("lê os metros cúbicos e os big bags como a casa os conta («4m3» não são 43 sacos)", () => {
    expect(entulhoPelaGrelha("4m3")!.sacos).toBe(160);
    expect(entulhoPelaGrelha("4m3")!.semIva).toBe(Math.ceil(ENTULHO_POR_M3_ACIMA_DE_1 * 4));
  });

  it("acima de 5 m³ é proposta, com uma referência ao preço por m³ da grelha", () => {
    const g = entulhoPelaGrelha("6 m3")!;
    expect(g.proposta).toBe(true);
    expect(g.semIva).toBe(Math.ceil(ENTULHO_POR_M3_ACIMA_DE_1 * 6));
  });

  it("sem quantidade não inventa uma linha", () => {
    expect(entulhoPelaGrelha("")).toBeNull();
    expect(entulhoPelaGrelha("não sei")).toBeNull();
    expect(entulhoPelaGrelha(undefined)).toBeNull();
  });
});

describe("a estimativa do entulho no simulador", () => {
  it("10 sacos ensacados dão 40 a 50 € sem IVA, e nenhum preço por saco", async () => {
    const e = await calculateFastEstimate({
      serviceType: "recolha_entulho",
      entulhoState: "ensacado",
      entulhoQuantidade: "10",
      distanceFromBase: { distanceKm: 20 },
    });
    expect(e.estimatedPriceWithoutVat).toBe(ENTULHO_ATE_10_SACOS.maximo);
    expect(e.estimateMinWithoutVat).toBe(ENTULHO_ATE_10_SACOS.minimo);
    expect(e.estimateMaxWithoutVat).toBe(ENTULHO_ATE_10_SACOS.maximo);
    expect(e.assumptions.join(" ")).not.toMatch(/€\/saco/);
  }, 60_000);

  it("3 m³ de obra, ensacados ou no chão, é o «desde» dos 3 m³", async () => {
    for (const estado of ["ensacado", "chao"]) {
      const e = await calculateFastEstimate({
        serviceType: "recolha_entulho",
        entulhoState: estado,
        entulhoQuantidade: "120",
        distanceFromBase: { distanceKm: 15 },
      });
      expect(e.estimatedPriceWithoutVat, estado).toBe(desdeDoVolume(3));
      expect(e.estimateMinWithoutVat, estado).toBe(desdeDoVolume(3));
    }
  }, 60_000);

  it("acima de 5 m³ a confiança fica em baixo", async () => {
    const e = await calculateFastEstimate({
      serviceType: "recolha_entulho",
      entulhoState: "ensacado",
      entulhoQuantidade: "300",
      distanceFromBase: { distanceKm: 15 },
    });
    expect(e.confidence).toBe("low");
  }, 60_000);

  it("o código do motor já não lê os 3 € por saco das definições", () => {
    const motor = semComentarios(ler("src/lib/pricing-helper.ts"));
    const calculo = motor.slice(motor.indexOf("export async function calculateFastEstimate"));
    expect(calculo.length).toBeGreaterThan(1000);
    expect(calculo).not.toMatch(/entulho_saco_(ensacado|chao)\s*\?\?/);
    expect(calculo).not.toMatch(/sacoCost/);
  });
});

describe("o texto de recurso das instruções ao modelo", () => {
  it("já não manda somar a urgência ao preço", () => {
    const motor = ler("src/lib/pricing-helper.ts");
    const i = motor.indexOf("Fallback de último recurso");
    expect(i).toBeGreaterThan(-1);
    const recurso = motor.slice(i, motor.indexOf("`;", i));
    expect(recurso).not.toMatch(/Urg[êe]ncia[^\n]{0,20}\+ ?\d/);
    expect(recurso).not.toMatch(/amanh[ãa] ?\+ ?\d/);
    expect(recurso).toContain("A URGÊNCIA NÃO ENTRA NO PREÇO DO TRABALHO");
  });
});

describe("o título de /servicos", () => {
  it("diz os serviços do plano, e não «Limpezas»", () => {
    const pagina = semComentarios(ler("src/app/servicos/page.tsx"));
    const titulos = [...pagina.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]).slice(0, 2);
    expect(titulos.length).toBe(2);
    for (const t of titulos) {
      expect(t).not.toMatch(/limpez/i);
      expect(t).toMatch(/Recolhas/);
      expect(t).toMatch(/Esvaziamentos/);
      expect(t).toMatch(/Mudanças/);
    }
  });
});
