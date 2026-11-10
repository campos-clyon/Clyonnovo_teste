import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d24 (10-11-2026) — O EMAIL DE UM CLIENTE SÓ O MUDA O ADMINISTRADOR.
 *
 * Um assistente com a secção Contas corrige o nome, o telefone e o NIF; o
 * email (e levar os pedidos com ele) é do administrador, como nos parceiros.
 * Cada mudança fica no registo permanente, com quem e o antes e o depois, e as
 * sessões da conta caem. Dados de teste.
 */

const quem: { colab: { id: number; nome: string; papel: "admin" | "assistente" } } = {
  colab: { id: 1, nome: "Rui Exemplo", papel: "admin" },
};
const sql: Array<{ q: string; p: unknown[] }> = [];
const registos: Array<Record<string, unknown>> = [];

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: quem.colab })),
  requireAdminGeral: vi.fn(async () => ({ err: null, colab: quem.colab })),
}));
vi.mock("@/lib/conversas-na-base", () => ({ apagarConversasDaConta: vi.fn(async () => {}) }));
vi.mock("@/lib/clientes-dos-pedidos", () => ({ clientesDosPedidos: vi.fn(() => ({})) }));
vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async (l: Record<string, unknown>) => {
    registos.push(l);
  }),
  withConnection: vi.fn(async (fn: (c: unknown) => unknown) =>
    fn({
      execute: vi.fn(async (q: string, p: unknown[] = []) => {
        sql.push({ q, p });
        if (q.startsWith("SELECT email, name, phone, nif FROM users")) {
          return [[{ email: "cliente.antigo@exemplo.pt", name: "Cliente Teste", phone: "912345678", nif: null }], []];
        }
        if (q.startsWith("UPDATE simulatorOrders")) return [{ affectedRows: 2 }, []];
        return [{ affectedRows: 1 }, []];
      }),
    }),
  ),
}));

import { PATCH } from "@/app/api/admin/users/route";

const patch = async (corpo: Record<string, unknown>): Promise<Response> =>
  (await PATCH(
    new NextRequest("https://clyon.pt/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer x" },
      body: JSON.stringify(corpo),
    }),
  ))!;

beforeEach(() => {
  sql.length = 0;
  registos.length = 0;
  quem.colab = { id: 1, nome: "Rui Exemplo", papel: "admin" };
});

describe("um assistente com «Contas»", () => {
  beforeEach(() => {
    quem.colab = { id: 7, nome: "Assistente de Teste", papel: "assistente" };
  });

  it("recebe 403 ao mudar o email de um cliente, e nada se escreve", async () => {
    const r = await patch({ id: 42, email: "outra.pessoa@exemplo.pt", migrarPedidos: true });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe("Só o administrador muda o email de uma conta.");
    expect(sql).toHaveLength(0);
    expect(registos).toHaveLength(0);
  });

  it("recebe 403 também só com «migrarPedidos»", async () => {
    expect((await patch({ id: 42, migrarPedidos: true })).status).toBe(403);
    expect(sql).toHaveLength(0);
  });

  it("continua a corrigir o telefone, e fica registado quem foi", async () => {
    const r = await patch({ id: 42, name: "Cliente Teste", phone: "910000123" });
    expect(r.status).toBe(200);
    const update = sql.find((s) => s.q.startsWith("UPDATE users"))!;
    expect(update.q).not.toContain("email = ?");
    expect(update.q).not.toContain("sessoesClienteDesde");
    expect(registos).toHaveLength(1);
    expect(registos[0]).toMatchObject({ acontecimento: "conta_dados_mudados", autorNome: "Assistente de Teste" });
    // Só o que mudou mesmo: o nome era o mesmo.
    expect((registos[0]!.detalhe as { mudancas: object }).mudancas).toEqual({
      telefone: { antes: "912345678", depois: "910000123" },
    });
  });
});

describe("o administrador", () => {
  it("muda o email, leva os pedidos, corta as sessões e fica registado", async () => {
    const r = await patch({ id: 42, email: "Cliente.Novo@exemplo.pt", migrarPedidos: true });
    expect(r.status).toBe(200);

    const update = sql.find((s) => s.q.startsWith("UPDATE users"))!;
    expect(update.q).toContain("email = ?");
    expect(update.q).toContain("sessoesClienteDesde = ?");
    expect(update.p).toContain("cliente.novo@exemplo.pt");

    const pedidos = sql.find((s) => s.q.startsWith("UPDATE simulatorOrders"))!;
    expect(pedidos.p).toEqual(["cliente.novo@exemplo.pt", "cliente.antigo@exemplo.pt"]);

    expect(registos).toHaveLength(1);
    const linha = registos[0]!;
    expect(linha).toMatchObject({
      acontecimento: "conta_dados_mudados",
      clienteEmail: "cliente.novo@exemplo.pt",
      autorTipo: "clyon",
      autorNome: "Rui Exemplo",
    });
    expect(linha.detalhe).toMatchObject({
      contaId: 42,
      porId: 1,
      mudancas: { email: { antes: "cliente.antigo@exemplo.pt", depois: "cliente.novo@exemplo.pt" } },
      pedidosMovidos: 2,
      sessoesCortadas: true,
    });
  });

  it("o mesmo email não corta nada nem regista nada", async () => {
    expect((await patch({ id: 42, email: "cliente.antigo@exemplo.pt" })).status).toBe(200);
    expect(sql.some((s) => s.q.startsWith("UPDATE users"))).toBe(false);
    expect(registos).toHaveLength(0);
  });
});

describe("as sessões da conta caem", () => {
  it("a app de cliente recusa os tokens de antes do corte, e o site exige a conta com o email da sessão", () => {
    const auth = readFileSync(join(process.cwd(), "src/lib/cliente-auth.ts"), "utf8");
    expect(auth).toContain("emitidoAntesDoCorte(sessao.emitidoEm, conta.sessoesClienteDesde)");
    expect(auth).toContain('"SELECT id FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1"');
  });
});

describe("e nos parceiros", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const ROTA = ler("src/app/api/admin/profissionais/[id]/route.ts");

  it("o email continua só do administrador", () => {
    expect(ROTA).toContain('CAMPOS_SO_DO_ADMINISTRADOR.some((k) => k in corpo) && colab.papel !== "admin"');
  });

  it("um email novo fecha as sessões e fica no registo permanente", () => {
    const i = ROTA.indexOf("const mudanca = await mudarEmailDoProfissional(");
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, i + 1600);
    expect(bloco).toContain("if (mudanca.mudou) {");
    expect(bloco).toContain("await fecharSessoesDoProfissional(providerId);");
    expect(bloco).toContain('acontecimento: "profissional_email_mudado"');
    expect(bloco).toContain("autorNome: colab.nome");
    const DB = ler("src/lib/db.ts");
    const f = DB.slice(DB.indexOf("export async function mudarEmailDoProfissional"));
    expect(f.slice(0, 2500)).toContain("return { mudou: antes !== email.trim().toLowerCase(), antes };");
  });

  it("o painel só deixa o administrador escrever o email", () => {
    const PAINEL = ler("src/components/admin/ContasPanel.tsx");
    expect(PAINEL).toContain("readOnly={!podeMudarEmail}");
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain('podeMudarEmail={papel === "admin"}');
  });
});
