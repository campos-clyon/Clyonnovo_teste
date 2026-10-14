import { describe, it, expect, vi, beforeEach } from "vitest";
import { CATEGORIAS_DE_ORIGEM, CATEGORIAS_DO_SISTEMA } from "./financas";

/**
 * A GESTORA DE CONTAS NA BASE — 14-10-2026.
 *
 * Contra uma base falsa que regista cada instrução: o que nasce na primeira
 * abertura (as duas contas e as categorias), que uma tabela que ainda não
 * existe não deita a gestora abaixo, que os valores vão para as colunas
 * certas, e que o que não se apaga não se apaga.
 */

type Linha = Record<string, unknown>;
const estado = {
  sql: [] as Array<{ sql: string; params: unknown[] }>,
  categoriasSemSistema: 0,
  movimentosDaConta: 0,
  movimentosDaCategoria: 0,
  repetido: false,
  pagamentosExiste: true,
};

function responder(sql: string, params: unknown[]): unknown {
  if (sql.includes("CREATE TABLE")) return [{}, null];
  // As escritas primeiro: «DELETE FROM financasCategorias» também diz «FROM financasCategorias».
  if (sql.startsWith("UPDATE") || sql.startsWith("DELETE")) return [{ affectedRows: 1 }, null];
  if (sql.startsWith("INSERT IGNORE")) return [{ affectedRows: 1 }, null];
  if (sql.includes("COUNT(*) AS n FROM financasCategorias WHERE sistema IS NULL")) {
    return [[{ n: estado.categoriasSemSistema }], null];
  }
  if (sql.includes("COUNT(*) AS n FROM financasMovimentos WHERE contaId")) return [[{ n: estado.movimentosDaConta }], null];
  if (sql.includes("COUNT(*) AS n FROM financasMovimentos WHERE categoriaId")) return [[{ n: estado.movimentosDaCategoria }], null];
  if (sql.includes("SELECT papel FROM financasContas")) return [[{ papel: params[0] === 1 ? "plataforma" : null }], null];
  if (sql.includes("SELECT sistema FROM financasCategorias")) return [[{ sistema: params[0] === 40 ? "clientes" : null }], null];
  if (sql.includes("FROM financasContas")) {
    return [
      [
        { id: 1, nome: "Banco", tipo: "banco", saldoInicial: "15000.00", cor: "azul", papel: "plataforma" },
        { id: 2, nome: "Caixa", tipo: "dinheiro", saldoInicial: "300.00", cor: "esmeralda", papel: "caixa" },
      ],
      null,
    ];
  }
  if (sql.includes("FROM financasCategorias")) {
    return [
      [
        { id: 10, nome: "Combustível", tipo: "despesa", cor: "ardosia", icone: "combustivel", sistema: null },
        { id: 40, nome: "Clientes (plataforma)", tipo: "receita", cor: "ciano", icone: "clientes", sistema: "clientes" },
        { id: 42, nome: "Pagamentos aos profissionais", tipo: "despesa", cor: "violeta", icone: "profissionais", sistema: "pagamentos_aos_profissionais" },
      ] as Linha[],
      null,
    ];
  }
  if (sql.includes("FROM financasMovimentos")) {
    return [
      [
        {
          id: 5, tipo: "despesa", valor: "100.00", dia: "2026-10-13", descricao: "IVECO 1", categoriaId: 10, contaId: 1,
          contaDestinoId: null, efectivado: 1, ignorado: 0, notas: null, anexoUrl: null, anexoNome: null, criadoPor: "Wanderson",
        },
      ],
      null,
    ];
  }
  if (sql.includes("FROM pagamentos pg")) {
    if (!estado.pagamentosExiste) throw Object.assign(new Error("no table"), { code: "ER_NO_SUCH_TABLE" });
    return [[], null];
  }
  if (sql.includes("FROM negociacoes n")) {
    return [
      [
        {
          id: 7, pedidoId: 415, pagoEm: new Date("2026-10-10T10:00:00Z"), valorAcordado: "64.80", taxaCliente: "0.05",
          taxaProfissional: "0.06", formaDePagamento: null, profissional: "Revolution", contaDeTeste: 0,
        },
      ],
      null,
    ];
  }
  if (sql.includes("FROM levantamentos l")) return [[], null];
  if (sql.startsWith("INSERT INTO financas")) {
    if (estado.repetido) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    return [{ insertId: 99, affectedRows: 1 }, null];
  }
  return [[], null];
}

vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      const limpo = sql.replace(/\s+/g, " ").trim();
      estado.sql.push({ sql: limpo, params });
      return responder(limpo, params);
    },
  }),
}));

const base = await import("./financas-na-base");

beforeEach(() => {
  estado.sql = [];
  estado.categoriasSemSistema = 0;
  estado.movimentosDaConta = 0;
  estado.movimentosDaCategoria = 0;
  estado.repetido = false;
  estado.pagamentosExiste = true;
});

