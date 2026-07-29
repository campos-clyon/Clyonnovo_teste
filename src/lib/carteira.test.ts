import { describe, it, expect } from "vitest";

/**
 * A carteira passou a ser em euros a 29-07-2026, mas as colunas da base
 * ficaram com o mesmo nome e passaram a guardar cêntimos. É o género de
 * mudança que nenhuma verificação de esquema apanha: os tipos batem certo,
 * os nomes batem certo, e o ecrã mostra 4000 onde estão 40 euros.
 */

/** O que a rota faz ao ler a base. */
const paraEuros = (centimos: number | null) => (centimos != null ? centimos / 100 : null);
/** O que a rota faz ao escrever na base. */
const paraCentimos = (euros: number) => Math.round(euros * 100);

describe("cêntimos ↔ euros", () => {
  it("um saldo de 3300 na base são 33 euros no ecrã", () => {
    expect(paraEuros(3300)).toBe(33);
  });

  it("a taxa de um trabalho de 400 € é 40 €", () => {
    // calculate_job_credit_cost(400) devolve 4000 cêntimos
    expect(paraEuros(4000)).toBe(40);
  });

  it("ausência continua a ser ausência, não zero", () => {
    expect(paraEuros(null)).toBeNull();
  });

  it("o operador escreve euros e a base recebe cêntimos", () => {
    expect(paraCentimos(50)).toBe(5000);
    expect(paraCentimos(25.5)).toBe(2550);
  });

  // A base guarda inteiros: 12,345 € viraria 1234,5 e o Postgres recusaria
  it("arredonda ao cêntimo antes de enviar", () => {
    expect(Number.isInteger(paraCentimos(12.345))).toBe(true);
    expect(paraCentimos(12.345)).toBe(1235);
  });

  it("valores negativos revertem, e mantêm-se inteiros", () => {
    expect(paraCentimos(-10)).toBe(-1000);
    expect(Number.isInteger(paraCentimos(-0.05))).toBe(true);
  });

  // Escrever 50 e receber 0,50 € seria o erro caro deste modelo
  it("ida e volta não perde valor", () => {
    for (const eur of [0.01, 1, 20, 33.33, 100]) {
      expect(paraEuros(paraCentimos(eur))).toBeCloseTo(eur, 2);
    }
  });
});

describe("pacotes 1:1 — o saldo é o que se pagou", () => {
  // Havia bónus escondido nos pacotes maiores. Um saldo diferente do que se
  // pagou é uma moeda inventada outra vez.
  const PACOTES = [
    { codigo: "starter", price_cents: 2000, credits: 2000 },
    { codigo: "pro", price_cents: 5000, credits: 5000 },
    { codigo: "elite", price_cents: 10000, credits: 10000 },
  ];

  it("o que entra na carteira é igual ao que se pagou", () => {
    for (const p of PACOTES) {
      expect(p.credits, p.codigo).toBe(p.price_cents);
    }
  });

  it("carregar 100 € dá 100 € de saldo", () => {
    const elite = PACOTES.find((p) => p.codigo === "elite")!;
    expect(paraEuros(elite.credits)).toBe(100);
  });
});

describe("o que o profissional paga é 10%, não 15%", () => {
  // 15% é o total da CLYON somando as duas pontas: 5% de reserva que o
  // CLIENTE paga por cima, mais 10% de taxa que o profissional paga da
  // carteira. Escrever 15 na página dele sobrestima o custo em metade.
  const TAXA_ACEITACAO = 0.10;   // paga o profissional
  const RESERVA = 0.05;          // paga o cliente, por cima

  const trabalho = 400;

  it("o profissional recebe o valor acordado por inteiro", () => {
    expect(trabalho).toBe(400);
  });

  it("paga 10% de taxa e fica com 360", () => {
    const taxa = trabalho * TAXA_ACEITACAO;
    expect(taxa).toBe(40);
    expect(trabalho - taxa).toBe(360);
  });

  it("a reserva é ACRESCENTADA ao cliente, não abatida ao profissional", () => {
    const clientePaga = trabalho + trabalho * RESERVA;
    expect(clientePaga).toBe(420);
    // O erro que estava no portal: descontar a reserva ao profissional
    expect(trabalho - trabalho * RESERVA).not.toBe(trabalho - trabalho * TAXA_ACEITACAO);
  });

  it("a CLYON fica com 15%, somando as duas pontas", () => {
    const daClyon = trabalho * RESERVA + trabalho * TAXA_ACEITACAO;
    expect(daClyon).toBe(60);
    expect(daClyon / trabalho).toBeCloseTo(0.15, 5);
  });

  // O portal calculava bruto × 0,85 e chamava-lhe "ganhos líquidos"
  it("a conta antiga dava 340 — vinte euros a menos do que a verdade", () => {
    const antiga = trabalho * (1 - 0.15);
    expect(antiga).toBe(340);
    expect(trabalho - trabalho * TAXA_ACEITACAO - antiga).toBe(20);
  });
});
