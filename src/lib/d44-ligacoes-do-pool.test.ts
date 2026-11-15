/**
 * d44 (15-11-2026) — «Too many connections» na base.
 *
 * `withConnection` passou a pedir a ligação ao pool e a devolvê-la sempre;
 * ninguém abre ligações à parte; quem pede uma ligação ao pool devolve-a num
 * `finally`; o detalhe das comissões lê uma coisa de cada vez.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ligacao = {
  execute: vi.fn(async () => [[], []]),
  release: vi.fn(),
  destroy: vi.fn(),
};
const pool = { getConnection: vi.fn(async () => ligacao) };
const createConnection = vi.fn();

vi.mock("mysql2/promise", () => ({
  default: { createPool: vi.fn(() => pool), createConnection },
}));

const RAIZ = path.resolve(__dirname, "..");

function ficheiros(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheiros(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** O código sem comentários (regra ancorada ao início da linha). */
function semComentarios(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

describe("withConnection usa o pool", () => {
  // O db.ts é grande: importá-lo uma vez, com tempo, para não chumbar por carga.
  beforeAll(async () => {
    process.env.DATABASE_URL = "mysql://u:p@localhost:3306/x";
    await import("@/lib/db");
  }, 60_000);
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://u:p@localhost:3306/x";
    vi.clearAllMocks();
  });

  it("pede ao pool e devolve a ligação quando corre bem", async () => {
    const { withConnection } = await import("@/lib/db");
    const r = await withConnection(async (conn) => {
      await conn.execute("SELECT 1");
      return 42;
    });
    expect(r).toBe(42);
    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(ligacao.release).toHaveBeenCalledTimes(1);
    expect(ligacao.destroy).not.toHaveBeenCalled();
    expect(createConnection).not.toHaveBeenCalled();
  });

  it("deita fora a ligação quando dá erro, e o erro chega a quem chamou", async () => {
    const { withConnection } = await import("@/lib/db");
    await expect(
      withConnection(async () => {
        throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");
    expect(ligacao.destroy).toHaveBeenCalledTimes(1);
    expect(ligacao.release).not.toHaveBeenCalled();
  });

  it("muitas chamadas seguidas não deixam nenhuma ligação por devolver", async () => {
    const { withConnection } = await import("@/lib/db");
    for (let i = 0; i < 20; i++) {
      await withConnection(async (c) => c.execute("SELECT 1")).catch(() => undefined);
    }
    expect(pool.getConnection).toHaveBeenCalledTimes(20);
    expect(ligacao.release.mock.calls.length + ligacao.destroy.mock.calls.length).toBe(20);
  });
});

describe("ninguém abre ligações à parte nem fica sem devolver", () => {
  const todos = ficheiros(RAIZ).map((f) => ({
    f: path.relative(RAIZ, f),
    s: semComentarios(fs.readFileSync(f, "utf8")),
  }));

  it("não há mysql.createConnection nem um segundo pool no código do site", () => {
    const comLigacaoAvulsa = todos.filter(({ s }) => /\bcreateConnection\s*\(/.test(s)).map(({ f }) => f);
    expect(comLigacaoAvulsa).toEqual([]);
    const comPool = todos.filter(({ s }) => /\bcreatePool\s*\(/.test(s)).map(({ f }) => f.replace(/\\/g, "/"));
    expect(comPool).toEqual(["lib/db.ts"]);
  });

  it("cada getConnection() tem o seu release() num finally", () => {
    const emFalta: string[] = [];
    for (const { f, s } of todos) {
      const pedidos = (s.match(/\.getConnection\(\)/g) ?? []).length;
      if (pedidos === 0) continue;
      const devolvidos = (s.match(/\.release\(\)/g) ?? []).length;
      if (devolvidos < pedidos || !/\bfinally\b/.test(s)) emFalta.push(`${f}: ${pedidos} pedidas, ${devolvidos} devolvidas`);
    }
    expect(emFalta).toEqual([]);
  });

  it("o detalhe das comissões lê uma coisa de cada vez", () => {
    const s = todos.find(({ f }) => f.replace(/\\/g, "/") === "lib/assistentes.ts")!.s;
    for (const nome of ["comissoesDe", "listarAssistentes", "resumoDoAssistente"]) {
      const i = s.indexOf(`function ${nome}(`);
      expect(i, nome).toBeGreaterThan(-1);
      const corpo = s.slice(i, s.indexOf("\n}\n", i));
      expect(corpo, nome).not.toMatch(/Promise\.all/);
    }
  });
});