describe("a primeira abertura", () => {
  it("cria as três tabelas, as duas contas da plataforma e as categorias — as do dia-a-dia só uma vez", async () => {
    await base.contasDaGestora();
    const criadas = estado.sql.filter((s) => s.sql.startsWith("CREATE TABLE")).map((s) => /EXISTS (\w+)/.exec(s.sql)?.[1]);
    expect(criadas).toEqual(["financasContas", "financasCategorias", "financasMovimentos"]);
    const contas = estado.sql.filter((s) => s.sql.startsWith("INSERT IGNORE INTO financasContas"));
    expect(contas.map((s) => s.params[3])).toEqual(["plataforma", "caixa"]);
    const doSistema = estado.sql.filter((s) => s.sql.startsWith("INSERT IGNORE INTO financasCategorias") && s.params.length === 5);
    expect(doSistema.map((s) => s.params[4])).toEqual(Object.keys(CATEGORIAS_DO_SISTEMA));
    const doDiaADia = estado.sql.filter((s) => s.sql.startsWith("INSERT IGNORE INTO financasCategorias") && s.params.length === 4);
    expect(doDiaADia).toHaveLength(CATEGORIAS_DE_ORIGEM.length);

    // Uma segunda chamada no mesmo processo já não prepara nada.
    estado.sql = [];
    await base.categoriasDaGestora();
    expect(estado.sql.some((s) => s.sql.startsWith("CREATE TABLE"))).toBe(false);
  });
});

describe("tudo de uma vez", () => {
  it("junta o lançado à mão e o da plataforma — e uma tabela que ainda não existe não deita nada abaixo", async () => {
    estado.pagamentosExiste = false;
    const tudo = await base.tudoDaGestora();
    expect(tudo.contas.map((c) => [c.nome, c.saldoInicial, c.papel])).toEqual([
      ["Banco", 15000, "plataforma"],
      ["Caixa", 300, "caixa"],
    ]);
    expect(tudo.movimentos.map((m) => m.id)).toEqual(["m5", "auto:pago:7"]);
    const [aMao, pago] = tudo.movimentos;
    expect(aMao).toMatchObject({ tipo: "despesa", valor: 100, dia: "2026-10-13", contaId: 1, efectivado: true, automatico: null });
    // O que o pro recebe, com as taxas daquela negociação: 64,80 € − 6 %.
    expect(pago).toMatchObject({ tipo: "despesa", valor: 60.91, categoriaId: 42, contaId: 1, dia: "2026-10-10" });
  });

  it("o dia lê-se como texto, para o driver não o passar por meia-noite em UTC", async () => {
    await base.tudoDaGestora();
    const s = estado.sql.find((x) => x.sql.includes("FROM financasMovimentos ORDER BY"));
    expect(s?.sql).toContain("DATE_FORMAT(dia, '%Y-%m-%d') AS dia");
  });
});

describe("lançar e mudar", () => {
  const dados = {
    tipo: "despesa" as const,
    valor: 45.9,
    dia: "2026-10-14",
    descricao: "IVECO 2",
    categoriaId: 10,
    contaId: 1,
    contaDestinoId: null,
    efectivado: true,
    ignorado: false,
    notas: null,
    anexoUrl: "https://blob/talao.pdf",
    anexoNome: "talao.pdf",
  };

  it("cada valor na sua coluna, e quem lançou", async () => {
    const id = await base.lancarMovimento(dados, "Wanderson");
    expect(id).toBe(99);
    const s = estado.sql.find((x) => x.sql.startsWith("INSERT INTO financasMovimentos"))!;
    expect(s.params).toEqual(["despesa", 45.9, "2026-10-14", "IVECO 2", 10, 1, null, 1, 0, null, "https://blob/talao.pdf", "talao.pdf", "Wanderson"]);
  });

  it("mudar escreve quem mudou, e só naquele id", async () => {
    await base.mudarMovimento(5, dados, "Ana");
    const s = estado.sql.find((x) => x.sql.startsWith("UPDATE financasMovimentos"))!;
    expect(s.params.slice(-2)).toEqual(["Ana", 5]);
  });

  it("só os lançados à mão têm id que se mexa", () => {
    expect(base.idDoMovimento("m12")).toBe(12);
    expect(base.idDoMovimento("auto:pago:7")).toBeNull();
    expect(base.idDoMovimento("12")).toBeNull();
  });
});

describe("o que não se apaga", () => {
  it("as contas da plataforma, e uma conta com movimentos", async () => {
    expect(await base.apagarConta(1)).toEqual({
      ok: false,
      erro: "É a conta onde entra o dinheiro da plataforma: muda-se o nome, não se apaga.",
    });
    estado.movimentosDaConta = 3;
    const r = await base.apagarConta(3);
    expect(r.ok).toBe(false);
    expect(estado.sql.some((s) => s.sql.startsWith("DELETE"))).toBe(false);
  });

  it("as categorias da plataforma, e uma categoria com movimentos", async () => {
    expect((await base.apagarCategoria(40)).ok).toBe(false);
    estado.movimentosDaCategoria = 1;
    expect((await base.apagarCategoria(10)).ok).toBe(false);
    estado.movimentosDaCategoria = 0;
    expect(await base.apagarCategoria(10)).toEqual({ ok: true, id: undefined });
  });

  it("um nome repetido diz-se em português, e não rebenta", async () => {
    estado.repetido = true;
    expect(await base.criarConta({ nome: "Banco", tipo: "banco", saldoInicial: 0, cor: "azul" })).toEqual({
      ok: false,
      erro: "Já há uma conta com esse nome.",
    });
  });
});
