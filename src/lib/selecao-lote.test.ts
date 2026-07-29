import { describe, it, expect } from "vitest";

/**
 * Réplica da regra que decide quem entra numa remoção em lote.
 *
 * O que se protege aqui não é uma preferência de interface: remover o último
 * administrador por um clique numa caixa deixa o painel sem ninguém que lá
 * possa entrar, e isso não tem desfazer.
 */
type Linha = { id: number; nome: string; funcao: string; isAdmin?: number };

function podeSerRemovido(row: Linha, adminNome: string): boolean {
  if (row.isAdmin === 1 || row.funcao === "admin") return false;
  if (adminNome && row.nome.toUpperCase() === adminNome.toUpperCase()) return false;
  return true;
}

const EQUIPA: Linha[] = [
  { id: 1, nome: "WANDERSON", funcao: "admin", isAdmin: 1 },
  { id: 2, nome: "ISABELA", funcao: "assistente" },
  { id: 3, nome: "JOHN", funcao: "motorista" },
  { id: 4, nome: "MIRIAM", funcao: "assistente" },
];

describe("quem pode ser removido em lote", () => {
  it("um administrador nunca entra na selecção", () => {
    expect(podeSerRemovido(EQUIPA[0], "OUTRO")).toBe(false);
  });

  it("a própria conta nunca entra, mesmo não sendo admin", () => {
    expect(podeSerRemovido(EQUIPA[1], "ISABELA")).toBe(false);
  });

  it("a comparação do nome ignora maiúsculas", () => {
    expect(podeSerRemovido({ id: 9, nome: "Miriam", funcao: "assistente" }, "MIRIAM")).toBe(false);
  });

  it("assistentes e motoristas entram", () => {
    expect(podeSerRemovido(EQUIPA[2], "WANDERSON")).toBe(true);
    expect(podeSerRemovido(EQUIPA[3], "WANDERSON")).toBe(true);
  });

  it("isAdmin conta mesmo com outra função escrita", () => {
    expect(podeSerRemovido({ id: 7, nome: "X", funcao: "assistente", isAdmin: 1 }, "")).toBe(false);
  });

  // Marcar todos não pode arrastar quem está protegido
  it("marcar todos só apanha os removíveis", () => {
    const seleccionaveis = EQUIPA.filter((r) => podeSerRemovido(r, "WANDERSON"));
    expect(seleccionaveis.map((r) => r.nome)).toEqual(["ISABELA", "JOHN", "MIRIAM"]);
  });

  it("uma equipa só de administradores não deixa marcar nada", () => {
    const so = [EQUIPA[0]];
    expect(so.filter((r) => podeSerRemovido(r, "WANDERSON"))).toEqual([]);
  });
});

describe("estado da caixa de marcar todos", () => {
  const todos = (marcados: number, total: number) => ({
    checked: total > 0 && marcados === total,
    indeterminate: marcados > 0 && marcados < total,
  });

  it("vazia quando nada está marcado", () => {
    expect(todos(0, 3)).toEqual({ checked: false, indeterminate: false });
  });

  it("parcial quando alguns estão marcados", () => {
    expect(todos(2, 3)).toEqual({ checked: false, indeterminate: true });
  });

  it("cheia quando estão todos", () => {
    expect(todos(3, 3)).toEqual({ checked: true, indeterminate: false });
  });

  // Sem linhas removíveis a caixa não pode aparecer marcada
  it("não fica marcada quando não há nada para marcar", () => {
    expect(todos(0, 0)).toEqual({ checked: false, indeterminate: false });
  });
});
