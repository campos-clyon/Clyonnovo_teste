import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d101 (dono, 24-11-2026) — refazer as referências sem a reserva: as pagas não
 * se mexem; as por pagar ganham a nova (pelo caminho de sempre) e a velha fica
 * «cancelado» com o motivo; com a reserva ligada, recusa. Números de teste,
 * sem pessoas.
 */

const m = vi.hoisted(() => ({
  ligada: false,
  gravadas: [] as Array<{ negociacaoId: number; pedidoId: number; reservaCent: number; valorAcordado: number; valorUnicoCliente: number }>,
  pagamentos: new Map<number, Array<{ id: number; estado: string; metodo: string; valor: number; referencia: string | null }>>(),
  fechar: vi.fn(async () => ({ feito: true })),
  gerar: vi.fn(),
  historico: vi.fn(async (_pedidoId: number, _entrada: unknown) => {}),
}));

vi.mock("./db", () => ({ appendOrderHistory: m.historico, registarSemFalhar: vi.fn(async () => {}) }));
vi.mock("./reserva-na-base", () => ({
  reservaLigada: vi.fn(async () => m.ligada),
  negociacoesComReservaGravada: vi.fn(async () => m.gravadas),
}));
vi.mock("./marcas-da-divida-na-base", () => ({ marcasDasNegociacoes: vi.fn(async () => new Map()) }));
vi.mock("./pagamentos-na-base", () => ({
  pagamentosDaNegociacao: vi.fn(async (id: number) => m.pagamentos.get(id) ?? []),
  fecharSemPagar: m.fechar,
}));
vi.mock("./acesso-ao-pagamento", () => ({
  trabalhoVistoPeloBackoffice: vi.fn(async () => ({ ok: true, trabalho: { novoModelo: true } })),
}));
vi.mock("./cobrar-divida-do-profissional", () => ({ gerarReferenciaDaDivida: m.gerar }));

import { refazerSemReserva } from "./refazer-sem-reserva-na-base";

const quem = { id: 1, nome: "teste", papel: "admin" };

beforeEach(() => {
  m.ligada = false;
  m.fechar.mockClear();
  m.gerar.mockReset();
  m.historico.mockClear();
  m.gravadas = [
    { negociacaoId: 11, pedidoId: 901, reservaCent: 7500, valorAcordado: 80, valorUnicoCliente: 155 },
    { negociacaoId: 12, pedidoId: 902, reservaCent: 1000, valorAcordado: 120, valorUnicoCliente: 130 },
  ];
  m.pagamentos = new Map([
    [11, [{ id: 101, estado: "pendente", metodo: "multibanco", valor: 102.09, referencia: "000 000 001" }]],
    [12, [{ id: 102, estado: "pago", metodo: "multibanco", valor: 27.06, referencia: "000 000 002" }]],
  ]);
  m.gerar.mockImplementation(async () => ({
    ok: true,
    pagamento: { id: 201, estado: "pendente", metodo: "multibanco", valor: 9.84, referencia: "000 000 003" },
    divida: { total: 9.84 },
    reaproveitada: false,
  }));
});

describe("refazer sem a reserva", () => {
  it("a por pagar: gera a nova e anula a velha com o motivo; a paga fica à parte, sem mexer", async () => {
    const r = await refazerSemReserva(quem);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(m.gerar).toHaveBeenCalledTimes(1);
    expect(m.gerar.mock.calls[0][0]).toBe(11);
    expect(m.fechar).toHaveBeenCalledTimes(1);
    expect(m.fechar.mock.calls[0]).toEqual([
      101,
      "cancelado",
      { motivo: expect.stringContaining("Reserva do valor único retirada (dono, 24/11/2026)") },
    ]);
    expect(m.fechar.mock.calls.some((c) => (c as unknown[])[0] === 102)).toBe(false);
    expect(r.resultado.refeitas).toEqual([
      { pedidoId: 901, negociacaoId: 11, anuladas: [{ pagamentoId: 101, valor: 102.09 }], nova: { pagamentoId: 201, valor: 9.84, referencia: "000 000 003" }, porqueSemNova: null },
    ]);
    expect(r.resultado.pagas.map((p) => p.pedidoId)).toEqual([902]);
    expect(m.historico).toHaveBeenCalledTimes(1);
    expect(m.historico.mock.calls[0][0]).toBe(901);
  });

  it("se a nova não se gera, a velha fica (o parceiro nunca fica sem referência)", async () => {
    m.gerar.mockImplementation(async () => ({ ok: false, porque: "euPago indisponível" }));
    const r = await refazerSemReserva(quem);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(m.fechar).not.toHaveBeenCalled();
    expect(r.resultado.porVer.map((p) => p.pedidoId)).toEqual([901]);
  });

  it("com a reserva ligada, recusa e não mexe em nada", async () => {
    m.ligada = true;
    const r = await refazerSemReserva(quem);
    expect(r.ok).toBe(false);
    expect(m.gerar).not.toHaveBeenCalled();
    expect(m.fechar).not.toHaveBeenCalled();
  });
});
