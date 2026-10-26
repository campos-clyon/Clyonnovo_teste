import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

/**
 * A ÁREA DO CLIENTE MOSTRA SÓ O QUE É PARA O CLIENTE — 26-10-2026 (d33).
 *
 * A API da conta já escondia as negociações de um Trabalho CLYON; a primeira
 * carga da conta (`conta-server.ts`) entregava-as — e o valor delas é o que o
 * profissional recebe. As duas mandavam ainda, no JSON, os profissionais que
 * não fizeram proposta e a taxa do profissional: o ecrã escondia-os, o browser
 * recebia-os.
 *
 * Estes testes correm as duas respostas do servidor de verdade, contra uma
 * base de mentira que devolve TUDO (como um `SELECT n.*` devolveria), e olham
 * para o que sai.
 */

const ORDENS = [
  // Um Trabalho CLYON: o valor da negociação é o que o profissional recebe.
  { id: 501, status: "agendado", serviceType: "recolha", historyJson: null, trabalhoClyon: 1, createdAt: "2026-10-20T10:00:00Z" },
  // Um pedido do site, com três profissionais a quem o pedido foi parar.
  { id: 502, status: "novo", serviceType: "recolha", historyJson: null, trabalhoClyon: 0, createdAt: "2026-10-21T10:00:00Z" },
];

const proposta = (por: "cliente" | "profissional", valor: number) =>
  JSON.stringify([{ por, valor, criadaEm: "2026-10-21T11:00:00Z", estado: "pendente" }]);

const NEGOCIACOES = [
  {
    id: 9001, pedidoId: 501, estado: "acordada", valorAcordado: "187.00",
    propostasJson: proposta("cliente", 187), taxaCliente: "0", taxaProfissional: "0.1500",
    ofertaClyon: "directa", profissionalNome: "Pro do Trabalho CLYON", profissionalTelefone: "912345678",
  },
  {
    id: 9002, pedidoId: 502, estado: "aberta", valorAcordado: null,
    propostasJson: proposta("profissional", 150), taxaCliente: "0", taxaProfissional: "0.1100",
    ofertaClyon: null, profissionalNome: "Pro que propôs", profissionalTelefone: "912345678",
  },
  {
    id: 9003, pedidoId: 502, estado: "aberta", valorAcordado: null,
    propostasJson: "[]", taxaCliente: "0", taxaProfissional: "0.1100",
    ofertaClyon: null, profissionalNome: "Pro calado", profissionalTelefone: "912345678",
  },
  {
    // Uma oferta da CLYON que ficou num pedido que depois mudou de tipo.
    id: 9004, pedidoId: 502, estado: "aguarda_contratacao", valorAcordado: "120.00",
    propostasJson: proposta("cliente", 120), taxaCliente: "0", taxaProfissional: "0.2000",
    ofertaClyon: "distribuida", profissionalNome: "Pro da oferta antiga", profissionalTelefone: "912345678",
  },
];

const consultas: string[] = [];

function baseFalsa() {
  return {
    execute: vi.fn(async (sql: string) => {
      consultas.push(sql);
      if (sql.includes("AS totalOrders")) return [[{ totalOrders: 2, activeOrders: 2, lastOrderDate: null }], []];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: ORDENS.length }], []];
      if (sql.includes("FROM negociacoes n")) return [NEGOCIACOES.map((n) => ({ ...n })), []];
      if (sql.includes("FROM simulatorOrders o")) return [ORDENS.map((o) => ({ ...o })), []];
      if (sql.includes("FROM users")) return [[{ id: 1, email: "cliente@exemplo.pt" }], []];
      return [[], []];
    }),
  };
}

vi.mock("@/lib/db", () => ({
  getPool: vi.fn(),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureUsersSchema: vi.fn(async () => {}),
  withConnection: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/auth", () => ({ authOptions: {} }));

import * as db from "@/lib/db";
import { getServerSession } from "next-auth";
import { loadContaData } from "@/lib/conta-server";
import { GET as pedidosDaConta } from "@/app/api/users/me/orders/route";
import { negociacoesParaOCliente } from "@/lib/negociacoes-para-o-cliente";

type Saida = { id: number; negociacoes: Array<Record<string, unknown>> };

beforeEach(() => {
  consultas.length = 0;
  const base = baseFalsa();
  vi.mocked(db.getPool).mockResolvedValue(base as never);
  vi.mocked(db.withConnection).mockImplementation((async (fn: (c: unknown) => unknown) => fn(base)) as never);
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: "cliente@exemplo.pt" } } as never);
});

