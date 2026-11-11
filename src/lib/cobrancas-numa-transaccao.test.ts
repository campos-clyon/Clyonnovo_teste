import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { partesDaDivida, type MarcaDaParte, type OrigemDaMarca } from "./cobrancas-ao-profissional";

/*
 * MARCAR E DESFAZER SÃO NUMA SÓ TRANSACÇÃO — 11-11-2026.
 *
 * As duas escrevem em duas tabelas (as marcas e `pagamentos`). Uma ligação que
 * caia a meio não pode deixar a dívida meio marcada: nem a marca sem a linha
 * do dinheiro, nem a linha cancelada com a marca de pé.
 *
 * A base é fingida e guarda o que uma transacção desfaz: `beginTransaction`
 * tira uma cópia, `rollback` repõe-na. Uma escrita fora da ligação da
 * transacção fica à vista (`escritasFora`). Valores de exemplo.
 */

type Marca = {
  id: number;
  negociacaoId: number;
  providerId: number;
  pedidoId: number | null;
  parte: "iva" | "taxa";
  valor: number;
  pagoEm: string;
  metodo: string;
  origem: OrigemDaMarca;
  pagamentoId: number | null;
  activa: 1 | null;
};
type Pagamento = {
  id: number;
  negociacaoId: number;
  estado: string;
  parte: string;
  valor: number;
  negociacaoPaga: number | null;
  trid: string | null;
};

const NEG = 7;
const PRO = 3;
const PEDIDO = 480;
const DIVIDA = { iva: 23, comissao: 10, total: 33 };

const base = vi.hoisted(() => ({
  marcas: [] as Marca[],
  pagamentos: [] as Pagamento[],
  seq: 100,
  /** A instrução em que a ligação cai. */
  estoira: null as RegExp | null,
  transaccoes: 0,
  commits: 0,
  rollbacks: 0,
  largadas: 0,
  escritasFora: [] as string[],
  presaAntesDeEscrever: true,
}));

const registos = vi.hoisted(() => ({ registar: [] as unknown[], historico: [] as unknown[] }));

