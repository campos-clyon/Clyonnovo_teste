import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O QUE `pagamentos-na-base.ts` MANDA AO MySQL — com uma base de mentira que
 * só regista as instruções. 27-10-2026 (d16).
 *
 * Não substitui um MySQL a sério (os índices únicos só a base os garante);
 * guarda a forma das escritas que fecham R1, R3, R4 e R8.
 */

type Chamada = { sql: string; args: unknown[]; onde: "pool" | "conn" };

const base = {
  chamadas: [] as Chamada[],
  respostas: [] as Array<(sql: string) => unknown | undefined>,
  transaccao: [] as string[],
  rebentarEm: null as RegExp | null,
};

function responder(sql: string): unknown {
  for (const r of base.respostas) {
    const v = r(sql);
    if (v !== undefined) return v;
  }
  return /^\s*SELECT/.test(sql) ? [] : { affectedRows: 1, insertId: 1 };
}

vi.mock("./db", () => {
  const exec = (onde: "pool" | "conn") => async (sql: string, args: unknown[] = []) => {
    base.chamadas.push({ sql, args, onde });
    if (base.rebentarEm && base.rebentarEm.test(sql)) throw new Error("ligação perdida (simulado)");
    return [responder(sql), []];
  };
  const pool = {
    execute: exec("pool"),
    getConnection: async () => ({
      execute: exec("conn"),
      beginTransaction: async () => void base.transaccao.push("begin"),
      commit: async () => void base.transaccao.push("commit"),
      rollback: async () => void base.transaccao.push("rollback"),
      release: () => void base.transaccao.push("release"),
    }),
  };
  return {
    getPool: async () => pool,
    toMySQLDateTime: (d: Date) => d.toISOString().slice(0, 19).replace("T", " "),
  };
});

const lib = await import("./pagamentos-na-base");

beforeEach(() => {
  base.chamadas = [];
  base.respostas = [];
  base.transaccao = [];
  base.rebentarEm = null;
});

const sqlCom = (re: RegExp) => base.chamadas.filter((c) => re.test(c.sql));

describe("R1 — guardar como recebido, marcar aplicado só depois de aplicar, numa transacção", () => {
  it("darPorPago dá por pago e marca o aviso aplicado na MESMA transacção", async () => {
    const r = await lib.darPorPago(7, 70, { trid: "T1", valorPago: 10, comissao: null, quando: null }, {
      trid: "T1",
      estado: "pago",
    });
    expect(r).toEqual({ feito: true });
    expect(base.transaccao).toEqual(["begin", "commit", "release"]);
    const naTransaccao = base.chamadas.filter((c) => c.onde === "conn").map((c) => c.sql);
    expect(naTransaccao.some((s) => /SET estado = 'pago'/.test(s))).toBe(true);
    expect(naTransaccao.some((s) => /UPDATE avisosDoEupago SET aplicado = 1/.test(s))).toBe(true);
  });

  it("se rebentar a meio, desfaz tudo e o aviso continua por aplicar", async () => {
    base.rebentarEm = /avisosDoEupago SET aplicado = 1/;
    await expect(
      lib.darPorPago(7, 70, { trid: "T1", valorPago: 10, comissao: null, quando: null }, { trid: "T1", estado: "pago" }),
    ).rejects.toThrow();
    expect(base.transaccao).toEqual(["begin", "rollback", "release"]);
  });

  it("guardarAviso diz se o aviso repetido ficou a meio", async () => {
    base.respostas.push((s) => (/INSERT IGNORE INTO avisosDoEupago/.test(s) ? { affectedRows: 0 } : undefined));
    base.respostas.push((s) => (/SELECT id, aplicado, nota FROM avisosDoEupago/.test(s) ? [{ id: 3, aplicado: 0, nota: null }] : undefined));
    const g = await lib.guardarAviso(
      { trid: "T1", estado: "pago", pagamentoId: 7, identificador: null, metodo: null, valor: 1, moeda: "EUR", comissao: null, quando: null, entidade: null, referencia: null },
      "{}",
    );
    expect(g).toMatchObject({ novo: false, aplicado: false, nota: null });
    expect(lib.avisoFicouAMeio(g)).toBe(true);
    expect(lib.avisoFicouAMeio({ novo: false, aplicado: true, nota: null })).toBe(false);
    expect(lib.avisoFicouAMeio({ novo: false, aplicado: false, nota: "valor não confere" })).toBe(false);
    expect(lib.avisoFicouAMeio({ novo: true, aplicado: false, nota: null })).toBe(false);
  });

  it("anotarAviso nunca desfaz um aviso já aplicado", async () => {
    await lib.anotarAviso("T1", "pago", { aplicado: false, nota: "já fechado" });
    const [c] = sqlCom(/UPDATE avisosDoEupago SET aplicado = \?/);
    expect(c.sql).toMatch(/AND aplicado = 0/);
  });
});

describe("R3 — a rotina pergunta pelas mais recentes, numa janela de dias", () => {
  it("ordena das mais recentes para as mais antigas, com janela e método", async () => {
    await lib.pendentesParaSondar(30, 30, "mbway", 2);
    const [c] = sqlCom(/FROM pagamentos\s+WHERE estado = 'pendente'/);
    expect(c.sql).toMatch(/ORDER BY criadoEm DESC/);
    expect(c.sql).not.toMatch(/ORDER BY criadoEm ASC/);
    expect(c.sql).toMatch(/criadoEm >= DATE_SUB\(NOW\(\), INTERVAL 2 DAY\)/);
    expect(c.sql).toMatch(/metodo = \?/);
    expect(c.args).toEqual(["mbway"]);
  });
});

describe("R4 — uma referência nova anula as anteriores na base", () => {
  it("marcarPedido passa as outras pendentes do mesmo trabalho a substituido", async () => {
    base.respostas.push((s) => (/SELECT negociacaoId FROM pagamentos/.test(s) ? [{ negociacaoId: 70 }] : undefined));
    await lib.marcarPedido(9, { referencia: "104295830", entidade: "21921", transacaoId: null });
    const [c] = sqlCom(/SET estado = 'substituido'/);
    expect(c.sql).toMatch(/WHERE negociacaoId = \? AND id <> \? AND estado = 'pendente'/);
    expect(c.args).toEqual([70, 9]);
  });
});

describe("R8 — a fila «faturas por emitir»", () => {
  it("só pagamentos pagos, com fatura, do euPago, sem fatura emitida", async () => {
    await lib.faturasPorEmitir();
    const [c] = sqlCom(/faturaEmitidaEm IS NULL/);
    for (const parte of [/estado = 'pago'/, /comFactura = 1/, /deTeste = 0/, /metodo IN \('mbway', 'multibanco'\)/, /pagoEm >= '/]) {
      expect(c.sql).toMatch(parte);
    }
  });

  it("a coluna nova só se acrescenta — nenhum UPDATE em massa", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("src/lib/pagamentos-na-base.ts", "utf8");
    expect(fonte).toContain("ALTER TABLE pagamentos ADD COLUMN faturaEmitidaEm DATETIME NULL DEFAULT NULL");
    await lib.marcarFaturaEmitida(5);
    const [c] = sqlCom(/SET faturaEmitidaEm = NOW\(\)/);
    expect(c.sql).toMatch(/WHERE id = \? AND estado = 'pago' AND comFactura = 1 AND faturaEmitidaEm IS NULL/);
  });
});
