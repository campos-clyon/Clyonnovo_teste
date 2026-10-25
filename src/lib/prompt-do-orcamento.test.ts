import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAnalysisPrompt } from "./prompt-do-orcamento";
import {
  GRELHA_DO_ENTULHO_PARA_O_MODELO,
  buildReferenceEstimate,
  calculateFastEstimate,
  getActivePricingRulesForGemini,
} from "./pricing-helper";
import { ENTULHO_ATE_10_SACOS, ENTULHO_POR_VOLUME, PECAS_DE_REFERENCIA, pecaEmLinha } from "./precos-publicos";
import {
  MINIMO_DA_MUDANCA,
  PRECO_POR_HORA,
  REGRAS_DA_MUDANCA_PARA_O_MODELO,
  orcamentoDaMudanca,
} from "./tabela-das-mudancas";

/**
 * O QUE O GEMINI LÊ SOBRE PREÇOS SAI DAS FONTES — 25-10-2026.
 *
 * As instruções ao modelo tinham uma tabela própria: as mudanças a 70 €/h,
 * com 7 horas de base e um mínimo de 210 €, e o entulho a 3 € por saco. O site
 * e o motor diziam 50 €/h com mínimo de 3 horas, e a grelha do entulho. E na
 * mudança, o número do modelo ficava por cima do da tabela.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const PROIBIDOS = [/70 ?€ ?\/ ?h/, /70 ?€\/hora/, /3,00 ?€ (por|\/) ?saco/, /3[.,]00 ?€\/saco/, /3,20 ?€ por saco/, /base 7 ?h/i, /210 ?€/];

async function oPrompt(comFotos = false) {
  const regras = await getActivePricingRulesForGemini();
  return buildAnalysisPrompt("(o pedido)", regras, comFotos);
}

describe("o prompt do orçamento", () => {
  it("tem a hora da tabela, e não os 70 €/h, as 7 horas de base, os 210 € nem os 3 € por saco", async () => {
    for (const comFotos of [false, true]) {
      const p = await oPrompt(comFotos);
      expect(p).toContain(`${PRECO_POR_HORA} €/hora`);
      expect(p).toContain(REGRAS_DA_MUDANCA_PARA_O_MODELO);
      for (const r of PROIBIDOS) expect(p, String(r)).not.toMatch(r);
    }
  });

  it("o entulho é o da grelha publicada", async () => {
    const p = await oPrompt();
    expect(p).toContain(GRELHA_DO_ENTULHO_PARA_O_MODELO);
    expect(p).toContain(`${ENTULHO_ATE_10_SACOS.minimo} a ${ENTULHO_ATE_10_SACOS.maximo} € s/IVA`);
    for (const v of ENTULHO_POR_VOLUME) expect(p).toContain(`Até ${v.m3} m³: desde ${v.desde} € s/IVA`);
  });

  it("os exemplos das peças são os do site", async () => {
    const p = await oPrompt();
    for (const peca of PECAS_DE_REFERENCIA) expect(p).toContain(pecaEmLinha(peca));
  });

  it("os exemplos da mudança são contados pela tabela", async () => {
    const p = await oPrompt();
    const t2 = orcamentoDaMudanca({ tipologia: "T2" });
    expect(p).toContain(`${t2.horas} h × ${PRECO_POR_HORA} € = ${t2.totalSemIva} € s/IVA`);
  });

  it("e os dados do pedido já não dizem um preço por saco", () => {
    expect(ler("src/app/api/simulator/analyze/route.ts")).not.toMatch(/€\/saco/);
  });
});

describe("na mudança, o preço é o da tabela", () => {
  it("a rota põe o preço do motor por cima do do modelo", () => {
    const rota = ler("src/app/api/simulator/analyze/route.ts");
    const i = rota.indexOf('if (order.serviceType === "mudanca" && fastEstimate.estimatedPriceWithoutVat) {');
    expect(i).toBeGreaterThan(-1);
    // Depois do Gemini (e do seu fallback), antes da pesquisa externa e da resposta.
    expect(i).toBeGreaterThan(rota.indexOf("analysis = parseGeminiResponse(responseText);"));
    expect(i).toBeLessThan(rota.indexOf("// ── 4. Pesquisa externa se necessário"));
    expect(rota.slice(i, i + 900)).toContain("estimatedPriceWithoutVat: fastEstimate.estimatedPriceWithoutVat,");
  });

  it("e o preço do motor é o de `orcamentoDaMudanca`", async () => {
    for (const tipologia of ["T1", "T2", "T3"] as const) {
      const e = await calculateFastEstimate({ serviceType: "mudanca", tipologia } as never);
      expect(e.estimatedPriceWithoutVat, tipologia).toBe(orcamentoDaMudanca({ tipologia }).totalSemIva);
    }
  });

  it("a referência de último recurso não desce abaixo do mínimo da tabela, e não é 210 €", () => {
    const r = buildReferenceEstimate({ serviceType: "mudanca" } as never);
    expect(r.estimateMinWithoutVat).toBeGreaterThanOrEqual(MINIMO_DA_MUDANCA);
    expect(ler("src/lib/pricing-helper.ts")).toContain("mudanca:                   { min: MINIMO_DA_MUDANCA,");
  });
});

/*
 * NO ENTULHO, O TEXTO AO MODELO DIZ O MESMO QUE O MOTOR — 25-10-2026, à noite.
 *
 * O motor conta o entulho pela linha da grelha: não soma a deslocação, nem o
 * tempo de ensacar. O texto ao modelo mandava somar os dois — «distanceKm × 2 €»
 * na regra 2.1, e «acresce o tempo de ensacar» na grelha — e a regra 1 mandava
 * o entulho para a fórmula de custo.
 */
