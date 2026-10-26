import { describe, it, expect } from "vitest";
import { ACONTECIMENTOS_DO_DINHEIRO, entradasDoHistorico, marcasDoDinheiro } from "./historico-do-pedido";

/**
 * O HISTÓRICO DE UM TRABALHO NOS PAGAMENTOS — 26-10-2026 (d25).
 *
 * *«Esses pedidos que estão como pagos nós deveríamos poder abrir para ver do
 * que se trata — ao clicar, deveria ter a opção de abrir o histórico.»*
 */

describe("quem marcou o quê e quando, no dinheiro", () => {
  const linhas = [
    { acontecimento: "pedido_criado", ocorridoEm: "2026-10-20 09:00:00", autorTipo: "cliente", resumo: "Pedido novo" },
    {
      acontecimento: "levantamento_pago",
      ocorridoEm: "2026-10-26 10:00:00",
      autorTipo: "clyon",
      autorNome: "Administrador",
      resumo: "Pagamento ao profissional marcado como feito — 311,50 €.",
      negociacaoId: 7,
    },
    {
      acontecimento: "pagamento_recebido",
      ocorridoEm: "2026-10-25 14:03:00",
      autorTipo: "clyon",
      autorNome: "Administrador",
      resumo: "Transferência: 430,50 € registados à mão.",
      negociacaoId: 7,
    },
    // Um profissional trocado: a negociação antiga do mesmo pedido.
    { acontecimento: "negociacao_fechada", ocorridoEm: "2026-10-21 08:00:00", autorTipo: "sistema", negociacaoId: 6 },
    { acontecimento: "negociacao_fechada", ocorridoEm: "2026-10-22 08:00:00", autorTipo: "sistema", negociacaoId: 7 },
  ];

  it("só os acontecimentos do dinheiro, do mais antigo para o mais recente", () => {
    const m = marcasDoDinheiro(linhas, 7);
    expect(m.map((x) => x.acontecimento)).toEqual(["negociacao_fechada", "pagamento_recebido", "levantamento_pago"]);
    expect(m[1]).toMatchObject({ quem: "Administrador", oQue: "Transferência: 430,50 € registados à mão." });
    // A data da base vem sem fuso e é UTC (`instanteDaBase`).
    expect(m[1].quando).toBe("2026-10-25T14:03:00.000Z");
  });

  it("a linha de outra negociação do mesmo pedido fica de fora; sem saber qual é, entram todas", () => {
    expect(marcasDoDinheiro(linhas, 7).some((x) => x.quando === "2026-10-21T08:00:00.000Z")).toBe(false);
    expect(marcasDoDinheiro(linhas).filter((x) => x.acontecimento === "negociacao_fechada")).toHaveLength(2);
  });

  it("sem nome do autor, diz-se quem foi pelo tipo; sem resumo, pelo acontecimento", () => {
    const [m] = marcasDoDinheiro([{ acontecimento: "pagamento_recebido", ocorridoEm: null, autorTipo: "sistema" }]);
    expect(m).toMatchObject({ quem: "automático", oQue: "Pagamento do cliente recebido", quando: null });
  });

  it("os acontecimentos do dinheiro incluem as duas pontas", () => {
    expect(ACONTECIMENTOS_DO_DINHEIRO).toContain("pagamento_recebido");
    expect(ACONTECIMENTOS_DO_DINHEIRO).toContain("levantamento_pago");
    expect(ACONTECIMENTOS_DO_DINHEIRO).toContain("valor_corrigido");
  });
});

describe("o histórico do pedido", () => {
  it("do mais recente para trás, com quem e se é dinheiro", () => {
    const json = JSON.stringify([
      { type: "created", by: null, message: "Pedido recebido.", createdAt: "2026-10-20 09:00:00" },
      { type: "created", by: null, message: "Administrador registou que o cliente pagou 430,50 € — Transferência.", createdAt: "2026-10-25 14:03:00" },
      { type: "note", by: { id: 1, nome: "Assistente", role: "assistente" }, message: "Cliente pediu para ligar.", createdAt: "2026-10-23 11:00:00" },
    ]);
    const h = entradasDoHistorico(json);
    expect(h.map((x) => x.quando)).toEqual([
      "2026-10-25T14:03:00.000Z",
      "2026-10-23T11:00:00.000Z",
      "2026-10-20T09:00:00.000Z",
    ]);
    expect(h[0].dinheiro).toBe(true);
    expect(h[1]).toMatchObject({ quem: "Assistente", tipo: "note", dinheiro: false });
    // «recebido» sozinho não é dinheiro: o pedido também se recebe.
    expect(h[2].dinheiro).toBe(false);
  });

  it("um histórico partido, vazio ou com entradas sem mensagem não rebenta o ecrã", () => {
    expect(entradasDoHistorico("não é json")).toEqual([]);
    expect(entradasDoHistorico(null)).toEqual([]);
    expect(entradasDoHistorico("{}")).toEqual([]);
    expect(entradasDoHistorico(JSON.stringify([{ type: "x" }, null, { message: "Fica", createdAt: "lixo" }]))).toEqual([
      { quando: null, quem: null, tipo: "nota", mensagem: "Fica", dinheiro: false },
    ]);
  });
});
