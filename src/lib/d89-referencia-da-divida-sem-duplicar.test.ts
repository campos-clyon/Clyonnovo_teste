import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/*
 * d89 (23-11-2026): a referência da dívida de um Trabalho CLYON pago ao
 * profissional gera-se pela porta de sempre (`gerarReferenciaDaDivida`) — a
 * carteira dele e o botão do backoffice. Uma Multibanco viva reaproveita-se:
 * nunca duas referências vivas para a mesma dívida. Dados inventados.
 */

const linhas: Array<Record<string, unknown>> = [];

vi.mock("./db", () => ({ registarSemFalhar: vi.fn(async () => {}), getPool: vi.fn(async () => null) }));
vi.mock("./acesso-ao-pagamento", () => ({
  trabalhoVistoPeloBackoffice: vi.fn(async () => ({
    ok: true,
    trabalho: {
      pedidoId: 9002,
      negociacaoId: 902,
      providerId: 6,
      profissionalNome: "Exemplo",
      acordado: 370,
      regime: "normal",
      taxas: { cliente: 0, profissional: 0.15 },
      formaDePagamento: "plataforma",
      acrescimo: 0,
      modelo: "sem_iva",
      libertado: true,
      novoModelo: false,
      porHora: null,
      telefoneDoCliente: null,
      telefoneDoProfissional: "910000000",
      nomeDoCliente: null,
      emailDoCliente: null,
    },
  })),
}));
vi.mock("./marcas-da-divida-na-base", () => ({ marcasDasNegociacoes: vi.fn(async () => new Map()) }));
vi.mock("./cobrancas-na-base", () => ({ dividasDoProfissional: vi.fn(async () => []) }));
vi.mock("./pedir-ao-eupago", () => ({
  pedirPagamento: vi.fn(async () => ({ ok: true, referencia: "999 888 777", entidade: "12345", trid: "t-1" })),
}));
vi.mock("./pagamentos-na-base", () => ({
  pagamentosDaNegociacao: vi.fn(async () => linhas.map((l) => ({ ...l }))),
  abrirPagamento: vi.fn(async (d: Record<string, unknown>) => {
    const id = 500 + linhas.length;
    linhas.unshift({ id, estado: "pedido", referencia: null, entidade: null, ...d });
    return id;
  }),
  marcarPedido: vi.fn(async (id: number, r: Record<string, unknown>) => {
    const l = linhas.find((x) => x.id === id);
    if (l) Object.assign(l, { estado: "pendente", referencia: r.referencia, entidade: r.entidade });
  }),
  marcarFalhado: vi.fn(async () => {}),
  fecharSemPagar: vi.fn(async () => {}),
}));

import { gerarReferenciaDaDivida } from "./cobrar-divida-do-profissional";
import * as pedir from "./pedir-ao-eupago";
import * as base from "./pagamentos-na-base";

const antes = { chave: process.env.EUPAGO_API_KEY, ambiente: process.env.EUPAGO_AMBIENTE };

describe("d89 — a referência da dívida de um Trabalho CLYON pago ao profissional", () => {
  beforeEach(() => {
    process.env.EUPAGO_API_KEY = "chave-de-teste";
    process.env.EUPAGO_AMBIENTE = "sandbox";
    linhas.length = 0;
    // O registo «o cliente pagou ao profissional» (370 €, sem fatura) e a referência antiga, cancelada.
    linhas.push(
      { id: 205, estado: "pago", metodo: "ao_profissional", valor: 370, valorPago: 370, parte: "trabalho", trid: null, expiraEm: null },
      { id: 200, estado: "cancelado", metodo: "multibanco", valor: 68.27, parte: "divida", referencia: "1", expiraEm: null },
    );
    vi.mocked(pedir.pedirPagamento).mockClear();
    vi.mocked(base.abrirPagamento).mockClear();
  });
  afterAll(() => {
    process.env.EUPAGO_API_KEY = antes.chave;
    process.env.EUPAGO_AMBIENTE = antes.ambiente;
  });

  it("gera uma Multibanco à parte, só da taxa (sem fatura, sem IVA)", async () => {
    const r = await gerarReferenciaDaDivida(902, { metodo: "multibanco", autor: { tipo: "clyon", nome: "teste" } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reaproveitada).toBe(false);
    expect(r.divida).toMatchObject({ total: 55.5, iva: 0, comissao: 55.5 });
    expect(vi.mocked(base.abrirPagamento).mock.calls[0][0]).toMatchObject({ valor: 55.5, parte: "divida", comFactura: false });
    expect(r.pagamento.referencia).toBe("999 888 777");
  });

  it("carregar outra vez não gera outra: reaproveita a viva", async () => {
    await gerarReferenciaDaDivida(902, { metodo: "multibanco", autor: { tipo: "clyon", nome: "teste" } });
    const outra = await gerarReferenciaDaDivida(902, { metodo: "multibanco", autor: { tipo: "profissional", nome: "na carteira" } });
    expect(outra.ok && outra.reaproveitada).toBe(true);
    expect(vi.mocked(pedir.pedirPagamento)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(base.abrirPagamento)).toHaveBeenCalledTimes(1);
    expect(linhas.filter((l) => l.estado === "pendente" && l.parte === "divida")).toHaveLength(1);
  });

  it("paga (a linha à parte fechada pelo webhook), já não se gera nada", async () => {
    linhas.push({ id: 210, estado: "pago", metodo: "multibanco", valor: 55.5, parte: "divida", trid: "abatimento-mao-902", expiraEm: null });
    const r = await gerarReferenciaDaDivida(902, { metodo: "multibanco", autor: { tipo: "clyon", nome: "teste" } });
    expect(r).toMatchObject({ ok: false, jaPaga: true });
    expect(vi.mocked(pedir.pedirPagamento)).not.toHaveBeenCalled();
  });
});
