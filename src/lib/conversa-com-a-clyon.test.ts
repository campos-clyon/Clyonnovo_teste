import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * S18 — O «PEDIR MAIS DETALHES» CHEGA AO CLIENTE (29-10-2026). Dados de teste.
 */

const pedidos = new Map<number, Record<string, unknown>>();
const historico: Array<{ id: number; type: string; message: string; by: unknown }> = [];
const actualizacoes: Array<{ id: number; data: Record<string, unknown> }> = [];

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderById: vi.fn(async (id: number) => pedidos.get(id)),
  updateSimulatorOrder: vi.fn(async (id: number, data: Record<string, unknown>) => {
    actualizacoes.push({ id, data });
    Object.assign(pedidos.get(id)!, data);
  }),
  appendOrderHistory: vi.fn(async (id: number, e: { type: string; message: string; by: unknown }) => {
    historico.push({ id, ...e });
  }),
}));
vi.mock("@/lib/avisos-ao-cliente", async (original) => ({
  ...(await original<typeof import("@/lib/avisos-ao-cliente")>()),
  avisarOClienteDoPedido: vi.fn(async () => {}),
}));
vi.mock("@/lib/avisar-contacto-do-pedido", () => ({ avisarContactoDoPedido: vi.fn(async () => true) }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import { pedirMaisDetalhes, detalhesPorWhatsApp } from "./conversa-com-a-clyon";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import { avisarContactoDoPedido } from "@/lib/avisar-contacto-do-pedido";
import { aClyonPrecisaDeSi, mensagensDoPedido, textoParaOCliente } from "./historico-para-o-cliente";
import { ESTADO_PRECISA_DE_SI, estadoDoPedidoParaOCliente, novidadeDoPedido } from "./pedido-para-a-app";
import { avisoAoCliente } from "./avisos-ao-cliente";
import { POST as resposta } from "@/app/api/cliente/pedidos/[id]/resposta/route";
import { assinarSessaoDoCliente } from "./cliente-auth";

const EMAIL = "cliente.teste@exemplo.pt";
let sessao = "";
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-da-conversa";
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000))).token;
});

beforeEach(() => {
  pedidos.clear();
  historico.length = 0;
  actualizacoes.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  pedidos.set(701, { id: 701, contactEmail: EMAIL, contactPhone: "912 345 678", contactName: "Cliente Teste", filesJson: "[]" });
  pedidos.set(702, { id: 702, contactEmail: null, contactPhone: "912 345 678", filesJson: "[]" });
});