describe("no entulho, o modelo lê o que o motor faz", () => {
  const regra = (p: string, de: string, ate: string) => {
    const i = p.indexOf(de);
    const j = p.indexOf(ate, i);
    expect(i, de).toBeGreaterThan(-1);
    expect(j, ate).toBeGreaterThan(i);
    return p.slice(i, j);
  };

  it("a regra 2.1 já não manda somar a deslocação ao entulho", async () => {
    const r21 = regra(await oPrompt(), "2.1. DESLOCAÇÃO", "2.2. HORÁRIO");
    expect(r21).not.toMatch(/itens soltos e entulho/i);
    expect(r21).toContain("Para ENTULHO NÃO somes deslocação nenhuma");
    // Os 2 €/km ficam só para os itens soltos.
    expect(r21).toContain("Para itens soltos, adiciona a componente de deslocação");
  });

  it("a regra 1 manda o entulho para a grelha, e não para a fórmula", async () => {
    const r1 = regra(await oPrompt(), "1. USA a fórmula geral", "2. MÍNIMOS");
    expect(r1).not.toMatch(/recolhas\/entulho/);
    expect(r1).toContain("Para ENTULHO usa EXCLUSIVAMENTE a grelha da regra 2.c");
  });

  it("a grelha não acrescenta o tempo de ensacar", async () => {
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).not.toMatch(/acresce o tempo de ensacar/);
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).not.toMatch(/× ?1[.,]3/);
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).toContain("o tempo de ensacar não se soma ao preço");
    // E a tabela de tempo diz que é só para as horas.
    expect(await getActivePricingRulesForGemini()).toContain(
      "ENTULHO — tabela de TEMPO (só para as horas e a equipa; o preço do entulho é o da grelha)",
    );
  });

  it("e o motor faz isso mesmo: o estado e a distância não mudam o preço do entulho", async () => {
    const preco = async (entulhoState: string, distanceKm: number) =>
      (
        await calculateFastEstimate({
          serviceType: "recolha_entulho",
          entulhoState,
          entulhoQuantidade: "10",
          distanceFromBase: { distanceKm },
        } as never)
      ).estimatedPriceWithoutVat;
    const base = await preco("ensacado", 5);
    expect(base).toBe(ENTULHO_ATE_10_SACOS.maximo);
    for (const estado of ["ensacado", "chao", "misto"]) {
      for (const km of [5, 30, 60]) expect(await preco(estado, km), `${estado} a ${km} km`).toBe(base);
    }
  }, 60_000);
});
