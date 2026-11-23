import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d93 (CEO e dono, 23-11-2026) — o cancelamento pela conversa, na base: o de
 * sempre (`cancelarPedido`, os parceiros avisados), e depois, NA HORA, a
 * mensagem ao cliente, o «não contactar», a anonimização e a conversa apagada.
 * Base fingida; nenhuma mensagem sai a ninguém. Números INVENTADOS.
 */

const e = vi.hoisted(() => ({
  ordem: [] as string[],
  pedido: { id: 812, status: "enviado", anonimizadoEm: null as string | null, contactPhone: "351910000001", valorFixoClyon: null, serviceType: "recolha_monos", city: "Almada", scheduledDate: null, dataAgendada: null },
  negociacaoContratada: false,
  pagamentoPago: false,
  referenciaViva: false,
  fatura: false,
  outrosAbertos: [] as Array<{ id: number; status: string; contactPhone: string }>,
  anonimizar: [] as Array<{ id: number; semNome?: boolean }>,
}));

const pool = vi.hoisted(() => ({
  execute: async (sql: string) => {
    if (/FROM simulatorOrders o WHERE o\.id = \?/.test(sql)) return [[e.pedido], []];
    if (/FROM negociacoes n/.test(sql)) return [e.negociacaoContratada ? [{ x: 1 }] : [], []];
    if (/FROM pagamentos WHERE pedidoId = \? AND \(estado = 'pago'/.test(sql)) return [e.pagamentoPago ? [{ x: 1 }] : [], []];
    if (/FROM pagamentos WHERE pedidoId = \? AND estado = 'pendente'/.test(sql)) return [e.referenciaViva ? [{ x: 1 }] : [], []];
    if (/FROM faturasDoTrabalho/.test(sql)) return [e.fatura ? [{ x: 1 }] : [], []];
    if (/SELECT id, status, contactPhone FROM simulatorOrders/.test(sql)) return [[{ id: 812, status: "cancelado", contactPhone: "351910000001" }, ...e.outrosAbertos], []];
    return [[], []];
  },
}));

vi.mock("./db", async (original) => ({
  ...(await original<typeof import("./db")>()),
  getPool: vi.fn(async () => pool),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureNegociacoesTable: vi.fn(async () => {}),
  negociacoesDoPedido: vi.fn(async () => [{ id: 5, estado: "aberta" }]),
  cancelarPedido: vi.fn(async () => {
    e.ordem.push("cancelar");
    return { encerradas: 1 };
  }),
  gravarMotivoDoFecho: vi.fn(async () => {}),
  appendOrderHistory: vi.fn(async () => {
    e.ordem.push("historico");
  }),
  registarSemFalhar: vi.fn(async () => {}),
  quemTemOTrabalhoClyon: vi.fn(async () => ({ vivos: [] })),
  apagarConversaWhatsApp: vi.fn(async () => {
    e.ordem.push("apagar-conversa");
    return 3;
  }),
}));
vi.mock("./avisar-cancelamento", () => ({
  avisarDoCancelamento: vi.fn(async () => {
    e.ordem.push("avisar-parceiros");
  }),
}));
vi.mock("./validade-do-orcamento-na-base", () => ({ marcarCicloTerminado: vi.fn(async () => {}) }));
vi.mock("./seguimento-do-cliente-na-base", () => ({ pararSeguimento: vi.fn(async () => true) }));
vi.mock("./whatsapp-cloud", () => ({
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    e.ordem.push(`mensagem: ${texto}`);
    return true;
  }),
}));
vi.mock("./nao-contactar", () => ({
  marcarParaNaoContactar: vi.fn(async () => {
    e.ordem.push("nao-contactar");
    return true;
  }),
}));
vi.mock("./regras-novas-na-base", () => ({
  anonimizarPedido: vi.fn(async (id: number, o: { semNome?: boolean }) => {
    e.ordem.push("anonimizar");
    e.anonimizar.push({ id, semNome: o.semNome });
    return { pedidoId: id, fotografias: 0, fotografiasApagadas: 0, eventoApagado: false };
  }),
}));

import { cancelarPeloCliente } from "./cancelar-pelo-cliente-na-base";

beforeEach(() => {
  e.ordem = [];
  e.negociacaoContratada = false;
  e.pagamentoPago = false;
  e.referenciaViva = false;
  e.fatura = false;
  e.outrosAbertos = [];
  e.anonimizar = [];
});
afterEach(() => vi.clearAllMocks());

describe("d93 — cancelar pela conversa: anonimizado na hora, não contactar, e a mensagem", () => {
  it("a ordem: cancelar → avisar os parceiros → a mensagem → não contactar → histórico → anonimizar → apagar a conversa", async () => {
    const r = await cancelarPeloCliente(812, "351910000001");
    expect(r).toEqual({ ok: true, encerradas: 1, conversaApagada: true });
    expect(e.ordem).toEqual([
      "cancelar",
      "avisar-parceiros",
      "mensagem: O seu pedido #812 foi cancelado. Não voltaremos a contactá-lo e os seus dados foram apagados.",
      "nao-contactar",
      "historico",
      "anonimizar",
      "apagar-conversa",
    ]);
    expect(e.anonimizar).toEqual([{ id: 812, semNome: true }]);
  });

  it("com outro pedido aberto do mesmo número, a conversa fica (é dele, e desse pedido)", async () => {
    e.outrosAbertos = [{ id: 790, status: "enviado", contactPhone: "351910000001" }];
    const r = await cancelarPeloCliente(812, "351910000001");
    expect(r.ok && r.conversaApagada).toBe(false);
    expect(e.ordem).toContain("anonimizar");
    expect(e.ordem).not.toContain("apagar-conversa");
  });

  it("contratado, pago, com referência viva ou faturado: não cancela nem apaga nada — fica com a equipa", async () => {
    for (const marca of ["negociacaoContratada", "pagamentoPago", "referenciaViva", "fatura"] as const) {
      e.ordem = [];
      e[marca] = true;
      const r = await cancelarPeloCliente(812, "351910000001");
      expect(r.ok, marca).toBe(false);
      expect(!r.ok && r.daEquipa, marca).toBe(true);
      expect(e.ordem, marca).toEqual([]);
      e[marca] = false;
    }
  });

  it("o pedido de outro número nunca se cancela por aqui", async () => {
    const r = await cancelarPeloCliente(812, "351910000999");
    expect(r.ok).toBe(false);
    expect(e.ordem).toEqual([]);
  });
});