describe("S18 — pedir mais detalhes", () => {
  it("grava o estado, a mensagem inteira e avisa na app e por email quem tem conta", async () => {
    const longa = "Pode enviar fotografias do sofá? ".repeat(10).trim();
    await pedirMaisDetalhes(701, longa, { id: 1, nome: "Equipa", role: "admin" });
    expect(actualizacoes[0]).toEqual({ id: 701, data: { status: "precisa_info", mensagemCliente: longa } });
    expect(historico[0].type).toBe("info_requested");
    expect(textoParaOCliente(historico[0])).toBe(longa);
    expect(avisarOClienteDoPedido).toHaveBeenCalledWith(701, "detalhes");
    expect(vi.mocked(avisarContactoDoPedido).mock.calls[0][0]).toEqual({ id: 701, contactEmail: EMAIL });
  });

  it("sem email, avisa por WhatsApp ao telefone do pedido", async () => {
    await pedirMaisDetalhes(702, "Qual é o andar?", null);
    expect(avisarOClienteDoPedido).not.toHaveBeenCalled();
    expect(avisarContactoDoPedido).toHaveBeenCalledWith(
      { id: 702, contactPhone: "912 345 678" },
      detalhesPorWhatsApp(702, "Qual é o andar?"),
    );
  });

  it("«Pedir o que falta» só avisa na app (a equipa já manda a mensagem pela mão dela)", async () => {
    await pedirMaisDetalhes(702, "Para enviar o pedido aos profissionais, falta:", null, { semAvisoPorFora: true });
    expect(avisarContactoDoPedido).not.toHaveBeenCalled();
  });

  it("as três portas da equipa e a conta passam pela mesma função", () => {
    expect(ler("src/app/api/admin/pedidos/[id]/pedir-info/route.ts")).toMatch(/pedirMaisDetalhes\(orderId, message,/);
    expect(ler("src/app/api/admin/pedidos/[id]/o-que-falta/route.ts")).toMatch(/pedirMaisDetalhes\(/);
    expect(ler("src/app/api/admin/suporte/conversas/route.ts")).toMatch(/avisarDaRespostaDaClyon\(pedidoId\)/);
    expect(ler("src/app/api/users/me/orders/[id]/reply/route.ts")).toMatch(/responderAClyon\(orderId,/);
    expect(ler("src/app/api/cliente/pedidos/[id]/resposta/route.ts")).toMatch(/responderAClyon\(pedidoId,/);
  });
});

describe("S18 — o que o cliente vê", () => {
  const H = JSON.stringify([
    { type: "note", message: "Nota interna", by: { nome: "Ana" }, createdAt: "2026-10-29T10:00:00Z" },
    { type: "info_requested", message: 'Pedido de informação enviado ao cliente: "Qual é o andar?"', by: { nome: "Ana" }, createdAt: "2026-10-29T10:01:00Z" },
  ]);
  it("a conversa diz «CLYON» e «Eu», sem o nome da equipa nem as notas internas", () => {
    const m = mensagensDoPedido(H);
    expect(m).toEqual([{ de: "CLYON", tipo: "detalhes", texto: "Qual é o andar?", em: "2026-10-29T10:01:00Z" }]);
    expect(JSON.stringify(m)).not.toContain("Ana");
  });

  it("o estado e a novidade novos, até ele responder", () => {
    expect(aClyonPrecisaDeSi("precisa_info", H)).toBe(true);
    const respondido = JSON.stringify([...JSON.parse(H), { type: "client_reply", message: "3.º andar", createdAt: "2026-10-29T11:00:00Z" }]);
    expect(aClyonPrecisaDeSi("precisa_info", respondido)).toBe(false);
    expect(aClyonPrecisaDeSi("em_analise", H)).toBe(false);
    const base = { status: "precisa_info", trabalhoClyon: false, contratado: null, comPropostas: 0, enviado: false };
    expect(estadoDoPedidoParaOCliente({ ...base, precisaDeSi: true })).toBe(ESTADO_PRECISA_DE_SI);
    expect(ESTADO_PRECISA_DE_SI).toBe("A CLYON precisa de mais detalhes");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "cancelado", precisaDeSi: true })).toBe("Cancelado");
    expect(
      novidadeDoPedido({ precisaDeSi: true, ajustePorResponder: true, porConfirmar: false, porPagar: false, propostasPorResponder: 0 }),
    ).toBe("Responda à CLYON");
  });

  it("o aviso no telemóvel (G6)", () => {
    expect(avisoAoCliente("detalhes", { pedidoId: 701 })).toEqual({
      title: "Mais detalhes sobre o pedido #701",
      body: "A CLYON precisa de mais detalhes para enviar o pedido aos parceiros. Toque para responder.",
    });
  });
});

describe("S18 — R14 POST /api/cliente/pedidos/[id]/resposta", () => {
  const chamar = (id: string, corpo: unknown, bearer = sessao) =>
    resposta(
      new NextRequest(`https://clyon.pt/api/cliente/pedidos/${id}/resposta`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(corpo),
      }),
      { params: Promise.resolve({ id }) },
    );

  it("sem sessão 401; pedido de outro email 404", async () => {
    expect((await chamar("701", { mensagem: "Olá" }, "")).status).toBe(401);
    expect((await chamar("702", { mensagem: "Olá" })).status).toBe(404);
  });

  it("grava a resposta como client_reply, e as fotografias só do nosso armazenamento", async () => {
    const r = await chamar("701", {
      mensagem: "É no 3.º andar.",
      fotografias: ["https://abc.public.blob.vercel-storage.com/simulador/sofa.jpg"],
    });
    expect(r.status).toBe(200);
    expect(historico.at(-1)).toMatchObject({ type: "client_reply", message: "É no 3.º andar. (juntou 1 fotografia)" });
    expect(JSON.parse(String(pedidos.get(701)!.filesJson))).toHaveLength(1);
    expect((await chamar("701", { mensagem: "x", fotografias: ["https://outro.exemplo/x.jpg"] })).status).toBe(400);
    expect((await chamar("701", { mensagem: "" })).status).toBe(400);
  });
});