vi.mock("./db", () => {
  const ESCRITA = /^\s*(INSERT INTO|UPDATE)\s+(cobrancasAoProfissional|pagamentos)\b/;
  const afectadas = (n: number) => [{ affectedRows: n }, []];

  function instrucao(sql: string, params: unknown[], dentro: { presa: boolean } | null) {
    if (base.estoira?.test(sql)) throw new Error("a ligação caiu a meio");
    if (ESCRITA.test(sql)) {
      if (!dentro) base.escritasFora.push(sql.trim().slice(0, 60));
      else if (!dentro.presa) base.presaAntesDeEscrever = false;
    }

    if (/SELECT id FROM negociacoes WHERE id = \? FOR UPDATE/.test(sql)) {
      if (dentro) dentro.presa = true;
      return [[{ id: Number(params[0]) }], []];
    }
    if (/SELECT providerId, pedidoId FROM negociacoes/.test(sql)) {
      return [Number(params[0]) === NEG ? [{ providerId: PRO, pedidoId: PEDIDO }] : [], []];
    }
    if (/INSERT INTO cobrancasAoProfissional/.test(sql)) {
      const [negociacaoId, providerId, pedidoId, parte, valor, pagoEm, metodo, , , origem, pagamentoId] = params as any[];
      if (base.marcas.some((m) => m.negociacaoId === negociacaoId && m.parte === parte && m.activa === 1)) {
        throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
      }
      const id = ++base.seq;
      base.marcas.push({ id, negociacaoId, providerId, pedidoId, parte, valor, pagoEm, metodo, origem, pagamentoId, activa: 1 });
      return [{ insertId: id }, []];
    }
    if (/INSERT INTO pagamentos/.test(sql)) {
      const [negociacaoId, , , , , valor, negociacaoPaga, , , , trid] = params as any[];
      if (negociacaoPaga != null && base.pagamentos.some((p) => p.negociacaoPaga === negociacaoPaga)) {
        throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
      }
      const id = ++base.seq;
      base.pagamentos.push({ id, negociacaoId, estado: "pago", parte: "trabalho", valor, negociacaoPaga, trid });
      return [{ insertId: id }, []];
    }
    if (/UPDATE cobrancasAoProfissional SET pagamentoId = \? WHERE id = \?/.test(sql)) {
      const m = base.marcas.find((x) => x.id === Number(params[1]));
      if (m) m.pagamentoId = Number(params[0]);
      return afectadas(m ? 1 : 0);
    }
    if (/UPDATE cobrancasAoProfissional SET pagamentoId = NULL WHERE pagamentoId = \?/.test(sql)) {
      const ms = base.marcas.filter((x) => x.pagamentoId === Number(params[0]) && x.activa === 1 && x.id !== Number(params[1]));
      for (const m of ms) m.pagamentoId = null;
      return afectadas(ms.length);
    }
    if (/UPDATE cobrancasAoProfissional\s+SET activa = NULL/.test(sql)) {
      const m = base.marcas.find((x) => x.id === Number(params[3]) && x.activa === 1);
      if (m) m.activa = null;
      return afectadas(m ? 1 : 0);
    }
    if (/UPDATE pagamentos\s+SET estado = 'cancelado'/.test(sql)) {
      const p = base.pagamentos.find((x) => x.id === Number(params[1]) && x.estado === "pago");
      if (p) Object.assign(p, { estado: "cancelado", negociacaoPaga: null, trid: null });
      return afectadas(p ? 1 : 0);
    }
    if (/UPDATE pagamentos SET estado = 'substituido'/.test(sql)) {
      const ps = base.pagamentos.filter((x) => x.negociacaoId === Number(params[0]) && x.estado === "pendente");
      for (const p of ps) p.estado = "substituido";
      return afectadas(ps.length);
    }
    if (/FROM cobrancasAoProfissional\s+WHERE negociacaoId = \? AND parte = \? AND activa = 1/.test(sql)) {
      return [
        base.marcas.filter((m) => m.negociacaoId === Number(params[0]) && m.parte === params[1] && m.activa === 1).map((m) => ({ ...m })),
        [],
      ];
    }
    return [[], []];
  }

  function ligacao() {
    let copia: { marcas: Marca[]; pagamentos: Pagamento[] } | null = null;
    const dentro = { presa: false };
    return {
      beginTransaction: async () => {
        base.transaccoes++;
        copia = structuredClone({ marcas: base.marcas, pagamentos: base.pagamentos });
      },
      commit: async () => {
        base.commits++;
        copia = null;
      },
      rollback: async () => {
        base.rollbacks++;
        if (copia) {
          base.marcas = copia.marcas;
          base.pagamentos = copia.pagamentos;
          copia = null;
        }
      },
      release: () => {
        base.largadas++;
      },
      execute: async (sql: string, params: unknown[] = []) => instrucao(sql, params, dentro),
    };
  }

  const pool = {
    execute: async (sql: string, params: unknown[] = []) => instrucao(sql, params, null),
    query: async (sql: string, params: unknown[] = []) => instrucao(sql, params, null),
    getConnection: async () => ligacao(),
  };
  return {
    getPool: async () => pool,
    toMySQLDateTime: (d: Date) => d.toISOString(),
    negociacoesDoProfissional: async () => [{ id: NEG, pedidoId: PEDIDO, contactName: null, serviceType: null }],
    registar: async (x: unknown) => {
      registos.registar.push(x);
    },
    appendOrderHistory: async (...x: unknown[]) => {
      registos.historico.push(x);
    },
  };
});

vi.mock("./carteira-do-profissional", () => ({ trabalhosDaCarteira: async () => [] }));

// A dívida lida do que está NA BASE (as marcas activas e a linha que a fechou), pela regra verdadeira das partes.
vi.mock("./carteira", async (original) => ({
  ...(await original<typeof import("./carteira")>()),
  dividasDe: () => {
    const marcas: MarcaDaParte[] = base.marcas
      .filter((m) => m.activa === 1)
      .map((m) => ({ ...m, marcadoPor: "a equipa" }));
    const partes = partesDaDivida(DIVIDA, marcas, null);
    const fechada = base.pagamentos.some((p) => p.negociacaoPaga === NEG && p.estado === "pago");
    return [{ negociacaoId: NEG, partes, paga: fechada || partes.every((p) => p.paga), aParte: false }];
  },
}));

