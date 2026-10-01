import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A BASE LIDA EM UTC, E AS MARCAÇÕES ANTIGAS CONVERTIDAS — 01-10-2026.
 *
 * *«Deve estar sempre no horário de Lisboa… tudo deve ser num único
 * horário.»* Cópia de segurança completa feita pelo dono antes.
 *
 * A conversão corre uma vez, em produção, sobre dados verdadeiros — e por
 * isso prova-se aqui o comportamento, contra uma base falsa que regista cada
 * instrução: o que converte, que só converte uma vez, que guarda o antes, e
 * que não mexe no `updatedAt`.
 */

type Linha = { id: number; valor: string };
const estado = {
  marca: false,
  /** O segundo servidor que leu «não está feita» antes de o primeiro acabar. */
  leituraAtrasada: false,
  sqlDaLigacao: [] as Array<{ sql: string; params: unknown[] }>,
  linhas: {} as Record<string, Linha[]>,
  commits: 0,
  rollbacks: 0,
};

function ligacaoFalsa() {
  return {
    beginTransaction: async () => {},
    commit: async () => {
      estado.commits++;
    },
    rollback: async () => {
      estado.rollbacks++;
    },
    release: () => {},
    execute: async (sql: string, params: unknown[] = []) => {
      estado.sqlDaLigacao.push({ sql, params });
      if (sql.startsWith("INSERT INTO migracoesFeitas")) {
        if (estado.marca) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
        estado.marca = true;
        return [{}, null];
      }
      const m = /FROM (\w+)\s/.exec(sql);
      if (sql.includes("DATE_FORMAT") && m) return [estado.linhas[m[1]] ?? [], null];
      return [{}, null];
    },
  };
}

vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string) => {
      if (sql.includes("SELECT 1 FROM migracoesFeitas")) {
        return [estado.marca && !estado.leituraAtrasada ? [{ 1: 1 }] : [], null];
      }
      return [{}, null];
    },
    getConnection: async () => ligacaoFalsa(),
  }),
}));

const { converterMarcacoesParaUtc, deLisboaParaUtc, COLUNAS_EM_HORA_DE_LISBOA } = await import(
  "./fuso-da-base"
);

beforeEach(() => {
  estado.marca = false;
  estado.leituraAtrasada = false;
  estado.sqlDaLigacao = [];
  estado.commits = 0;
  estado.rollbacks = 0;
  estado.linhas = {
    negociacoes: [
      { id: 1, valor: "2026-09-28 15:00:00" }, // Verão: passa a 14:00
      { id: 2, valor: "2026-12-10 15:00:00" }, // Inverno: fica igual, e não se toca
    ],
    simulatorOrders: [
      { id: 7, valor: "2026-10-02 09:30:00" },
      { id: 8, valor: "0000-00-00 00:00:00" }, // lixo antigo: não se escreve por cima
    ],
  };
});

describe("a conta: hora de Lisboa → UTC", () => {
  it("no Verão, uma hora a menos; no Inverno, igual", () => {
    expect(deLisboaParaUtc("2026-09-28 15:00:00")).toBe("2026-09-28 14:00:00");
    expect(deLisboaParaUtc("2026-12-10 15:00:00")).toBe("2026-12-10 15:00:00");
  });

  it("nos dois domingos em que a hora muda", () => {
    expect(deLisboaParaUtc("2026-03-29 03:00:00")).toBe("2026-03-29 02:00:00");
    expect(deLisboaParaUtc("2026-10-25 03:00:00")).toBe("2026-10-25 03:00:00");
  });

  it("o que não é data a sério não se converte", () => {
    expect(deLisboaParaUtc("0000-00-00 00:00:00")).toBeNull();
    expect(deLisboaParaUtc("ontem")).toBeNull();
    expect(deLisboaParaUtc("2026-09-28T15:00:00Z")).toBeNull();
  });

  it("são as duas marcações, e só elas", () => {
    expect(COLUNAS_EM_HORA_DE_LISBOA).toEqual([
      { tabela: "negociacoes", coluna: "dataCombinada" },
      { tabela: "simulatorOrders", coluna: "dataAgendada" },
    ]);
  });
});

