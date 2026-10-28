import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * vistoPeloClienteEm — d8 fase 2, S11 (28-10-2026). Só a medida do E2: a
 * primeira leitura das propostas (app pela R5, site em /pedido/<token> e na
 * conta) grava a data, e as seguintes não a mudam. Não mexe na novidade nem
 * na ordem (a última actividade). Dados de teste.
 */

const EMAIL = "cliente.teste@exemplo.pt";
const vistas = new Map<number, Date>();
const proposta = JSON.stringify([{ por: "profissional", valor: 350, estado: "pendente", criadaEm: "2026-10-27T10:00:00Z" }]);
const negociacao = (o: Record<string, unknown>) => ({
  providerId: 7,
  estado: "aberta",
  valorAcordado: null,
  propostasJson: proposta,
  taxaCliente: "0.05",
  createdAt: new Date("2026-10-20T10:00:00Z"),
  updatedAt: new Date("2026-10-27T10:00:00Z"),
  semFactura: 0,
  ofertaClyon: null,
  profissionalNome: "Profissional Teste",
  profissionalTelefone: "912345678",
  regimeIva: "normal",
  guiaVerificadaEm: null,
  ...o,
});

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderById: vi.fn(async () => ({
    id: 950,
    serviceType: "recolha_moveis",
    status: "pendente",
    contactEmail: EMAIL,
    valorFixoClyon: null,
    createdAt: new Date("2026-10-26T09:00:00Z"),
  })),
  negociacoesDoPedido: vi.fn(async () => [
    negociacao({ id: 41 }),
    // Quem não fez proposta não chega ao cliente — e não se marca.
    negociacao({ id: 42, providerId: 8, propostasJson: "[]" }),
  ]),
  marcarVistoPeloCliente: vi.fn(async (ids: number[]) => {
    for (const id of ids) if (!vistas.has(id)) vistas.set(id, new Date());
  }),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({ perfilPublicoDoProfissional: vi.fn(async () => null) }));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));

import * as db from "@/lib/db";
import { GET as umPedido } from "@/app/api/cliente/pedidos/[id]/route";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";

let sessao = "";
const ler = () =>
  umPedido(new NextRequest("https://clyon.pt/api/cliente/pedidos/950", { headers: { authorization: `Bearer ${sessao}` } }), {
    params: Promise.resolve({ id: "950" }),
  });

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-visto-pelo-cliente";
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000))).token;
});

beforeEach(() => {
  vistas.clear();
  vi.mocked(db.marcarVistoPeloCliente).mockClear();
});

describe("S11 — vistoPeloClienteEm", () => {
  it("a primeira leitura pela app grava a data; as seguintes não a mudam", async () => {
    expect((await ler()).status).toBe(200);
    expect(db.marcarVistoPeloCliente).toHaveBeenCalledWith([41]);
    const primeira = vistas.get(41)!;
    await new Promise((r) => setTimeout(r, 5));
    await ler();
    expect(vistas.get(41)).toBe(primeira);
    expect(vistas.has(42)).toBe(false);
  });

  it("o SQL só escreve uma vez e não mexe na última actividade", () => {
    const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    expect(DB).toContain("ALTER TABLE negociacoes ADD COLUMN vistoPeloClienteEm DATETIME NULL DEFAULT NULL");
    expect(DB).toMatch(/SET vistoPeloClienteEm = NOW\(\), updatedAt = updatedAt\s+WHERE id IN \(\$\{[^}]+\}\) AND vistoPeloClienteEm IS NULL/);
  });

  it("o site também: a página do link (não o «ver como o cliente») e a conta", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain(
      "if (token && !soParaVer) await marcarVistasPeloCliente(negociacoesDoCliente.map((n) => n.id));",
    );
    for (const f of ["src/app/api/users/me/orders/route.ts", "src/lib/conta-server.ts"]) {
      expect(ler(f), f).toContain("await marcarVistasPeloCliente(orders.flatMap((o) => o.negociacoes.map((n) => n.id)));");
    }
  });
});
