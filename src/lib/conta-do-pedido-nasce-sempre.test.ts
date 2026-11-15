import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A CONTA DO CLIENTE NASCE SEMPRE — d34, 15-11-2026.
 *
 * Em produção `users.lastSignedIn` é NOT NULL (a tabela veio da app antiga), e
 * «Guardar os meus dados» inseria-a a NULL: o INSERT falhava, o erro ficava no
 * registo, e a conta não nascia. Agora nasce com a hora do momento — o mesmo
 * NOW() do `createdAt` —, e a estrela «de email verificado» só conta uma conta
 * do pedido depois de alguém entrar nela.
 */

const execucoes: Array<{ sql: string; args: unknown[] }> = [];
vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => null),
  withConnection: vi.fn(async (f: (c: unknown) => Promise<unknown>) =>
    f({
      execute: async (sql: string, args: unknown[] = []) => {
        execucoes.push({ sql, args });
        return [{ affectedRows: 1 }, []];
      },
    }),
  ),
}));

import { CONTA_DO_PEDIDO, guardarDadosDoCliente } from "./conta-server";
import { SQL_CONTACTO_VERIFICADO_E_DIFERENTE } from "./avaliacao-que-conta";

beforeEach(() => {
  execucoes.length = 0;
});

/** Os valores do INSERT, coluna a coluna (os `?` pelos argumentos, o resto tal como está). */
function valoresDoInsert(sql: string, args: unknown[]): Record<string, string> {
  const colunas = sql.match(/INSERT INTO users \(([^)]*)\)/)![1].split(",").map((c) => c.trim());
  // Uma linha só: «VALUES (?, ?, …, NOW(), NOW())» — nenhum valor tem vírgulas.
  const valores = sql.match(/VALUES \((.*)\)[ \t]*\r?\n/)![1].split(",").map((v) => v.trim());
  let i = 0;
  return Object.fromEntries(colunas.map((c, n) => [c, valores[n] === "?" ? String(args[i++]) : valores[n]]));
}

describe("guardarDadosDoCliente", () => {
  it("grava a conta com lastSignedIn à hora do momento, igual ao createdAt — nunca NULL", async () => {
    const ok = await guardarDadosDoCliente({ email: " Ana@Exemplo.PT ", nome: "Ana", telefone: "912345678", cidade: "Almada" });
    expect(ok).toBe(true);
    expect(execucoes).toHaveLength(1);
    const v = valoresDoInsert(execucoes[0].sql, execucoes[0].args);
    expect(v.email).toBe("ana@exemplo.pt");
    expect(v.loginMethod).toBe(`'${CONTA_DO_PEDIDO}'`);
    expect(v.lastSignedIn).toBe("NOW()");
    expect(v.createdAt).toBe("NOW()");
    // Nenhuma coluna da linha nova vai a NULL além do openId (que é NULL de propósito).
    expect(Object.entries(v).filter(([, x]) => x === "NULL").map(([c]) => c)).toEqual(["openId"]);
  });

  it("numa conta que já existe não mexe na última entrada", async () => {
    await guardarDadosDoCliente({ email: "ana@exemplo.pt", nome: null, telefone: null, cidade: null });
    const update = execucoes[0].sql.split("ON DUPLICATE KEY UPDATE")[1];
    expect(update).not.toContain("lastSignedIn");
  });
});

describe("a estrela de email verificado não conta a conta que só nasceu do pedido", () => {
  it("pede um método que não seja «pedido», ou uma entrada depois do nascimento", () => {
    const sql = SQL_CONTACTO_VERIFICADO_E_DIFERENTE("o", "p");
    expect(sql).toContain("uv.lastSignedIn IS NOT NULL");
    expect(sql).toContain(`COALESCE(uv.loginMethod, '') <> '${CONTA_DO_PEDIDO}' OR uv.lastSignedIn > uv.createdAt`);
  });
});
