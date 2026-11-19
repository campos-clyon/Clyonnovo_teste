import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dividirEntrada, type LinhaParaDividir } from "./financas-do-mes";
import { negociacaoNoNovoModelo, taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";
import { contaDoValorAcordado } from "./pagamento-directo";

/**
 * d3 (CEO e dono, 19-11-2026) — AS FINANÇAS CONTAM BEM O MODELO DE 15-11.
 *
 * No modelo novo o cliente paga ao parceiro; o que entra na CLYON é a fatura da
 * taxa que o parceiro lhe passa — a taxa e o IVA DELA. As Finanças dividiam essa
 * entrada pela conta antiga (o IVA do trabalho inteiro), e a receita saía a um
 * terço. Valores de exemplo: um trabalho de 105,50 €
 * sem IVA, com 10 % de taxa, passa 12,98 € à CLYON = 10,55 € + 2,43 € de IVA.
 */

const TAXAS = { cliente: 0, profissional: 0.1 };

function linha(p: Partial<LinhaParaDividir>): LinhaParaDividir {
  return {
    id: 1,
    pedidoId: 9000,
    dia: "2026-11-19",
    metodo: "mbway",
    valor: 12.98,
    formaDoTrabalho: "plataforma",
    trid: null,
    parte: "divida",
    comissaoEupago: 0,
    // A conta antiga do trabalho: o IVA do trabalho inteiro e a taxa.
    conta: { total: 129.77, iva: 24.27, clyon: 10.55, profissional: 94.95 },
    ...p,
  };
}

describe("a passagem do parceiro no modelo de 15-11 divide-se pela fatura da taxa", () => {
  const passagem = taxaAPassarAClyon(105.5, TAXAS, "normal")!;

  it("a conta da taxa é a de pagamento-directo.ts: 10,55 + 2,43 = 12,98", () => {
    const c = contaDoValorAcordado(105.5, TAXAS, "normal")!;
    expect([passagem.comissao, passagem.iva, passagem.total]).toEqual([10.55, 2.43, 12.98]);
    expect(passagem.total).toBe(c.faturaDaClyonCent / 100);
  });

  it("receita 10,55 € e IVA 2,43 €, nada do parceiro", () => {
    const e = dividirEntrada(linha({ passagemDoNovoModelo: { iva: passagem.iva, comissao: passagem.comissao } }));
    expect(e.daParteDaClyon).toBe(true);
    expect([e.iva, e.receita, e.profissional]).toEqual([2.43, 10.55, 0]);
    expect(e.semConta).toBe(false);
  });

  it("sem a passagem (modelo antigo) fica a conta de sempre — era o erro: 9,05 de IVA e 3,93 de receita", () => {
    const e = dividirEntrada(linha({}));
    expect([e.iva, e.receita]).toEqual([9.05, 3.93]);
  });

  it("uma passagem parcial divide-se na proporção da fatura da taxa", () => {
    const e = dividirEntrada(linha({ valor: 6.49, passagemDoNovoModelo: { iva: passagem.iva, comissao: passagem.comissao } }));
    expect(e.iva + e.receita).toBeCloseTo(6.49, 2);
    expect(e.iva).toBeCloseTo(1.22, 2);
  });

  it("com a passagem, mesmo uma linha sem os sinais do pago em mão conta como do parceiro", () => {
    const e = dividirEntrada(
      linha({ parte: "trabalho", metodo: "multibanco", passagemDoNovoModelo: { iva: passagem.iva, comissao: passagem.comissao } }),
    );
    expect(e.daParteDaClyon).toBe(true);
    expect([e.iva, e.receita, e.profissional]).toEqual([2.43, 10.55, 0]);
  });

  it("o que não entra na CLYON continua fora, com ou sem passagem", () => {
    const e = dividirEntrada(linha({ metodo: "ao_profissional", passagemDoNovoModelo: { iva: 2.43, comissao: 10.55 } }));
    expect(e.entraNaClyon).toBe(false);
    expect([e.iva, e.receita]).toEqual([0, 0]);
  });

  it("as Finanças lêem a passagem da base pela regra única do modelo e pela taxaAPassarAClyon", () => {
    const src = readFileSync(join(__dirname, "financas-na-base.ts"), "utf8");
    expect(src).toMatch(/contratadasNoNovoModelo\(/);
    expect(src).toMatch(/taxaAPassarAClyon\(/);
    expect(src).toMatch(/passagemDoNovoModelo:/);
  });
});

describe("a regra de transição: um «pago ao profissional» registado fica no antigo em todo o lado", () => {
  const AGORA = new Date("2026-11-19T12:00:00Z");
  const contratadaAntes = { ofertaClyon: 0, contratadaEm: "2026-11-10T10:00:00Z", fechadoEm: null };
  const aoProfissional = { estado: "pago", pagoEm: "2026-11-15T18:00:00Z", metodo: "ao_profissional", parte: null };

  it("sem nada pago à CLYON, o contratado antes de 15-11 segue o novo (o corte «já pago à CLYON»)", () => {
    expect(negociacaoNoNovoModelo(contratadaAntes, [], AGORA)).toBe(true);
  });

  it("com o «pago ao profissional» registado, fica no antigo — como a carteira e a dívida", () => {
    expect(negociacaoNoNovoModelo(contratadaAntes, [aoProfissional], AGORA)).toBe(false);
    expect(negociacaoNoNovoModelo({ ...contratadaAntes, formaDePagamento: "plataforma" }, [aoProfissional], AGORA)).toBe(false);
  });

  it("em dinheiro combinado, o registo não é o «pago ao profissional» (a regra de pago-em-mao.ts)", () => {
    expect(negociacaoNoNovoModelo({ ...contratadaAntes, formaDePagamento: "dinheiro" }, [aoProfissional], AGORA)).toBe(true);
  });

  it("um registo por pagar não conta", () => {
    expect(negociacaoNoNovoModelo(contratadaAntes, [{ ...aoProfissional, estado: "pendente" }], AGORA)).toBe(true);
  });

  it("a Mesa e as listas passam a forma combinada à regra", () => {
    const src = readFileSync(join(__dirname, "novo-modelo-no-servidor.ts"), "utf8");
    expect((src.match(/formaDePagamento: n\.formaDePagamento/g) ?? []).length).toBe(2);
  });
});
