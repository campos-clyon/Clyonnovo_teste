/**
 * Urgência de 16-11-2026 — «Too many connections» depois da d44.
 *
 * O pool não pode guardar ligações paradas: no máximo 3 por instância, só 1
 * parada e fechada ao fim de 10 s, cada ligação com `wait_timeout` de sessão
 * curto (solta as das instâncias congeladas), e um só pool por processo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ouvintes: Record<string, (c: unknown) => void> = {};
const pool = {
  getConnection: vi.fn(),
  on: vi.fn((ev: string, fn: (c: unknown) => void) => {
    ouvintes[ev] = fn;
  }),
};
const createPool = vi.fn((_opcoes: Record<string, unknown>) => pool);

vi.mock("mysql2/promise", () => ({ default: { createPool } }));

describe("o pool da base", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://u:p@localhost:3306/x";
  });

  it("não guarda ligações paradas e cria-se uma só vez", async () => {
    const db = await import("@/lib/db");
    const a = await db.getPool();
    const b = await db.getPool();
    expect(a).toBe(b);
    expect(createPool).toHaveBeenCalledTimes(1);
    const opcoes = createPool.mock.calls[0][0];
    expect(opcoes.connectionLimit).toBe(3);
    expect(opcoes.maxIdle).toBe(1);
    // O vigia das paradas do mysql2 só corre com maxIdle < connectionLimit.
    expect(Number(opcoes.maxIdle)).toBeLessThan(Number(opcoes.connectionLimit));
    expect(Number(opcoes.idleTimeout)).toBeLessThanOrEqual(15_000);
    expect(opcoes.enableKeepAlive).toBe(true);
    expect((globalThis as { __poolDaClyon?: unknown }).__poolDaClyon).toBe(a);
  }, 60_000);

  it("cada ligação nova pede à base que a feche se ficar parada", async () => {
    const db = await import("@/lib/db");
    await db.getPool();
    expect(typeof ouvintes.connection).toBe("function");
    const query = vi.fn();
    ouvintes.connection({ query });
    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/SET SESSION wait_timeout = (\d+)/);
    const s = Number(sql.match(/wait_timeout = (\d+)/)![1]);
    // Mais do que o vigia da instância (10 s), muito menos do que as 8 h por omissão.
    expect(s * 1000).toBeGreaterThan(db.PARADA_FECHA_AO_FIM_DE_MS);
    expect(s).toBeLessThanOrEqual(300);
  });
});
