import { describe, it, expect } from "vitest";
import {
  taxaPorDias,
  taxaPorUrgencia,
  diasAteData,
  taxaEmCentimos,
  formatarTaxa,
  DIAS_MAXIMOS_AGENDA,
} from "./taxa-agendamento";

describe("taxaPorDias — os quatro escalões", () => {
  it("hoje custa 29,99 €", () => {
    expect(taxaPorDias(0)).toBe(29.99);
  });

  it("amanhã custa 14,99 €", () => {
    expect(taxaPorDias(1)).toBe(14.99);
  });

  it("dos 2 aos 7 dias não se paga nada", () => {
    for (const d of [2, 3, 4, 5, 6, 7]) expect(taxaPorDias(d)).toBe(0);
  });

  it("dos 8 aos 30 volta a custar — 9,99 €, porque guardar lugar longe também ocupa agenda", () => {
    for (const d of [8, 15, 29, 30]) expect(taxaPorDias(d)).toBe(9.99);
  });

  it("as fronteiras exactas dos escalões", () => {
    expect(taxaPorDias(1)).toBe(14.99);
    expect(taxaPorDias(2)).toBe(0);
    expect(taxaPorDias(7)).toBe(0);
    expect(taxaPorDias(8)).toBe(9.99);
    expect(taxaPorDias(30)).toBe(9.99);
    expect(taxaPorDias(31)).toBeNull();
  });

  /**
   * `null` é "não se pode marcar", não "é grátis". Devolver 0 aqui era dizer
   * que se pode marcar para daqui a um ano, sem pagar nada.
   */
  it("depois dos 30 dias não há agenda — e isso não é o mesmo que taxa zero", () => {
    expect(taxaPorDias(DIAS_MAXIMOS_AGENDA + 1)).toBeNull();
    expect(taxaPorDias(365)).toBeNull();
    expect(taxaPorDias(-1)).toBeNull();
    expect(taxaPorDias(NaN)).toBeNull();
  });
});

describe("taxaPorDias — o que já não existe", () => {
  it("nenhum escalão cobra 40 € nem 20 €", () => {
    const valores = Array.from({ length: 31 }, (_, d) => taxaPorDias(d));
    expect(valores).not.toContain(40);
    expect(valores).not.toContain(20);
  });
});

describe("diasAteData — conta dias de calendário, não horas", () => {
  /**
   * Às 23h de hoje, um serviço às 9h de amanhã está a 10 horas de distância.
   * Se contássemos horas dava "hoje" e o cliente pagava 29,99 € em vez de
   * 14,99 € — o dobro, por causa da hora a que abriu o site.
   */
  it("às 23h, o dia seguinte é amanhã e não hoje", () => {
    const agora = new Date(2026, 6, 31, 23, 0);
    const amanhaCedo = new Date(2026, 7, 1, 9, 0);
    expect(diasAteData(amanhaCedo, agora)).toBe(1);
    expect(taxaPorDias(diasAteData(amanhaCedo, agora))).toBe(14.99);
  });

  it("o próprio dia é 0, seja a que horas for", () => {
    const agora = new Date(2026, 6, 31, 8, 0);
    expect(diasAteData(new Date(2026, 6, 31, 23, 30), agora)).toBe(0);
  });

  it("atravessa meses e anos", () => {
    expect(diasAteData(new Date(2026, 7, 3), new Date(2026, 6, 31))).toBe(3);
    expect(diasAteData(new Date(2027, 0, 1), new Date(2026, 11, 25))).toBe(7);
  });

  it("uma data passada dá negativo, e aí não há taxa possível", () => {
    const d = diasAteData(new Date(2026, 6, 30), new Date(2026, 6, 31));
    expect(d).toBe(-1);
    expect(taxaPorDias(d)).toBeNull();
  });
});

describe("taxaPorUrgencia — enquanto o site perguntar categorias", () => {
  it("hoje e amanhã batem certo com os escalões", () => {
    expect(taxaPorUrgencia("today")).toBe(29.99);
    expect(taxaPorUrgencia("tomorrow")).toBe(14.99);
  });

  /**
   * Quem escolhe "esta semana" ou "flexível" não escolheu um dia. Cobrar
   * 9,99 € por isso era cobrar por uma escolha que a pessoa não fez.
   */
  it("esta semana, flexível e sem urgência não pagam nada", () => {
    for (const u of ["this_week", "flexible", "no", "normal", "", null, undefined]) {
      expect(taxaPorUrgencia(u)).toBe(0);
    }
  });
});

describe("valores exactos — sem IVA e sem arredondar", () => {
  // O Intl usa espaço não separável antes do €; normaliza-se para comparar.
  const semEspacoEstranho = (v: number) => formatarTaxa(v).replace(/ /g, " ");

  it("29,99 € não vira 30 € nem 36,89 €", () => {
    expect(semEspacoEstranho(29.99)).toBe("29,99 €");
    expect(semEspacoEstranho(14.99)).toBe("14,99 €");
    expect(semEspacoEstranho(9.99)).toBe("9,99 €");
    // 29,99 × 1,23 = 36,89 — era isto que o cliente pagava com a taxa dentro
    // do preço do trabalho. Não é assim que se cobra.
    expect(semEspacoEstranho(29.99)).not.toContain("36");
  });

  it("cêntimos certos, sem erro de vírgula flutuante", () => {
    expect(taxaEmCentimos(29.99)).toBe(2999);
    expect(taxaEmCentimos(14.99)).toBe(1499);
    expect(taxaEmCentimos(9.99)).toBe(999);
    expect(taxaEmCentimos(0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A taxa saiu mesmo do preço do trabalho?
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("pricing-helper — a urgência já não mexe no preço do trabalho", () => {
  const motor = readFileSync(join(process.cwd(), "src/lib/pricing-helper.ts"), "utf8");

  /**
   * O ficheiro tem código E um prompt para o Gemini. Tirar os +40/+20 do
   * código e deixá-los no prompt não resolvia nada: o modelo continuava a
   * somá-los. Este teste olha para o ficheiro inteiro de propósito.
   */
  it("não soma nada ao preço por causa da urgência — nem no código nem no prompt", () => {
    expect(motor).not.toMatch(/extras \+= 40/);
    expect(motor).not.toMatch(/extras \+= 20/);
    expect(motor).not.toMatch(/Urgência hoje: \+40/);
    expect(motor).not.toMatch(/Urgência amanhã: \+20/);
  });

  it("o prompt diz ao modelo para NÃO somar a urgência", () => {
    expect(motor).toContain("A URGÊNCIA NÃO ENTRA NO PREÇO DO TRABALHO");
  });

  it("a taxa vem da tabela partilhada, não de números soltos no motor", () => {
    expect(motor).toContain('from "./taxa-agendamento"');
    expect(motor).toContain("taxaPorUrgencia");
  });

  it("é devolvida à parte, para não poder ser somada por engano", () => {
    expect(motor).toContain("schedulingFee");
  });
});

describe("simulator/analyze — a taxa não vem do modelo", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/simulator/analyze/route.ts"), "utf8");

  /**
   * O resto do resultado pode vir do Gemini. A taxa não: é uma tabela fixa e
   * tem de vir sempre do motor local, ou um dia o modelo inventa um valor e
   * passamos a cobrar o que ele achou.
   */
  it("o valor preservado é o do motor local", () => {
    expect(rota).toContain("schedulingFee: fastEstimate.schedulingFee");
  });
});
