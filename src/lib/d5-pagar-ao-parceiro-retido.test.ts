import { describe, it, expect, vi, beforeEach } from "vitest";
import { DADOS_DE_PAGAMENTO_A_CONFIRMAR } from "./dados-de-pagamento-por-confirmar";

/**
 * d5 (19-11-2026) — um trabalho de teste com o IBAN mudado depois do contrato:
 * o bloco «Pagar a …» (o mesmo do site, da app de cliente e do email do valor
 * final) não dá o IBAN nem o MB WAY até o administrador confirmar.
 */

let retido = new Map<number, "mudaram" | "titular">();

vi.mock("@/lib/dados-de-pagamento-por-confirmar-na-base", () => ({
  negociacoesComDadosPorConfirmar: vi.fn(async () => retido),
}));
vi.mock("@/lib/dados-de-pagamento-mudados-na-base", () => ({
  negociacoesComDadosDePagamentoMudados: vi.fn(async () => new Set(retido.has(900) && retido.get(900) === "mudaram" ? [900] : [])),
}));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  perfilDoProfissional: vi.fn(async () => ({
    id: 31,
    name: "Parceiro de Teste",
    regimeIva: "normal",
    regimeIvaConfirmadoEm: "2026-11-14T10:00:00Z",
    iban: "PT50000201231234567890154",
    ibanTitular: "Parceiro de Teste",
    mbway: "912345678",
  })),
}));
vi.mock("@/lib/pagar-ao-parceiro-na-base", () => ({
  congelarRegimeDoProfissional: vi.fn(async (_id: number, r: string) => r),
  oQueONovoModeloGravou: vi.fn(async () => ({ regimeDoProfissional: null, pagarAoParceiroPor: null })),
}));
vi.mock("@/lib/faturas-do-trabalho-na-base", () => ({ faturasDaNegociacao: vi.fn(async () => []) }));

import { oQueOClienteVeDoParceiro } from "./pagar-ao-parceiro-para-o-cliente";

const trabalho = {
  pedidoId: 800,
  negociacaoId: 900,
  providerId: 31,
  profissionalNome: "Parceiro de Teste",
  acordado: 350,
  taxas: { cliente: 0, profissional: 0.1 },
} as never;

describe("d5 — o bloco «Pagar a …» com os dados retidos", () => {
  beforeEach(() => {
    retido = new Map();
  });

  it("IBAN mudado depois do contrato: sem IBAN nem MB WAY, a frase, e só o dinheiro no local", async () => {
    retido = new Map([[900, "mudaram"]]);
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(v.paraPagar).toEqual({ iban: null, titular: null, mbway: null });
    expect(v.semDados).toBe(DADOS_DE_PAGAMENTO_A_CONFIRMAR);
    expect(v.dadosPorConfirmar).toBe(true);
    expect(v.dadosMudaram).toBeNull();
    expect(v.opcoes.map((o) => o.id)).toEqual(["dinheiro"]);
  });

  it("depois de «Confirmei com o parceiro»: o IBAN e o MB WAY voltam", async () => {
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(v.paraPagar?.iban).toBe("PT50000201231234567890154");
    expect(v.paraPagar?.mbway).toBe("912345678");
    expect(v.dadosPorConfirmar).toBe(false);
    expect(v.semDados).toBeNull();
    expect(v.opcoes.map((o) => o.id)).toEqual(expect.arrayContaining(["transferencia", "mbway", "dinheiro"]));
  });
});
