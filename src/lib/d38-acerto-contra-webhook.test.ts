import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d38 v2 — O WEBHOOK FECHA SOZINHO O ACERTO DA FOLHA FINAL. Uma base de mentira
 * que regista as instruções (como `pagamentos-na-base-sql.test.ts`): a
 * referência do acerto é parte «divida», e ao dar-se por paga leva o `trid` da
 * linha à parte certa — `acerto-folha-N` num trabalho pago pela plataforma,
 * `abatimento-mao-N` num pago em mão —, sem tocar em `negociacaoPaga`.
 */

type Chamada = { sql: string; args: unknown[] };
const base = { chamadas: [] as Chamada[], metodoQueFechou: null as string | null };

vi.mock("./db", () => {
  const exec = async (sql: string, args: unknown[] = []) => {
    base.chamadas.push({ sql, args });
    if (/SELECT metodo FROM pagamentos WHERE negociacaoPaga = \?/.test(sql)) {
      return [base.metodoQueFechou ? [{ metodo: base.metodoQueFechou }] : [], []];
    }
    if (/SELECT parte FROM pagamentos WHERE id = \?/.test(sql)) return [[{ parte: "divida" }], []];
    return [/^\s*SELECT/.test(sql) ? [] : { affectedRows: 1, insertId: 1 }, []];
  };
  const pool = {
    execute: exec,
    getConnection: async () => ({
      execute: exec,
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
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
  base.metodoQueFechou = null;
});

const oUpdate = () => base.chamadas.find((c) => /SET estado = 'pago'/.test(c.sql));

describe("darPorPago numa referência da parte «divida»", () => {
  it("trabalho pago pela plataforma: fecha o acerto da folha final", async () => {
    base.metodoQueFechou = "multibanco";
    const r = await lib.darPorPago(11, 900, { trid: "EUPAGO-9", valorPago: 34.2, comissao: null, quando: null });
    expect(r).toEqual({ feito: true });
    const u = oUpdate();
    expect(u?.sql).toMatch(/trid = IF\(parte = 'divida', \?, \?\)/);
    expect(u?.sql).toMatch(/negociacaoPaga = IF\(parte IN \('diferenca', 'divida'\), NULL, \?\)/);
    expect(u?.args).toContain("acerto-folha-900");
    expect(u?.args).not.toContain("abatimento-mao-900");
  });

  it("pago em mão: continua a fechar a dívida do pago em mão", async () => {
    base.metodoQueFechou = "ao_profissional";
    await lib.darPorPago(12, 900, { trid: "EUPAGO-10", valorPago: 7.7, comissao: null, quando: null });
    expect(oUpdate()?.args).toContain("abatimento-mao-900");
  });

  it("registado à mão (marcar a parte, abater no saldo): o trid que a dívida trouxer", async () => {
    await lib.registarRecebimentoAMao({
      negociacaoId: 900,
      pedidoId: 524,
      providerId: 3,
      metodo: "abatimento",
      valor: 34.2,
      quando: new Date("2026-11-15T12:00:00Z"),
      ambiente: "sandbox" as never,
      aParte: true,
      tridAParte: "acerto-folha-900",
    });
    const ins = base.chamadas.find((c) => /INSERT INTO pagamentos/.test(c.sql));
    expect(ins?.args).toContain("acerto-folha-900");
    expect(ins?.args[6]).toBeNull(); // negociacaoPaga
  });
});