let marcarPartes: typeof import("./cobrancas-na-base").marcarPartes;
let desfazerParte: typeof import("./cobrancas-na-base").desfazerParte;
beforeAll(async () => {
  ({ marcarPartes, desfazerParte } = await import("./cobrancas-na-base"));
}, 120_000);

beforeEach(() => {
  base.marcas = [];
  base.pagamentos = [];
  base.seq = 100;
  base.estoira = null;
  base.transaccoes = base.commits = base.rollbacks = base.largadas = 0;
  base.escritasFora = [];
  base.presaAntesDeEscrever = true;
  registos.registar = [];
  registos.historico = [];
});

const QUANDO = new Date("2026-11-05T11:00:00Z");
const marcar = (partes: Array<"iva" | "taxa">) =>
  marcarPartes({ negociacaoId: NEG, partes, metodo: "pro_mbway", quando: QUANDO, nota: null, quem: "a equipa" });
const desfazer = (parte: "iva" | "taxa") =>
  desfazerParte({ negociacaoId: NEG, parte, motivo: "marcado por engano", quem: "a administração" });

const activas = () => base.marcas.filter((m) => m.activa === 1).map((m) => m.parte).sort();
const fotografia = () => JSON.stringify({ marcas: base.marcas, pagamentos: base.pagamentos });

/** A dívida fechada pelas duas marcas da equipa, de uma vez, com a linha de `pagamentos` que nasceu com elas. */
async function dividaFechadaPelasMarcas() {
  const r = await marcar(["iva", "taxa"]);
  expect(r).toMatchObject({ ok: true, fechou: true });
  zerarContadores();
  return r.ok ? r.pagamentoId : null;
}
function zerarContadores() {
  base.transaccoes = base.commits = base.rollbacks = base.largadas = 0;
  registos.registar = [];
  registos.historico = [];
}

describe("desfazer: uma falha a meio não deixa nada meio marcado", () => {
  it("o caminho feliz: cancela a linha, solta a outra parte e tira a marca — e confirma a transacção", async () => {
    const pagamentoId = await dividaFechadaPelasMarcas();
    const r = await desfazer("taxa");
    expect(r.ok).toBe(true);

    expect(activas()).toEqual(["iva"]);
    expect(base.pagamentos.find((p) => p.id === pagamentoId)).toMatchObject({ estado: "cancelado", negociacaoPaga: null });
    expect(base.marcas.find((m) => m.parte === "iva")?.pagamentoId).toBeNull();
    expect([base.transaccoes, base.commits, base.rollbacks, base.largadas]).toEqual([1, 1, 0, 1]);
    expect(base.escritasFora).toEqual([]);
    expect(base.presaAntesDeEscrever).toBe(true);
    expect(registos.registar).toHaveLength(1);
  });

  for (const [onde, instrucao] of [
    ["ao tirar a marca (o último passo)", /SET activa = NULL/],
    ["ao soltar a outra parte (o passo do meio)", /SET pagamentoId = NULL/],
    ["ao cancelar a linha do pagamento (o primeiro passo)", /SET estado = 'cancelado'/],
  ] as const) {
    it(`a ligação cai ${onde}: fica tudo como estava`, async () => {
      const pagamentoId = await dividaFechadaPelasMarcas();
      const antes = fotografia();

      base.estoira = instrucao;
      await expect(desfazer("taxa")).rejects.toThrow("a ligação caiu a meio");

      expect(fotografia()).toBe(antes);
      expect(activas()).toEqual(["iva", "taxa"]);
      expect(base.pagamentos.find((p) => p.id === pagamentoId)).toMatchObject({ estado: "pago", negociacaoPaga: NEG });
      expect(base.marcas.every((m) => m.pagamentoId === pagamentoId)).toBe(true);
      expect([base.commits, base.rollbacks, base.largadas]).toEqual([0, 1, 1]);
      // Nem registo nem histórico de uma coisa que não aconteceu.
      expect(registos.registar).toEqual([]);
      expect(registos.historico).toEqual([]);
    });
  }

  it("o pagamento mudou entretanto: recusa, e a recusa também desfaz a transacção", async () => {
    const pagamentoId = await dividaFechadaPelasMarcas();
    base.pagamentos.find((p) => p.id === pagamentoId)!.estado = "reembolsado";
    const antes = fotografia();

    const r = await desfazer("taxa");
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(fotografia()).toBe(antes);
    expect([base.commits, base.rollbacks]).toEqual([0, 1]);
    expect(registos.registar).toEqual([]);
  });
});

