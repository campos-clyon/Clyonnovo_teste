import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { porNumeroDoPedido } from "@/lib/lote-dos-pagamentos";
import { agrupar } from "@/lib/filtros-dos-pagamentos";

/**
 * OS PAGAMENTOS PELO NÚMERO DO PEDIDO — 29-10-2026.
 *
 * Dentro de cada profissional os trabalhos apareciam baralhados (#504, #500,
 * #457, #488, #448, #464, #466…). A regra do dono: ordenar sempre pelo número
 * do pedido, do maior para o menor — #500 por cima de #499. A ordem dos grupos
 * (os profissionais, os dias, «Prontos a pagar», «Feitos»…) não muda.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminPagamentosPanel.tsx");
const LEVANTAMENTOS = ler("src/components/admin/AdminLevantamentosPanel.tsx");

const decrescente = (ns: number[]) => ns.every((n, i) => i === 0 || ns[i - 1] >= n);

describe("a ordem dentro de cada grupo", () => {
  type L = { pedidoId: number; pro: number; nome: string; dia: string };
  const lista: L[] = [
    { pedidoId: 504, pro: 1, nome: "Revolution", dia: "2026-10-20T10:00:00Z" },
    { pedidoId: 457, pro: 1, nome: "Revolution", dia: "2026-10-28T10:00:00Z" },
    { pedidoId: 488, pro: 1, nome: "Revolution", dia: "2026-10-01T10:00:00Z" },
    { pedidoId: 500, pro: 2, nome: "Manuel Martins", dia: "2026-10-20T15:00:00Z" },
    { pedidoId: 448, pro: 2, nome: "Manuel Martins", dia: "2026-10-27T10:00:00Z" },
    { pedidoId: 499, pro: 2, nome: "Manuel Martins", dia: "2026-10-20T09:00:00Z" },
  ];
  const como = { profissional: (l: L) => ({ id: l.pro, nome: l.nome }), data: (l: L) => l.dia };
  const agora = new Date("2026-10-29T12:00:00Z");

  it("por profissional: cada um do número maior para o menor, e os grupos como estavam", () => {
    const grupos = agrupar(porNumeroDoPedido(lista), "profissional", como, agora);
    expect(grupos.map((g) => g.titulo)).toEqual(["Manuel Martins", "Revolution"]);
    expect(grupos.map((g) => g.linhas.map((l) => l.pedidoId))).toEqual([
      [500, 499, 448],
      [504, 488, 457],
    ]);
  });

  it("por dia: os dias do mais recente para trás, e dentro de cada um pelo número", () => {
    const grupos = agrupar(porNumeroDoPedido(lista), "dia", como, agora);
    for (const g of grupos) expect(decrescente(g.linhas.map((l) => l.pedidoId))).toBe(true);
    // No dia 20 há três: o #504, o #500 e o #499, por esta ordem, seja qual for a hora.
    expect(grupos.find((g) => g.linhas.length === 3)?.linhas.map((l) => l.pedidoId)).toEqual([504, 500, 499]);
  });

  it("sem separar: a lista inteira do número maior para o menor", () => {
    const [g] = agrupar(porNumeroDoPedido(lista), "nada", como, agora);
    expect(g.linhas.map((l) => l.pedidoId)).toEqual([504, 500, 499, 488, 457, 448]);
  });
});

describe("o ecrã dos Pagamentos", () => {
  it("todas as listas de trabalhos passam pelo número do pedido", () => {
    expect(PAINEL).toContain("const emOrdem = porNumeroDoPedido([...actual.linhas, ...ficaramAqui]);");
    expect(PAINEL).toContain("...porNumeroDoPedido(aPagar.filter(prontoAPagar)),");
    expect(PAINEL).toContain("...porNumeroDoPedido(aPagar.filter((t) => !prontoAPagar(t))),");
    expect(PAINEL).toContain("{porNumeroDoPedido(faturas).map((f) => (");
    expect(PAINEL).toContain("{porNumeroDoPedido(estado.ultimos).map((p) => {");
  });

  it("já não se ordena pela data", () => {
    expect(PAINEL).not.toContain("maisRecentesPrimeiro");
    expect(PAINEL).not.toContain("quandoNaLista");
  });

  it("os grupos mantêm a ordem: prontos a pagar, à espera do cliente, ainda por fazer", () => {
    const a = PAINEL.indexOf('{ titulo: "Prontos a pagar"');
    const b = PAINEL.indexOf('titulo: "Feitos, à espera do cliente');
    const c = PAINEL.indexOf('{ titulo: "Ainda por fazer"', b);
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe("os Levantamentos", () => {
  it("os pedidos abatidos no saldo também vão do número maior para o menor", () => {
    expect(LEVANTAMENTOS).toContain("{[...(l.abatido ?? [])].sort((a, b) => b.pedidoId - a.pedidoId).map((a) =>");
  });
});
