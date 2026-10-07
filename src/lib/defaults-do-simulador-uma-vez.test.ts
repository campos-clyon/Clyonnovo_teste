import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { defaultSimulatorSettings, defaultsPorGravar } from "./simulator-settings";

/**
 * OS PREÇOS LIAM-SE COM VINTE E OITO GRAVAÇÕES À FRENTE — 07-10-2026.
 *
 * `ensureSimulatorSettingsTable` corria o upsert de todos os valores por
 * omissão a cada chamada, um de cada vez. Quem a chama é cada leitura dos
 * preços — a lista dos trabalhos do profissional, a cada abertura do painel —
 * e cada gravação é uma ida e volta inteira do Vercel ao Railway.
 *
 * Aqui conta-se o que vai à base, com o pool e o drizzle a fingir: na segunda
 * chamada não pode ir nada, e na primeira só vai o que falta.
 */

const base = vi.hoisted(() => ({
  linhas: [] as Array<Record<string, unknown>>,
  consultas: [] as string[],
  gravadas: [] as string[],
  falharGravacao: false,
}));

vi.mock("mysql2/promise", () => {
  const pool = {
    query: vi.fn(async (sql: string) => {
      base.consultas.push(sql);
      if (/SELECT\s+`key`/i.test(sql)) return [base.linhas, []];
      return [{}, []];
    }),
    execute: vi.fn(async () => [[], []]),
  };
  return { default: { createPool: vi.fn(() => pool), createConnection: vi.fn() } };
});

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    insert: () => ({
      values: (v: { key: string }) => ({
        onDuplicateKeyUpdate: async () => {
          if (base.falharGravacao) throw new Error("a base caiu");
          base.gravadas.push(v.key);
        },
      }),
    }),
    select: () => ({ from: async () => [] }),
  })),
}));

const comoNoCodigo = () =>
  defaultSimulatorSettings.map((d) => ({
    key: d.key,
    label: d.label,
    category: d.category,
    unit: d.unit,
    description: d.description,
  }));

/*
 * UM IMPORT SÓ, e a guarda reposta entre testes. Reimportar o db.ts em cada
 * teste passa dos cinco segundos com a suite inteira a correr, e um teste
 * interrompido continuava a gravar por cima do seguinte.
 */
let db: typeof import("./db");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
}, 120_000);


beforeEach(() => {
  db.resetSimulatorTableEnsuredFlag();
  base.linhas = comoNoCodigo();
  base.consultas = [];
  base.gravadas = [];
  base.falharGravacao = false;
});

describe("ensureSimulatorSettingsTable", () => {
  it("com a base igual ao código não grava nada, e à segunda chamada nem pergunta", async () => {

    await db.ensureSimulatorSettingsTable();
    expect(base.gravadas).toEqual([]);
    const primeira = base.consultas.length;
    expect(primeira).toBe(2); // CREATE TABLE IF NOT EXISTS + a leitura

    await db.ensureSimulatorSettingsTable();
    await db.getSimulatorSettings();
    await db.taxasActuais();
    expect(base.consultas.length).toBe(primeira);
    expect(base.gravadas).toEqual([]);
  });

  it("grava só a linha que falta e a que mudou de rótulo", async () => {
    const [primeira, segunda, ...resto] = comoNoCodigo();
    base.linhas = [{ ...segunda, label: "rótulo antigo" }, ...resto];
    void primeira;

    await db.ensureSimulatorSettingsTable();

    expect(base.gravadas.sort()).toEqual(
      [defaultSimulatorSettings[0].key, defaultSimulatorSettings[1].key].sort(),
    );
  });

  it("numa base vazia grava os vinte e tal — uma vez", async () => {
    base.linhas = [];

    await db.ensureSimulatorSettingsTable();
    await db.ensureSimulatorSettingsTable();

    expect(base.gravadas).toHaveLength(defaultSimulatorSettings.length);
  });

  it("se uma gravação falhar, a chamada seguinte tenta de novo", async () => {
    base.linhas = [];
    base.falharGravacao = true;

    await expect(db.ensureSimulatorSettingsTable()).rejects.toThrow("a base caiu");

    base.falharGravacao = false;
    await db.ensureSimulatorSettingsTable();
    expect(base.gravadas).toHaveLength(defaultSimulatorSettings.length);
  });

  it("o re-seed do backoffice volta a verificar", async () => {
    await db.ensureSimulatorSettingsTable();
    const antes = base.consultas.length;

    db.resetSimulatorTableEnsuredFlag();
    base.linhas = comoNoCodigo().slice(1);
    await db.ensureSimulatorSettingsTable();

    expect(base.consultas.length).toBe(antes + 2);
    expect(base.gravadas).toEqual([defaultSimulatorSettings[0].key]);
  });
});

describe("defaultsPorGravar", () => {
  it("o valor editado no backoffice não conta como diferença", () => {
    const linhas = comoNoCodigo().map((l) => ({ ...l, value: "999.00" }));
    expect(defaultsPorGravar(linhas)).toEqual([]);
  });

  it("uma descrição nula na base é diferente da do código", () => {
    const linhas = comoNoCodigo();
    linhas[3] = { ...linhas[3], description: null as unknown as string };
    expect(defaultsPorGravar(linhas).map((d) => d.key)).toEqual([defaultSimulatorSettings[3].key]);
  });

  it("chaves que o código já não tem não pedem nada", () => {
    const linhas = [...comoNoCodigo(), { key: "chave_antiga", label: "x", category: "geral", unit: "eur", description: null }];
    expect(defaultsPorGravar(linhas)).toEqual([]);
  });
});