describe("a conversão, contra uma base falsa", () => {
  it("converte o que é de Verão, guarda o antes, e fecha a transacção", async () => {
    const r = await converterMarcacoesParaUtc();
    expect(r).toEqual({
      estado: "feita",
      alteradas: { "negociacoes.dataCombinada": 1, "simulatorOrders.dataAgendada": 1 },
    });
    expect(estado.commits).toBe(1);

    const copias = estado.sqlDaLigacao.filter((s) => s.sql.startsWith("INSERT INTO copiaAntesDoFuso"));
    expect(copias.map((c) => c.params)).toEqual([
      ["negociacoes", 1, "dataCombinada", "2026-09-28 15:00:00", "2026-09-28 14:00:00"],
      ["simulatorOrders", 7, "dataAgendada", "2026-10-02 09:30:00", "2026-10-02 08:30:00"],
    ]);

    const updates = estado.sqlDaLigacao.filter((s) => /^\s*UPDATE (negociacoes|simulatorOrders)/.test(s.sql));
    expect(updates).toHaveLength(2);
    expect(updates[0].params).toEqual([1, "2026-09-28 14:00:00", 1]);
    expect(updates[1].params).toEqual([7, "2026-10-02 08:30:00", 7]);
  });

  it("não mexe no updatedAt — a purga e as novidades contam a partir dele", async () => {
    await converterMarcacoesParaUtc();
    const updates = estado.sqlDaLigacao.filter((s) => /^\s*UPDATE (negociacoes|simulatorOrders)/.test(s.sql));
    for (const u of updates) expect(u.sql).toContain("updatedAt = updatedAt");
  });

  it("a marca entra antes de qualquer alteração, na mesma transacção", async () => {
    await converterMarcacoesParaUtc();
    const primeira = estado.sqlDaLigacao[0].sql;
    expect(primeira).toContain("INSERT INTO migracoesFeitas");
  });

  it("uma segunda vez não faz nada — converter duas vezes atrasava duas horas", async () => {
    await converterMarcacoesParaUtc();
    estado.sqlDaLigacao = [];
    expect(await converterMarcacoesParaUtc()).toEqual({ estado: "ja_estava" });
    expect(estado.sqlDaLigacao).toEqual([]);
  });

  it("dois servidores ao mesmo tempo: o segundo bate na marca e desiste sem tocar em nada", async () => {
    /*
     * Os dois leram «não está feita» antes de o primeiro escrever a marca. O
     * segundo só chega à transacção depois — e aí a chave já lá está.
     */
    estado.marca = true; // o primeiro acabou entretanto…
    estado.leituraAtrasada = true; // …mas o segundo leu antes disso
    const r = await converterMarcacoesParaUtc();
    expect(r).toEqual({ estado: "ja_estava" });
    expect(estado.rollbacks).toBe(1);
    expect(estado.commits).toBe(0);
    expect(estado.sqlDaLigacao.some((s) => /^\s*UPDATE (negociacoes|simulatorOrders)/.test(s.sql))).toBe(
      false,
    );
  });
});

describe("e o resto do caminho", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("as duas formas de ligar à base lêem em UTC", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain('export const FUSO_DA_BASE = "Z";');
    expect(DB.match(/timezone: FUSO_DA_BASE,/g)).toHaveLength(2);
  });

  it("a conversão corre no arranque, antes de o servidor responder, e não o deita abaixo", () => {
    const INST = ler("src/instrumentation.ts");
    const esquema = INST.indexOf("await ensureProvidersSchema();");
    const conversao = INST.indexOf("await converterMarcacoesParaUtc();");
    expect(esquema).toBeGreaterThan(-1);
    expect(conversao).toBeGreaterThan(esquema);
    expect(INST.slice(conversao - 200, conversao)).toContain("try {");
  });

  it("e nunca durante o build, quando quem responde ainda é o site antigo", () => {
    const INST = ler("src/instrumentation.ts");
    const guarda = INST.indexOf('if (process.env.NEXT_PHASE !== "phase-production-build") {');
    expect(guarda).toBeGreaterThan(-1);
    expect(INST.indexOf("await converterMarcacoesParaUtc();")).toBeGreaterThan(guarda);
  });

  it("as rotas que recebem a data do campo convertem-na de Lisboa antes de gravar", () => {
    for (const rota of ["src/app/api/admin/pedidos/[id]/route.ts", "src/app/api/admin/pedidos/route.ts"]) {
      expect(ler(rota), rota).toContain("instanteEmLisboa(");
    }
  });
});
