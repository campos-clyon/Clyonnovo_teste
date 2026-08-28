import { describe, it, expect } from "vitest";
import { quandoEOTrabalho, quandoPorExtenso, eMesmoUrgente } from "./quando-e-o-trabalho";

/**
 * "Amanhã" tem de querer dizer amanhã.
 *
 * O painel guardava a palavra que o cliente escreveu e lia-a sempre contra
 * hoje. Um pedido feito na segunda-feira a dizer «amanhã» continuava a dizer
 * «amanhã» na quinta — e o profissional que o abrisse estava a ler uma
 * promessa para um dia que já tinha passado.
 *
 * Os dias aqui são reais e vêm da base: o #226 foi pedido a 25 de agosto de
 * 2026 para o dia seguinte, e a 28 ainda prometia amanhã.
 */

/* Sexta-feira, 28 de agosto de 2026, às 10:00 em Lisboa. */
const HOJE = new Date("2026-08-28T09:00:00.000Z");

describe("a data marcada ganha sempre", () => {
  it("diz o dia e a hora, e não uma palavra", () => {
    const q = quandoEOTrabalho(
      { urgency: "tomorrow", dataAgendada: "2026-08-29T10:00:00.000Z" },
      HOJE,
    );
    expect(q.dia).toBe("Amanhã, sábado, 29 de agosto");
    expect(q.hora).toBe("11:00");
    expect(q.origem).toBe("marcada");
  });

  it("a frase inteira cabe numa linha", () => {
    expect(
      quandoPorExtenso({ dataAgendada: "2026-08-29T10:00:00.000Z" }, HOJE),
    ).toBe("Amanhã, sábado, 29 de agosto, às 11:00");
  });

  it("contradiz a palavra do cliente quando é preciso", () => {
    // Ele escreveu "esta semana"; combinou-se o dia 7. Vale o combinado.
    const q = quandoEOTrabalho(
      { urgency: "this_week", dataAgendada: "2026-09-07T11:29:00.000Z" },
      HOJE,
    );
    expect(q.dia).toContain("7 de setembro");
    expect(q.origem).toBe("marcada");
  });

  it("a hora é a de Lisboa, e não a do telemóvel de quem lê", () => {
    // O trabalho é às onze em Lisboa mesmo que ele esteja em Espanha.
    expect(quandoEOTrabalho({ dataAgendada: "2026-08-28T10:00:00.000Z" }, HOJE).hora).toBe("11:00");
  });

  it("meia-noite não é hora nenhuma", () => {
    /*
     * É o que sobra quando se grava um dia sem hora. Ninguém vai buscar um
     * sofá às 00:00, e escrevê-lo dava-lhe uma certeza falsa.
     */
    const q = quandoEOTrabalho({ dataAgendada: "2026-08-28T23:00:00.000Z" }, HOJE);
    expect(q.hora).toBeNull();
    expect(q.aviso).toContain("Sem hora marcada");
  });
});

describe("sem data marcada, a conta faz-se desde o dia do pedido", () => {
  it("«amanhã» pedido ontem é HOJE, e não amanhã", () => {
    const q = quandoEOTrabalho(
      { urgency: "tomorrow", criadoEm: "2026-08-27T18:00:00.000Z" },
      HOJE,
    );
    expect(q.curto).toBe("Hoje");
    expect(q.dia).toBe("Hoje, sexta-feira, 28 de agosto");
    expect(q.origem).toBe("deduzida");
  });

  it("«amanhã» pedido há três dias já passou — e diz-se", () => {
    // O #226, tal como está na base.
    const q = quandoEOTrabalho(
      { urgency: "tomorrow", criadoEm: "2026-08-25T18:05:00.000Z" },
      HOJE,
    );
    expect(q.passou).toBe(true);
    expect(q.curto).toBe("26 de agosto");
    expect(q.aviso).toContain("25 de agosto");
    expect(q.aviso).toContain("já passou");
  });

  it("nunca inventa uma hora", () => {
    const q = quandoEOTrabalho({ urgency: "today", criadoEm: "2026-08-28T07:00:00.000Z" }, HOJE);
    expect(q.hora).toBeNull();
    expect(q.aviso).toContain("não marcou hora");
  });

  it("sem data de criação, supõe hoje — que era o que se fazia sempre", () => {
    expect(quandoEOTrabalho({ urgency: "tomorrow" }, HOJE).curto).toBe("Amanhã");
  });

  it("aceita as duas grafias que estão na base", () => {
    // Dois pedidos antigos ficaram com a palavra em português.
    for (const p of ["flexible", "flexivel"]) {
      expect(quandoEOTrabalho({ urgency: p }, HOJE).origem).toBe("sem_data");
    }
  });
});

describe("«esta semana» é uma janela, e não um dia", () => {
  it("diz até quando, em vez de inventar um dia lá dentro", () => {
    const q = quandoEOTrabalho(
      { urgency: "this_week", criadoEm: "2026-08-27T10:00:00.000Z" },
      HOJE,
    );
    expect(q.origem).toBe("janela");
    expect(q.dia).toContain("Até");
    expect(q.dia).toContain("3 de setembro");
  });

  it("uma semana que já acabou aparece como acabada", () => {
    const q = quandoEOTrabalho(
      { urgency: "this_week", criadoEm: "2026-08-10T10:00:00.000Z" },
      HOJE,
    );
    expect(q.passou).toBe(true);
    expect(q.curto).toBe("Passou");
  });
});

describe("sem pressa nenhuma", () => {
  it("não finge que há data", () => {
    const q = quandoEOTrabalho({ urgency: "flexible" }, HOJE);
    expect(q.dia).toBe("Sem data marcada");
    expect(q.passou).toBe(false);
    expect(q.aviso).toContain("Proponha o dia");
  });

  it("um pedido sem urgência nenhuma cai no mesmo sítio", () => {
    // 24 pedidos na base têm `urgency` a NULL.
    expect(quandoEOTrabalho({}, HOJE).origem).toBe("sem_data");
  });
});

describe("o ⚡ só acende quando é mesmo urgente", () => {
  it("acende para hoje e para amanhã", () => {
    expect(eMesmoUrgente({ urgency: "today", criadoEm: "2026-08-28T07:00:00.000Z" }, HOJE)).toBe(
      true,
    );
    expect(eMesmoUrgente({ urgency: "tomorrow", criadoEm: "2026-08-28T07:00:00.000Z" }, HOJE)).toBe(
      true,
    );
  });

  it("NÃO acende para um «amanhã» de há três dias", () => {
    // Era exactamente este o cartão que se acendia a mentir.
    expect(eMesmoUrgente({ urgency: "tomorrow", criadoEm: "2026-08-25T18:05:00.000Z" }, HOJE)).toBe(
      false,
    );
  });

  it("acende por uma data marcada, mesmo sem palavra nenhuma", () => {
    expect(eMesmoUrgente({ dataAgendada: "2026-08-28T10:00:00.000Z" }, HOJE)).toBe(true);
  });
});
