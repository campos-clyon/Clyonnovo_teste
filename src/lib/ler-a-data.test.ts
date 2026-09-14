import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerAData, quandoSera, diaPorPalavras } from "./ler-a-data";

/**
 * "Sim, estou interessada, pode ser no próximo dia 16?" — uma cliente,
 * 14-09-2026. O assistente respondeu-lhe com o ponto de situação, e o dono
 * teve de escrever à mão: «Sim pode, qual horário deseja.»
 *
 * "Como eu respondi, mas ele deve responder igual."
 *
 * O leitor aceitava uma forma só — `27/08 14:30` — e a mensagem de fecho
 * ENSINAVA essa forma. Quem escreve «dia 16» não escreve mal: fala como se
 * fala. Foi o leitor que ficou curto.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const AGORA = new Date(2026, 8, 14, 15, 0); // 14 de Setembro de 2026, 15:00

describe("a frase que a cliente escreveu", () => {
  it("«Sim, estou interessada, pode ser no próximo dia 16?» traz o dia lá dentro", () => {
    expect(lerAData("Sim, estou interessada, pode ser no próximo dia 16?")).toEqual({
      dia: 16,
      mes: null,
      hora: null,
      minuto: 0,
    });
  });

  it("o dia sem hora não marca nada — é isso que faz perguntar", () => {
    const d = lerAData("pode ser no dia 16?")!;
    expect(d.hora).toBeNull();
    expect(quandoSera(d, AGORA)).toBeNull();
    expect(diaPorPalavras(d)).toBe("dia 16");
  });
});

describe("as formas que se escrevem", () => {
  it("a de sempre continua a valer", () => {
    expect(lerAData("27/08 14:30")).toEqual({ dia: 27, mes: 8, hora: 14, minuto: 30 });
    expect(lerAData("16/10 9h")).toEqual({ dia: 16, mes: 10, hora: 9, minuto: 0 });
  });

  it("dia e hora sem barra", () => {
    expect(lerAData("dia 16 às 10")).toEqual({ dia: 16, mes: null, hora: 10, minuto: 0 });
    expect(lerAData("16 às 10h30")).toEqual({ dia: 16, mes: null, hora: 10, minuto: 30 });
  });

  it("o mês por extenso", () => {
    expect(lerAData("16 de outubro às 10h")).toEqual({ dia: 16, mes: 10, hora: 10, minuto: 0 });
    expect(lerAData("dia 3 de março")).toEqual({ dia: 3, mes: 3, hora: null, minuto: 0 });
  });

  it("só o dia, com a palavra «dia» à frente", () => {
    expect(lerAData("dia 16")).toEqual({ dia: 16, mes: null, hora: null, minuto: 0 });
    expect(lerAData("16/10")).toEqual({ dia: 16, mes: 10, hora: null, minuto: 0 });
  });
});

describe("na dúvida não se lê nada", () => {
  /*
   * Um número sozinho é uma contraproposta e tem de continuar a sê-lo: «300»
   * nunca pode virar o dia 300 nem as 3 horas. Por isso a hora exige marca —
   * «às», «h» ou «:» — e o dia sozinho exige a palavra «dia».
   */
  it("um valor sozinho não é uma data", () => {
    expect(lerAData("300")).toBeNull();
    expect(lerAData("94")).toBeNull();
    expect(lerAData("148,57")).toBeNull();
  });

  it("dois números soltos não são um dia e uma hora", () => {
    expect(lerAData("16 10")).toBeNull();
  });

  it("um nome com um número não é uma data", () => {
    expect(lerAData("Revolution 94")).toBeNull();
    expect(lerAData("Revolution: 84")).toBeNull();
  });

  it("um dia impossível não passa", () => {
    expect(lerAData("dia 47")).toBeNull();
    expect(lerAData("40/13")).toBeNull();
    expect(lerAData("16 às 99h")).toBeNull();
  });
});

describe("quando é que isso vai ser", () => {
  it("sem mês, é a próxima vez que esse dia acontece", () => {
    const d = lerAData("dia 16 às 10")!;
    const q = quandoSera(d, AGORA)!;
    expect(q.getMonth()).toBe(8); // Setembro — faltam dois dias
    expect(q.getDate()).toBe(16);
    expect(q.getHours()).toBe(10);
  });

  it("um dia que já passou este mês é do mês que vem", () => {
    const d = lerAData("dia 3 às 10")!;
    const q = quandoSera(d, AGORA)!;
    expect(q.getMonth()).toBe(9); // Outubro
    expect(q.getDate()).toBe(3);
  });

  it("ninguém marca para trás", () => {
    // 27 de Agosto com a data de hoje em Setembro: é do ano que vem.
    const d = lerAData("27/08 14:30")!;
    const q = quandoSera(d, AGORA)!;
    expect(q.getFullYear()).toBe(2027);
  });
});

describe("o fecho passa a ouvir o dia", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  /*
   * A frase de sempre — «se já tem data pensada, responda por exemplo 27/08
   * 14:30» — respondia a quem acabara de dar a data com um convite para a dar.
   */
  it("quem já disse o dia não leva o convite genérico", () => {
    expect(CEREBRO).toContain("const dito = diaQueEleDisse ? lerAData(diaQueEleDisse) : null;");
    expect(CEREBRO).toContain("Vi que falou no ${diaPorPalavras(dito)}");
  });

  it("e o que ele escreveu chega ao fecho", () => {
    expect(CEREBRO).toContain("fecharPeloCliente(telefone, alvo, conteudo.texto)");
  });

  it("um dia sem hora pergunta só a hora, e repete o dia", () => {
    expect(CEREBRO).toContain("Anotei o ${diaPorPalavras(lidaAData)}");
  });
});
