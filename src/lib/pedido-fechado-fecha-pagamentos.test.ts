import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MOTIVO_DO_PEDIDO_FECHADO,
  motivoDoPedidoFechado,
  pagamentoForaDeVigor,
} from "./conferir-o-pagamento";
import { estadoVistoPeloCliente } from "./pagamento-para-o-cliente";

/**
 * UM PEDIDO CANCELADO NÃO DEIXA PAGAMENTOS ABERTOS — 02-11-2026 (o #551).
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("o motivo e o pago tardio", () => {
  it("o motivo começa pela marca, com o estado do pedido", () => {
    expect(motivoDoPedidoFechado("cancelado").startsWith(MOTIVO_DO_PEDIDO_FECHADO)).toBe(true);
    expect(motivoDoPedidoFechado("arquivado")).toContain("arquivado");
  });

  it("um pago num pagamento fechado com o pedido fica fora de vigor: valor a devolver", () => {
    const p = { id: 9, valor: 140, estado: "cancelado", metodo: "mbway", erro: motivoDoPedidoFechado("cancelado") };
    expect(pagamentoForaDeVigor(p, [p])).toContain("valor a devolver");
  });

  it("um cancelado por outra razão (outro MB WAY pedido) continua a poder pagar", () => {
    const p = { id: 9, valor: 140, estado: "cancelado", metodo: "mbway", erro: "O cliente pediu outro MB WAY." };
    expect(pagamentoForaDeVigor(p, [p])).toBeNull();
  });
});

describe("todos os caminhos fecham os pagamentos", () => {
  const DB = ler("src/lib/db.ts");

  it("cancelarPedido (equipa, Trabalhos CLYON, cliente) fecha-os", () => {
    const i = DB.indexOf("export async function cancelarPedido(");
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toContain('fecharPagamentosAbertosDoPedido(pedidoId, "cancelado")');
  });

  it("mudar o estado para cancelado, arquivado ou rejeitado (o arquivo) fecha-os", () => {
    const i = DB.indexOf("export async function updateSimulatorOrder(");
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toContain('["cancelado", "arquivado", "rejeitado"].includes(data.status)');
    expect(corpo).toContain("fecharPagamentosAbertosDoPedido(id, data.status)");
  });

  it("e a conferência de hora a hora fecha os que já ficaram para trás", () => {
    const cron = ler("src/app/api/cron/conferir-pagamentos/route.ts");
    expect(cron).toContain("pedidosFechadosComPagamentosAbertos()");
    expect(cron).toContain("fecharPagamentosDoPedido(f.pedidoId, motivoDoPedidoFechado(f.status))");
  });

  it("fecha pelo caminho de sempre (fecharSemPagar), só os pendentes", () => {
    const base = ler("src/lib/pagamentos-na-base.ts");
    const i = base.indexOf("export async function fecharPagamentosDoPedido(");
    const corpo = base.slice(i, base.indexOf("\n}\n", i));
    expect(corpo).toContain("estado = 'pendente'");
    expect(corpo).toContain('fecharSemPagar(Number(l.id), "cancelado", { motivo })');
  });
});

describe("o MB WAY sem resposta no backoffice", () => {
  it("passado o prazo mostra-se expirado, como ao cliente", () => {
    const criado = Date.UTC(2026, 10, 2, 12, 40);
    const p = { metodo: "mbway" as const, estado: "pendente" as const, expiraEm: new Date(criado + 5 * 60_000) };
    expect(estadoVistoPeloCliente(p, criado + 7 * 60_000)).toBe("expirado");
    expect(ler("src/app/api/admin/pagamentos/route.ts")).toContain("estado: estadoVistoPeloCliente(p)");
  });
});