async function pelaPrimeiraCarga(): Promise<Saida[]> {
  const r = await loadContaData("cliente@exemplo.pt", "Cliente");
  return r.orders as unknown as Saida[];
}

async function pelaApi(): Promise<Saida[]> {
  const res = await pedidosDaConta(new NextRequest("https://clyon.pt/api/users/me/orders"));
  expect(res.status).toBe(200);
  const corpo = (await res.json()) as { orders: Saida[] };
  return corpo.orders;
}

const PORTAS: Array<[string, () => Promise<Saida[]>]> = [
  ["a primeira carga da conta (conta-server)", pelaPrimeiraCarga],
  ["a API da conta (/api/users/me/orders)", pelaApi],
];

describe.each(PORTAS)("%s", (_nome, ler) => {
  it("um Trabalho CLYON sai sem negociações — nem o valor do profissional", async () => {
    const pedidos = await ler();
    const clyon = pedidos.find((p) => p.id === 501)!;
    expect(clyon.negociacoes).toEqual([]);
    const json = JSON.stringify(clyon);
    expect(json).not.toContain("187");
    expect(json).not.toContain("Pro do Trabalho CLYON");
  });

  it("não sai a taxa do profissional, nem a marca da oferta", async () => {
    const pedidos = await ler();
    for (const p of pedidos) {
      for (const n of p.negociacoes) {
        expect(n).not.toHaveProperty("taxaProfissional");
        expect(n).not.toHaveProperty("ofertaClyon");
      }
    }
    // E nem se pede à base.
    const daBase = consultas.find((s) => s.includes("FROM negociacoes n"))!;
    expect(daBase).toBeDefined();
    expect(daBase).not.toContain("n.taxaProfissional");
  });

  it("só sai quem fez proposta — o profissional calado não vai no JSON", async () => {
    const pedidos = await ler();
    const doSite = pedidos.find((p) => p.id === 502)!;
    expect(doSite.negociacoes.map((n) => n.id)).toEqual([9002]);
    expect(JSON.stringify(pedidos)).not.toContain("Pro calado");
  });

  it("uma oferta da CLYON que ficou no pedido também não sai", async () => {
    const pedidos = await ler();
    expect(JSON.stringify(pedidos)).not.toContain("Pro da oferta antiga");
  });

  it("e o telefone do profissional só depois de contratado", async () => {
    const pedidos = await ler();
    const n = pedidos.find((p) => p.id === 502)!.negociacoes[0];
    expect(n.profissionalTelefone).toBeNull();
  });
});

describe("a regra, sozinha", () => {
  it("aceita a marca da base (1/0) e a do pedido inteiro (booleano)", () => {
    const linhas = [{ estado: "acordada", propostasJson: "[]", profissionalTelefone: "912345678" }];
    expect(negociacoesParaOCliente(linhas, 1)).toEqual([]);
    expect(negociacoesParaOCliente(linhas, "1")).toEqual([]);
    expect(negociacoesParaOCliente(linhas, true)).toEqual([]);
    expect(negociacoesParaOCliente(linhas, 0)).toHaveLength(1);
    expect(negociacoesParaOCliente(linhas, false)).toHaveLength(1);
    expect(negociacoesParaOCliente(linhas, null)).toHaveLength(1);
  });

  it("um acordo mostra o telefone; sem linhas, uma lista vazia", () => {
    const [n] = negociacoesParaOCliente(
      [{ estado: "acordada", propostasJson: "[]", profissionalTelefone: "912345678", taxaProfissional: "0.11" }],
      0,
    );
    expect(n.profissionalTelefone).toBe("912345678");
    expect(n).not.toHaveProperty("taxaProfissional");
    expect(negociacoesParaOCliente(undefined, 0)).toEqual([]);
  });
});

describe("o link do email passa pela mesma regra", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const LINK = ler("src/app/pedido/[token]/VistaDoPedido.tsx").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

  it("com a marca de Trabalho CLYON do pedido", () => {
    expect(LINK).toMatch(/negociacoesParaOCliente\(\s*await negociacoesDoPedido\(pedido\.id\),\s*pedido\.valorFixoClyon != null,?\s*\)/);
  });

  it("e sem mandar a taxa do profissional ao browser", () => {
    expect(LINK).not.toContain("taxaProfissional");
  });
});
