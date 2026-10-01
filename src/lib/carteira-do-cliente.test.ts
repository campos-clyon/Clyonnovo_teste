import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carteiraDoCliente, type TrabalhoDoCliente } from "./carteira-do-cliente";
import { contaDoCliente } from "./taxas-plataforma";

/*
 * O QUE ELE PAGA: valor mais taxa, SEM IVA.
 *
 * "Vamos apresentar os valores sempre sem IVA." — 17-09-2026. A carteira a
 * dizer 361,20 € sobre um trabalho anunciado a 294,00 € era a terceira versão
 * do mesmo preço, e a que ninguém tinha visto antes.
 */
const paga = (v: number) => contaDoCliente(v).semIva;

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
    expect(c.retido).toBe(paga(200));
    expect(c.pago).toBe(0);
    expect(c.linhas[0].fase).toBe("retido");
  });

  it("confirmar passa-o a pago", () => {
    const c = carteiraDoCliente([t({ confirmadoEm: "2026-08-20T10:00:00Z" })]);
    expect(c.pago).toBe(paga(200));
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
    expect(c.linhas[0].total).toBe(paga(100));
  });

  it("soma vários e separa por fase", () => {
    const c = carteiraDoCliente([
      t({ negociacaoId: 1, valorAcordado: 100 }),
      t({ negociacaoId: 2, valorAcordado: 200, confirmadoEm: "2026-08-19T10:00:00Z" }),
      t({ negociacaoId: 3, valorAcordado: 300, pagoEm: "2026-08-18T10:00:00Z" }),
    ]);
    expect(c.retido).toBe(paga(100));
    expect(c.pago).toBe(
      Math.round((paga(200) + paga(300)) * 100) / 100,
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

  /*
   * AS TAXAS DE CADA TRABALHO — 29-09-2026.
   *
   * A carteira fazia a conta com as taxas de origem. Num trabalho em dinheiro
   * a taxa do cliente é 11 % (leva a parte do profissional), e a carteira
   * dizia-lhe outro número do que a proposta que ele aceitou.
   */
  it("usa as taxas que o trabalho gravou, e não as de origem", () => {
    const c = carteiraDoCliente([t({ valorAcordado: 120, taxaCliente: "0.11", taxaProfissional: "0" })]);
    // 120 + 11 % = 133,20 — o preço dele, como a página do pedido o diz.
    expect(c.linhas[0].total).toBe(133.2);
    expect(c.linhas[0].total).not.toBe(paga(120));
  });

  it("sem taxas gravadas, as de origem — como em todo o lado", () => {
    const c = carteiraDoCliente([t({ valorAcordado: 120 })]);
    expect(c.linhas[0].total).toBe(paga(120));
  });
});

describe("o ecrã da carteira não diz «retido» a ninguém", () => {
  /*
   * A carteira junta trabalhos pagos pela plataforma e trabalhos pagos em
   * notas ao profissional — e não sabe quais dos primeiros já pagaram a
   * referência. «Retido» e «Já pago» eram falsos para uma parte deles.
   */
  const ECRA = readFileSync(join(process.cwd(), "src/app/conta/components/Carteira.tsx"), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("cada linha diz «em curso» ou «concluído»", () => {
    expect(ECRA).toContain('l.fase === "retido" ? "em curso" : "concluído"');
    expect(ECRA).not.toMatch(/"retido" : "pago"/);
    expect(ECRA).not.toContain("Já pago");
  });

  it("e as taxas de cada trabalho chegam à conta", () => {
    expect(ECRA).toContain("taxaCliente: n.taxaCliente");
    expect(ECRA).toContain("taxaProfissional: n.taxaProfissional");
  });
});
