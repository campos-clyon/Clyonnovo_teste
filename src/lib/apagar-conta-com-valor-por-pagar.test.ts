import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fraseDaContaComValorPorPagar, valorPorPagarAntesDeApagar } from "./conta-com-valor-por-pagar";

/*
 * d15 (CEO e dono, 13-11-2026), regra 3 — um parceiro com a taxa da plataforma
 * ou o IVA por pagar não elimina a conta: a rota recusa ANTES de suspender, com
 * uma frase clara, pela mesma conta da carteira (porPagar de dividasDe).
 */

describe("a conta do que falta pagar", () => {
  it("só o que falta (porPagar) das dívidas por pagar", () => {
    expect(valorPorPagarAntesDeApagar([])).toBe(0);
    expect(valorPorPagarAntesDeApagar([{ paga: true, porPagar: 0 }])).toBe(0);
    expect(valorPorPagarAntesDeApagar([{ paga: false, porPagar: 54.12 }, { paga: false, porPagar: 10.1 }])).toBeCloseTo(64.22, 2);
    expect(fraseDaContaComValorPorPagar(54.12)).toContain("54,12 €");
    expect(fraseDaContaComValorPorPagar(54.12)).not.toMatch(/em d[ií]vida/i);
  });
});

const rotaDaConta = vi.hoisted(() => ({
  dividas: [] as Array<{ paga: boolean; porPagar: number }>,
  suspensa: 0,
  apagada: 0,
  falhaALer: false,
}));
vi.mock("@/lib/db", () => ({
  apagarProfissional: async () => {
    rotaDaConta.apagada++;
    return { modo: "removido" };
  },
  definirEstadoDoProfissional: async () => {
    rotaDaConta.suspensa++;
  },
  perfilDoProfissional: async () => ({ nome: "Parceiro" }),
  ContaComPendencias: class extends Error {
    motivos: string[] = [];
  },
}));
vi.mock("@/lib/profissional-auth", () => ({ COOKIE_SESSAO_PROFISSIONAL: "s", tokenDoProfissional: () => "t" }));
vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: async () => ({ providerId: 7 }) }));
vi.mock("@/lib/cobrancas-na-base", () => ({
  dividasDoProfissional: async () => {
    if (rotaDaConta.falhaALer) throw new Error("base em baixo");
    return rotaDaConta.dividas;
  },
}));

describe("regra 3 — a rota DELETE /api/profissionais/conta", () => {
  const pedido = () =>
    new NextRequest("https://clyon.pt/api/profissionais/conta", {
      method: "DELETE",
      body: JSON.stringify({ confirmacao: "ELIMINAR" }),
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    rotaDaConta.dividas = [];
    rotaDaConta.suspensa = 0;
    rotaDaConta.apagada = 0;
    rotaDaConta.falhaALer = false;
  });

  it("com a taxa por pagar: 409 com a frase clara, e a conta nem é suspensa nem apagada", async () => {
    rotaDaConta.dividas = [{ paga: false, porPagar: 54.12 }];
    const { DELETE } = await import("@/app/api/profissionais/conta/route");
    const r = await DELETE(pedido());
    expect(r.status).toBe(409);
    const corpo = await r.json();
    expect(corpo.error).toContain("54,12 €");
    expect(corpo.comValoresPorPagar).toBe(true);
    expect(rotaDaConta.suspensa).toBe(0);
    expect(rotaDaConta.apagada).toBe(0);
  });

  it("na dúvida (a leitura falhou) também não elimina", async () => {
    rotaDaConta.falhaALer = true;
    const { DELETE } = await import("@/app/api/profissionais/conta/route");
    const r = await DELETE(pedido());
    expect(r.status).toBe(503);
    expect(rotaDaConta.apagada).toBe(0);
  });

  it("sem nada por pagar segue o caminho de sempre", async () => {
    rotaDaConta.dividas = [{ paga: true, porPagar: 0 }];
    const { DELETE } = await import("@/app/api/profissionais/conta/route");
    const r = await DELETE(pedido());
    expect(r.status).toBe(200);
    expect(rotaDaConta.suspensa).toBe(1);
    expect(rotaDaConta.apagada).toBe(1);
  });
});
