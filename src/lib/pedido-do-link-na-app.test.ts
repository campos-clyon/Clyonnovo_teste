import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R10 — O LINK DE UM PEDIDO NA APP DE CLIENTE (d8 fase 2, S6, 28-10-2026).
 *
 * Do email da sessão → `seu`; sem email (WhatsApp) → um resumo e, com
 * `juntar`, o email da sessão grava-se uma vez só; de outro email → nada do
 * pedido; expirado → 410. O token nunca roda nem se guarda. Dados de teste.
 */

const pedidos = new Map<string, Record<string, unknown>>();
const historico: Array<{ id: number; message: string }> = [];

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderByAcessoTokenHash: vi.fn(async (hash: string) => pedidos.get(hash)),
  juntarPedidoAConta: vi.fn(async (id: number, email: string) => {
    const p = [...pedidos.values()].find((x) => x.id === id)!;
    if (String(p.contactEmail ?? "").trim()) return false;
    p.contactEmail = email;
    return true;
  }),
  appendOrderHistory: vi.fn(async (id: number, e: { message: string }) => {
    historico.push({ id, message: e.message });
  }),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import * as db from "@/lib/db";
import { limitarPorConta } from "@/lib/limite-rota-publica";
import { POST as pedidoDoLink } from "@/app/api/cliente/pedido-do-link/route";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { hashDeToken } from "@/lib/pedido-acesso";

const EMAIL = "cliente.teste@exemplo.pt";
const OUTRA = "outra.conta@exemplo.pt";
const DO_WHATSAPP = "w".repeat(43);
const MEU = "m".repeat(43);
const DE_OUTRO = "o".repeat(43);
const VELHO = "v".repeat(43);
let sessao = "";
let outraSessao = "";

function chamar(corpo: unknown, bearer = sessao) {
  return new NextRequest("https://clyon.pt/api/cliente/pedido-do-link", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(corpo),
  });
}

function pedido(id: number, token: string, contactEmail: string | null, expira = Date.now() + 86_400_000) {
  pedidos.set(hashDeToken(token), {
    id,
    serviceType: "recolha_moveis",
    city: "Setúbal",
    address: "Rua de Teste 2",
    contactPhone: "912 345 678",
    contactEmail,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    acessoTokenHash: hashDeToken(token),
    acessoTokenExpiraEm: new Date(expira),
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-pedido-do-link";
  const antes = new Date(Date.now() - 3600_000);
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", antes)).token;
  outraSessao = (await assinarSessaoDoCliente(OUTRA, "link", antes)).token;
});

beforeEach(() => {
  pedidos.clear();
  historico.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  pedido(501, DO_WHATSAPP, null);
  pedido(502, MEU, EMAIL);
  pedido(503, DE_OUTRO, OUTRA);
  pedido(504, VELHO, EMAIL, Date.now() - 1000);
});

describe("S6 — R10 POST /api/cliente/pedido-do-link", () => {
  it("sem sessão, 401", async () => {
    expect((await pedidoDoLink(chamar({ token: MEU }, ""))).status).toBe(401);
  });

  it("do email da sessão → seu + id", async () => {
    expect(await (await pedidoDoLink(chamar({ token: MEU }))).json()).toEqual({ ok: true, estado: "seu", id: 502 });
  });

  it("sem email → um resumo de uma linha, e nada mais (nem morada, nem telefone)", async () => {
    const j = await (await pedidoDoLink(chamar({ token: DO_WHATSAPP }))).json();
    expect(j).toEqual({
      ok: true,
      estado: "semEmail",
      id: 501,
      servico: "Recolha de móveis",
      cidade: "Setúbal",
      criadoEmTexto: "26/10/2026",
    });
    expect(db.juntarPedidoAConta).not.toHaveBeenCalled();
  });

  it("juntar grava o email uma vez só; uma segunda conta recebe outroEmail; a Mesa regista", async () => {
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(await r.json()).toEqual({ ok: true, estado: "seu", id: 501, juntado: true });
    expect(historico).toEqual([{ id: 501, message: "Pedido juntado à conta c•••@exemplo.pt pela app de cliente." }]);
    // Outra conta, com o mesmo link, já não vê nada do pedido.
    expect(await (await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }, outraSessao))).json()).toEqual({
      ok: true,
      estado: "outroEmail",
    });
    expect(historico).toHaveLength(1);
  });

  it("se outra conta o juntou entretanto: 409", async () => {
    vi.mocked(db.juntarPedidoAConta).mockResolvedValueOnce(false);
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("Este pedido já está ligado a uma conta.");
  });

  it("de outro email → sem dados do pedido", async () => {
    const texto = await (await pedidoDoLink(chamar({ token: DE_OUTRO, juntar: true }))).text();
    expect(JSON.parse(texto)).toEqual({ ok: true, estado: "outroEmail" });
    expect(texto).not.toContain("503");
    expect(db.juntarPedidoAConta).not.toHaveBeenCalled();
  });

  it("expirado → 410; desconhecido ou mal formado → 404", async () => {
    expect((await pedidoDoLink(chamar({ token: VELHO }))).status).toBe(410);
    expect((await pedidoDoLink(chamar({ token: "x".repeat(43) }))).status).toBe(404);
    expect((await pedidoDoLink(chamar({ token: "não é token" }))).status).toBe(404);
  });

  it("travão por conta; o token nunca roda nem se guarda", async () => {
    await pedidoDoLink(chamar({ token: MEU }));
    expect(limitarPorConta).toHaveBeenCalledWith("cliente-pedido-do-link-conta", EMAIL, 30, 300);
    const R = readFileSync(join(process.cwd(), "src/app/api/cliente/pedido-do-link/route.ts"), "utf8");
    expect(R).not.toMatch(/substituirTokenDoPedido|gerarTokenDeAcesso|acessoTokenHash\s*=/);
    expect(readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8")).toMatch(
      /UPDATE simulatorOrders SET contactEmail = \?\s+WHERE id = \? AND \(contactEmail IS NULL OR TRIM\(contactEmail\) = ''\)/,
    );
  });
});
