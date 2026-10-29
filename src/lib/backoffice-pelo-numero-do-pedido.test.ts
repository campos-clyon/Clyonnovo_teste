import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O BACKOFFICE PELO NÚMERO DO PEDIDO — 29-10-2026.
 *
 * O dono: as listas de pedidos vão sempre pelo número do pedido, do maior
 * para o menor — o mais recente no topo. Depois dos Pagamentos
 * (`pagamentos-por-numero-do-pedido.test.ts`), as Carteiras (antes do mais
 * baixo para o mais alto), a Mesa e os Trabalhos CLYON, Todos os pedidos e os
 * Trabalhos do assistente. A Agenda (pela hora) e os Levantamentos (pela data
 * do pedido de transferência) ficam como estão.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const TODOS = ler("src/components/admin/LegacyAdminClient.tsx");
const CARTEIRAS = ler("src/components/admin/AdminCarteirasPanel.tsx");
const ASSISTENTES = ler("src/lib/assistentes.ts");
const DO_ASSISTENTE = ler("src/components/admin/TrabalhosDoAssistente.tsx");

const consulta = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  return DB.slice(i, DB.indexOf("\nexport ", i + 10));
};

describe("a Mesa e os Trabalhos CLYON", () => {
  it("a rota lê pelo número do pedido (o que está em jogo primeiro, como sempre)", () => {
    expect(consulta("pedidosComNegociacoes")).toContain(
      "ORDER BY (o.status IN ('cancelado','concluido','arquivado')) ASC, o.id DESC",
    );
    expect(consulta("ofertasClyon")).toContain("ORDER BY o.id DESC");
  });

  it("o ecrã ordena pelo número, o maior em cima", () => {
    expect(MESA).toContain("function porNumero(a: { id: number }, b: { id: number }): number {\n  return b.id - a.id;\n}");
    expect(MESA).toContain("for (const t of [...clyonNaMesa].sort((a, b) => b.pedidoId - a.pedidoId)) {");
  });
});

describe("Todos os pedidos", () => {
  it("a rota e o ecrã pelo número do pedido, do maior para o menor", () => {
    expect(consulta("getAllSimulatorOrders")).toContain("ORDER BY id DESC LIMIT 100");
    expect(consulta("getAllSimulatorOrders")).not.toContain("ORDER BY createdAt");
    expect(TODOS).toContain(
      "() => pedidos.filter((p) => pedidoNoFiltro(p, pedidoStatusFilter)).sort((a, b) => b.id - a.id),",
    );
  });
});

describe("as Carteiras", () => {
  it("do maior para o menor (a regra de 14-10, do mais baixo para o mais alto, acabou)", () => {
    expect(CARTEIRAS).toContain(".sort((a, b) => b.pedidoId - a.pedidoId)");
    expect(CARTEIRAS).not.toContain(".sort((a, b) => a.pedidoId - b.pedidoId)");
  });
});

describe("os Trabalhos do assistente", () => {
  it("a conta devolve-os do número maior para o menor", () => {
    expect(ASSISTENTES).toContain(
      "const porNumeroDoPedido = (a: { pedidoId: number }, b: { pedidoId: number }) => b.pedidoId - a.pedidoId;",
    );
    expect(ASSISTENTES).toContain("detalhe: doPeriodo.map(({ t }) => t).sort(porNumeroDoPedido),");
    expect(ASSISTENTES).toContain("semValor: r.pendentes.map((x) => x.pedidoId).sort((x, y) => y - x),");
  });

  it("e o ecrã também, em todas as listas", () => {
    expect(DO_ASSISTENTE.split("{[...p.detalhe].sort((a, b) => b.pedidoId - a.pedidoId).map((t) => (").length - 1).toBe(2);
    expect(DO_ASSISTENTE).not.toContain("{p.detalhe.map(");
    expect(DO_ASSISTENTE).toContain("{[...d.aindaNaoContam!].sort((a, b) => b.pedidoId - a.pedidoId).map((t) => (");
    expect(DO_ASSISTENTE).toContain("{[...p.semValor].sort((x, y) => y - x).map((id) =>");
  });
});