describe("marcar: as marcas e a linha que fecha a dívida ficam juntas, ou não fica nenhuma", () => {
  it("o caminho feliz: as duas marcas e a linha, tudo pela ligação da transacção", async () => {
    const r = await marcar(["iva", "taxa"]);
    expect(r).toMatchObject({ ok: true, fechou: true });
    expect(activas()).toEqual(["iva", "taxa"]);
    expect(base.pagamentos).toHaveLength(1);
    expect(base.pagamentos[0]).toMatchObject({ estado: "pago", negociacaoPaga: NEG, valor: 33 });
    expect(base.marcas.every((m) => m.pagamentoId === base.pagamentos[0].id)).toBe(true);
    expect([base.transaccoes, base.commits, base.rollbacks, base.largadas]).toEqual([1, 1, 0, 1]);
    // A linha de `pagamentos` também: `registarRecebimentoAMao` escreve pela ligação que recebe.
    expect(base.escritasFora).toEqual([]);
    expect(base.presaAntesDeEscrever).toBe(true);
  });

  for (const [onde, instrucao] of [
    ["ao criar a linha que fecha a dívida", /INSERT INTO pagamentos/],
    ["ao ligar as marcas à linha", /SET pagamentoId = \? WHERE id = \?/],
  ] as const) {
    it(`a ligação cai ${onde}: não fica marca nenhuma nem linha nenhuma`, async () => {
      base.estoira = instrucao;
      await expect(marcar(["iva", "taxa"])).rejects.toThrow("a ligação caiu a meio");
      expect(base.marcas).toEqual([]);
      expect(base.pagamentos).toEqual([]);
      expect([base.commits, base.rollbacks, base.largadas]).toEqual([0, 1, 1]);
      expect(registos.registar).toEqual([]);
      expect(registos.historico).toEqual([]);
    });
  }

  it("só o IVA: fica a marca, sem linha; substituir as referências vivas falha → a marca sai também", async () => {
    base.pagamentos.push({ id: 50, negociacaoId: NEG, estado: "pendente", parte: "trabalho", valor: 33, negociacaoPaga: null, trid: null });
    base.estoira = /SET estado = 'substituido'/;
    await expect(marcar(["iva"])).rejects.toThrow("a ligação caiu a meio");
    expect(base.marcas).toEqual([]);
    expect(base.pagamentos[0].estado).toBe("pendente");

    base.estoira = null;
    expect(await marcar(["iva"])).toMatchObject({ ok: true, fechou: false, pagamentoId: null });
    expect(activas()).toEqual(["iva"]);
    expect(base.pagamentos[0].estado).toBe("substituido");
  });

  it("a dívida fechou-se entretanto por outro caminho: recusa, e a marca que já tinha entrado sai com a transacção", async () => {
    // Uma linha que a leitura da dívida ainda não viu, mas que já ocupa o índice único do trabalho pago.
    base.pagamentos.push({ id: 60, negociacaoId: NEG, estado: "a_entrar", parte: "trabalho", valor: 33, negociacaoPaga: NEG, trid: null });
    const r = await marcar(["iva", "taxa"]);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(base.marcas).toEqual([]);
    expect(base.pagamentos.map((p) => p.id)).toEqual([60]);
    expect([base.commits, base.rollbacks, base.largadas]).toEqual([0, 1, 1]);
    expect(registos.registar).toEqual([]);
  });
});
