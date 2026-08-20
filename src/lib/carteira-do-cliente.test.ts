import { describe, it, expect } from "vitest";
import { carteiraDoCliente, type TrabalhoDoCliente } from "./carteira-do-cliente";
import { quantoOClientePaga } from "./taxas-plataforma";

const t = (p: Partial<TrabalhoDoCliente>): TrabalhoDoCliente => ({
  negociacaoId: 1,
  pedidoId: 100,
  estado: "acordada",
  valorAcordado: 200,
  ...p,
});

describe("carteiraDoCliente", () => {
  it("sem trabalhos, tudo a zero", () => {
    expect(carteiraDoCliente([])).toEqual({ retido: 0, pago: 0, total: 0, linhas: [] });
  });

  // Enquanto não confirma, o dinheiro está prometido e não saiu. É a única
  // coisa que ele controla, e por isso é a que aparece primeiro.
  it("um trabalho fechado e por confirmar fica retido", () => {
    const c = carteiraDoCliente([t({})]);
    expect(c.retido).toBe(quantoOClientePaga(200));
    expect(c.pago).toBe(0);
    expect(c.linhas[0].fase).toBe("retido");
  });

  it("confirmar passa-o a pago", () => {
    const c = carteiraDoCliente([t({ confirmadoEm: "2026-08-20T10:00:00Z" })]);
    expect(c.pago).toBe(quantoOClientePaga(200));
    expect(c.retido).toBe(0);
    expect(c.linhas[0].fase).toBe("pago");
  });

  // Uma negociação aberta é uma conversa, não é dinheiro: contá-la dava um
  // número que mudava a cada contraproposta.
  it("negociações por fechar não contam", () => {
    const c = carteiraDoCliente([
      t({ estado: "aberta" }),
      t({ estado: "aguarda_contratacao" }),
      t({ estado: "desistida" }),
      t({ estado: "morta" }),
    ]);
    expect(c.total).toBe(0);
    expect(c.linhas).toHaveLength(0);
  });

  it("o total é sempre o que ele paga, com a taxa incluída", () => {
    const c = carteiraDoCliente([t({ valorAcordado: 100 })]);
    // 100 secos não é o que sai da conta dele.
    expect(c.linhas[0].total).not.toBe(100);
    expect(c.linhas[0].total).toBe(quantoOClientePaga(100));
  });

  it("soma vários e separa por fase", () => {
    const c = carteiraDoCliente([
      t({ negociacaoId: 1, valorAcordado: 100 }),
      t({ negociacaoId: 2, valorAcordado: 200, confirmadoEm: "2026-08-19T10:00:00Z" }),
      t({ negociacaoId: 3, valorAcordado: 300, pagoEm: "2026-08-18T10:00:00Z" }),
    ]);
    expect(c.retido).toBe(quantoOClientePaga(100));
    expect(c.pago).toBe(
      Math.round((quantoOClientePaga(200) + quantoOClientePaga(300)) * 100) / 100,
    );
    expect(c.total).toBe(Math.round((c.retido + c.pago) * 100) / 100);
  });

  it("o que ele ainda pode travar aparece primeiro", () => {
    const c = carteiraDoCliente([
      t({ negociacaoId: 1, confirmadoEm: "2026-08-19T10:00:00Z" }),
      t({ negociacaoId: 2 }),
    ]);
    expect(c.linhas.map((l) => l.negociacaoId)).toEqual([2, 1]);
  });

  // Uma linha estragada na base não pode inventar dinheiro nem rebentar o ecrã.
  it("aguenta valores impossíveis e datas inválidas", () => {
    const c = carteiraDoCliente([
      t({ valorAcordado: null }),
      t({ valorAcordado: 0 }),
      t({ valorAcordado: -50 }),
      t({ valorAcordado: "não é número" }),
      t({ negociacaoId: 9, valorAcordado: 100, confirmadoEm: "lixo" }),
    ]);
    expect(c.linhas).toHaveLength(1);
    expect(c.linhas[0].fase).toBe("retido");
  });
});
