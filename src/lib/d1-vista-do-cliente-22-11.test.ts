import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));

import { estadoDoPagamentoParaOCliente } from "./pagamento-para-o-cliente";
import { faseParaOCliente } from "./trabalho";
import { estadoDoPedidoParaOCliente, pedidoFechado } from "./pedido-para-a-app";
import { noFiltro } from "./pedidos-do-cliente";
import { ESTADO_ARQUIVADO, PEDIDO_ARQUIVADO } from "./promessas-publicas";
import { PAGUE_PELA_REFERENCIA_DA_CLYON } from "./palavras-do-pagamento";
import type { TrabalhoAPagar } from "./acesso-ao-pagamento";

/*
 * d1 de 22/11/2026 — O cliente vê o valor do acordo final e o «Concluído».
 * (1) acordo final (d78): o valor acordado e a frase, sem botão de pagar;
 * (2) fecho automático (d76): «Concluído» antes da frase do contratado;
 * (3) arquivado pelo seguimento (d83): «Arquivado», com a frase da Vitória.
 */

const trabalho = (acordoFinal: number | null): TrabalhoAPagar =>
  ({
    pedidoId: 591,
    negociacaoId: 1,
    providerId: 1,
    profissionalNome: "Parceiro de teste",
    acordado: 350,
    regime: "isento",
    taxas: { cliente: 0, profissional: 0.1 },
    formaDePagamento: "plataforma",
    modelo: "iva_incluido",
    semFactura: false,
    acordoFinal,
    libertado: false,
    novoModelo: false,
    porHora: null,
    emailDoCliente: "teste@example.com",
  }) as unknown as TrabalhoAPagar;

describe("d1 (1) o acordo final na vista do cliente", () => {
  it("com acordo: o valor acordado, a frase, e nenhum botão de pagar", async () => {
    const e = await estadoDoPagamentoParaOCliente(trabalho(250));
    expect(e.disponivel).toBe(false);
    expect(e.acordoFinal).toEqual({ valor: 250, frase: PAGUE_PELA_REFERENCIA_DA_CLYON });
    expect(e.valores).toEqual({ semFactura: 250, comFactura: 250 });
    expect(e.ivaIncluido).toBe(false);
    expect(e.desdobramento).toBeNull();
    expect(e.transferencia).toBeNull();
  });

  it("sem acordo: tudo como antes", async () => {
    const e = await estadoDoPagamentoParaOCliente(trabalho(null));
    expect(e.acordoFinal).toBeNull();
    expect(e.valores.comFactura).toBeGreaterThan(350);
  });
});

describe("d1 (2) o pedido fechado sozinho diz «Concluído»", () => {
  const base = { comPropostas: 0, enviado: true, trabalhoClyon: false };

  it("fase para o cliente: um pedido concluído já não está «por confirmar»", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: "2026-11-20T10:00:00Z", confirmadoEm: null, pagoEm: "2026-11-21T10:00:00Z" };
    expect(faseParaOCliente(t)).toBe("a_confirmar");
    expect(faseParaOCliente({ ...t, pedidoConcluido: true })).toBe("pago");
    expect(faseParaOCliente({ ...t, pagoEm: null, pedidoConcluido: true })).toBe("confirmado");
    expect(faseParaOCliente({ estado: "aberta", pedidoConcluido: true })).toBe("a_negociar");
  });

  it("o estado em palavras: «Concluído» antes de «Por confirmar»", () => {
    const contratado = { fase: "a_confirmar" as const, profissionalNome: "Parceiro" };
    expect(estadoDoPedidoParaOCliente({ ...base, status: "acordado", contratado })).toBe("Por confirmar");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "concluido", contratado })).toBe("Concluído");
  });
});

describe("d1 (3) o pedido arquivado pelo seguimento diz «Arquivado»", () => {
  const base = { comPropostas: 0, enviado: true, trabalhoClyon: false, contratado: null };

  it("arquivado: «Arquivado»; cancelado e rejeitado: «Cancelado»; cancelado pelo cliente: «Cancelado»", () => {
    expect(estadoDoPedidoParaOCliente({ ...base, status: "arquivado" })).toBe(ESTADO_ARQUIVADO);
    expect(estadoDoPedidoParaOCliente({ ...base, status: "cancelado" })).toBe("Cancelado");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "rejeitado" })).toBe("Cancelado");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "arquivado", canceladoPeloCliente: 1 })).toBe("Cancelado");
  });

  it("fica nos fechados, no separador «Cancelados» e fora dos «Em aberto»", () => {
    expect(pedidoFechado(ESTADO_ARQUIVADO)).toBe(true);
    expect(noFiltro(ESTADO_ARQUIVADO, "cancelados")).toBe(true);
    expect(noFiltro(ESTADO_ARQUIVADO, "em_aberto")).toBe(false);
  });

  it("a frase é a da Vitória", () => {
    expect(PEDIDO_ARQUIVADO).toContain("pode voltar a pedir quando quiser");
    expect(PEDIDO_ARQUIVADO).not.toMatch(/cancel/i);
  });
});
