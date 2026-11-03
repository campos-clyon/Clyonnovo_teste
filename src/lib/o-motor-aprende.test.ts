import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AMOSTRA_MINIMA,
  FATOR_MAXIMO,
  FATOR_MINIMO,
  aplicarAprendizagem,
  calibrarServico,
  calibrarTudo,
  mediana,
  type ParParaAprender,
} from "./motor-aprende";
import { estimativaSemIvaDoJson } from "./motor-aprende-na-base";
import { confiancaDoOrcamento, type SinaisDoOrcamento } from "./confianca-do-orcamento";
import { calculateFastEstimate } from "./pricing-helper";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const pares = (servico: string, n: number, estimativa: number, acordado: number): ParParaAprender[] =>
  Array.from({ length: n }, () => ({ servico, estimativaSemIva: estimativa, acordadoSemIva: acordado }));

/*
 * O MOTOR APRENDE COM OS VALORES DA CASA — 03-11-2026.
 * "Quero ele mais inteligente e que ele aprenda com nossos valores."
 */
describe("o fator de cada serviço", () => {
  it("com menos trabalhos do que a amostra mínima, não aprende", () => {
    const c = calibrarServico("recolha_moveis", pares("recolha_moveis", AMOSTRA_MINIMA - 1, 100, 150));
    expect(c.amostra).toBe(AMOSTRA_MINIMA - 1);
    expect(c.fator).toBe(1);
  });

  it("com 10 trabalhos 20 % acima, mexe só metade (a dúvida pesa)", () => {
    const c = calibrarServico("recolha_moveis", pares("recolha_moveis", 10, 100, 120));
    expect(c.mediana).toBe(1.2);
    expect(c.fator).toBe(1.1);
  });

  it("nunca passa dos limites, por mais que os dados digam", () => {
    expect(calibrarServico("x", pares("x", 200, 100, 250)).fator).toBe(FATOR_MAXIMO);
    expect(calibrarServico("x", pares("x", 200, 100, 40)).fator).toBe(FATOR_MINIMO);
  });

  it("um trabalho absurdo sai, e a mediana não se deixa puxar", () => {
    const p = [...pares("x", 9, 100, 110), { servico: "x", estimativaSemIva: 100, acordadoSemIva: 5000 }];
    const c = calibrarServico("x", p);
    expect(c.descartados).toBe(1);
    expect(c.amostra).toBe(9);
    expect(c.mediana).toBe(1.1);
  });

  it("cada serviço aprende só com os seus", () => {
    const tudo = calibrarTudo([...pares("a", 20, 100, 120), ...pares("b", 6, 100, 90)]);
    expect(tudo.map((c) => c.servico)).toEqual(["a", "b"]);
    expect(tudo[0].fator).toBeGreaterThan(1);
    expect(tudo[1].fator).toBeLessThan(1);
  });

  it("a mediana de um número par de valores é o meio dos dois do meio", () => {
    expect(mediana([1, 3, 2, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe("o ajuste fica dentro da faixa publicada", () => {
  const cal = calibrarServico("x", pares("x", 200, 100, 200)); // fator no máximo

  it("sobe, mas nunca acima do máximo da faixa", () => {
    const a = aplicarAprendizagem({ estimatedPriceWithoutVat: 100, estimateMinWithoutVat: 90, estimateMaxWithoutVat: 110 }, cal);
    expect(a?.ajustado).toBe(true);
    expect(a?.precoSemIva).toBe(110);
    expect(a?.precoComIva).toBe(135.3);
    expect(a?.nota).toContain("dentro da faixa 90–110€");
  });

  it("desce, mas nunca abaixo do mínimo da faixa", () => {
    const baixo = calibrarServico("x", pares("x", 200, 100, 50));
    const a = aplicarAprendizagem({ estimatedPriceWithoutVat: 100, estimateMinWithoutVat: 95, estimateMaxWithoutVat: 110 }, baixo);
    expect(a?.precoSemIva).toBe(95);
  });

  it("sem fator útil, o preço fica igual", () => {
    const nada = calibrarServico("x", pares("x", 2, 100, 200));
    const a = aplicarAprendizagem({ estimatedPriceWithoutVat: 100, estimateMinWithoutVat: 90, estimateMaxWithoutVat: 110 }, nada);
    expect(a).toEqual({ precoSemIva: 100, precoComIva: 123, ajustado: false, nota: null });
  });

  it("sem preço, não há nada a ajustar", () => {
    expect(aplicarAprendizagem({ estimatedPriceWithoutVat: null }, cal)).toBeNull();
  });
});

describe("a estimativa guardada que conta é a do motor, antes de aprender", () => {
  it("prefere `precoDoMotorSemIva` — o fator não se corrige a si próprio", () => {
    expect(estimativaSemIvaDoJson(JSON.stringify({ precoDoMotorSemIva: 100, estimatedPriceWithoutVat: 110 }))).toBe(100);
  });
  it("pedidos antigos usam o `estimatedPriceWithoutVat`", () => {
    expect(estimativaSemIvaDoJson(JSON.stringify({ estimatedPriceWithoutVat: "120.5" }))).toBe(120.5);
  });
  it("JSON estragado ou sem número não rebenta", () => {
    expect(estimativaSemIvaDoJson("{nao é json")).toBeNull();
    expect(estimativaSemIvaDoJson(JSON.stringify({ estimatedPriceWithoutVat: 0 }))).toBeNull();
    expect(estimativaSemIvaDoJson(null)).toBeNull();
  });
});

describe("a confiança sai de sinais que se verificam", () => {
  const bom: SinaisDoOrcamento = {
    status: "estimated",
    precoSemIva: 200,
    quemLeu: "gemini",
    fotografias: 3,
    camposEmFalta: 0,
    precoDoModelo: 210,
    precoEDoMotor: true,
  };

  it("formulário completo, fotografias e modelo de acordo → alta", () => {
    expect(confiancaDoOrcamento(bom).confianca).toBe("high");
  });

  it("sem fotografias → média (já não é alta só por o formulário vir completo)", () => {
    const r = confiancaDoOrcamento({ ...bom, fotografias: 0, precoDoModelo: null });
    expect(r.confianca).toBe("medium");
    expect(r.razoes.join(" ")).toContain("Sem fotografias");
  });

  it("sem fotografias e com o modelo em timeout → baixa, mas não esconde o número", () => {
    const r = confiancaDoOrcamento({ ...bom, fotografias: 0, quemLeu: "timeout", precoDoModelo: null });
    expect(r.confianca).toBe("low");
    expect(r.rever).toBe(false);
  });

  it("o modelo vê nas fotografias um trabalho muito maior → baixa e para rever", () => {
    const r = confiancaDoOrcamento({ ...bom, precoDoModelo: 400 });
    expect(r.confianca).toBe("low");
    expect(r.rever).toBe(true);
    expect(r.razoes.join(" ")).toContain("100% acima");
  });

  it("discordância moderada só baixa um degrau", () => {
    expect(confiancaDoOrcamento({ ...bom, precoDoModelo: 280 }).confianca).toBe("medium");
  });

  it("preço só do modelo, ou sem estimativa fechada → baixa", () => {
    expect(confiancaDoOrcamento({ ...bom, precoEDoMotor: false }).confianca).toBe("low");
    expect(confiancaDoOrcamento({ ...bom, status: "needs_more_info" }).confianca).toBe("low");
    expect(confiancaDoOrcamento({ ...bom, precoSemIva: null }).confianca).toBe("low");
  });
});

describe("na rota, o preço das recolhas é o do motor", () => {
  const rota = ler("src/app/api/simulator/analyze/route.ts");

  it("o bloco `doMotor` vem depois do modelo e antes da pesquisa externa, e usa o preço do motor", () => {
    const i = rota.indexOf("if (doMotor) {");
    expect(i).toBeGreaterThan(rota.indexOf("analysis = parseGeminiResponse(responseText);"));
    expect(i).toBeGreaterThan(rota.indexOf("if (daGrelha && fastEstimate.estimatedPriceWithoutVat) {"));
    expect(i).toBeLessThan(rota.indexOf("// ── 4. Pesquisa externa se necessário"));
    expect(rota.slice(i, i + 900)).toContain("estimatedPriceWithoutVat: fastEstimate.estimatedPriceWithoutVat,");
    expect(rota.slice(i, i + 900)).toContain("customerMessage: fastEstimate.customerMessage,");
  });

  it("a aprendizagem não toca na mudança (contrata-se à hora)", () => {
    expect(rota).toContain('order.serviceType !== "mudanca" && analysis.status === "estimated"');
  });

  it("a confiança vem de `confiancaDoOrcamento`, e a resposta guarda o preço do motor antes de aprender", () => {
    expect(rota).toContain("const leitura = confiancaDoOrcamento({");
    expect(rota).toContain("confidenceReasons: leitura.razoes,");
    expect(rota).toContain("precoDoMotorSemIva,");
    expect(rota).not.toContain("confidence = \"high\";");
  });

  it("o motor calcula mesmo as recolhas de móveis (senão `doMotor` nunca entrava)", async () => {
    const e = await calculateFastEstimate({
      serviceType: "recolha_moveis",
      heavyItems: ["sofá 3 lugares", "frigorífico", "mesa"],
      floor: "2",
      hasElevator: "sim",
      distanceFromBase: { distanceKm: 12 },
      city: "Lisboa",
    } as never);
    expect(e.status).toBe("estimated");
    expect(e.estimatedPriceWithoutVat ?? 0).toBeGreaterThan(0);
    expect(e.estimateMinWithoutVat ?? 0).toBeLessThanOrEqual(e.estimatedPriceWithoutVat ?? 0);
  });
});
