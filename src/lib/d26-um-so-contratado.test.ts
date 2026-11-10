import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * DOIS FECHOS AO MESMO TEMPO DÃO UM SÓ CONTRATADO — 10-11-2026 (d26).
 *
 * Cada porta lia a negociação, passava-a pelo motor e gravava sem olhar outra
 * vez: o cliente a contratar um parceiro enquanto a equipa, em nome dele,
 * contratava outro, e cada um fechava a sua proposta e encerrava a do outro.
 *
 * A regra: `gravarNegociacao` leva o estado que a porta leu (`WHERE estado =
 * o que se leu`), e um fecho faz-se numa só transacção, com o pedido preso.
 * Quem chega em segundo recebe 409 «já foi decidido».
 *
 * A base finge-se aqui, com o que interessa de uma base a sério: a tranca do
 * `FOR UPDATE` sobre o pedido (quem chega em segundo espera pelo commit ou
 * pelo rollback de quem a tem) e cada instrução a demorar um instante, para
 * as duas gravações se cruzarem de facto.
 */

type Linha = { id: number; pedidoId: number; estado: string; valorAcordado: number | null; propostasJson: string };

const base = vi.hoisted(() => ({
  negs: [] as Array<{ id: number; pedidoId: number; estado: string; valorAcordado: number | null; propostasJson: string }>,
  // Por pedido: a fila de quem espera pela tranca.
  trancas: new Map<number, Promise<void>>(),
  transaccoes: 0,
}));

vi.mock("mysql2/promise", () => {
  const instante = () => new Promise<void>((r) => setTimeout(r, 2));

  async function instrucao(sql: string, params: unknown[], prender?: (pedidoId: number) => Promise<void>) {
    await instante();
    if (/SELECT id FROM simulatorOrders WHERE id = \? FOR UPDATE/.test(sql)) {
      if (prender) await prender(Number(params[0]));
      return [[{ id: params[0] }], []];
    }
    if (/SELECT id, estado FROM negociacoes WHERE pedidoId = \? FOR UPDATE/.test(sql)) {
      return [base.negs.filter((n) => n.pedidoId === Number(params[0])).map((n) => ({ id: n.id, estado: n.estado })), []];
    }
    if (/UPDATE negociacoes SET estado = \?, valorAcordado = \?, propostasJson = \? WHERE id = \? AND estado = \?/.test(sql)) {
      const [estado, valor, propostas, id, lido] = params as [string, number | null, string, number, string];
      const n = base.negs.find((x) => x.id === Number(id) && x.estado === lido);
      if (!n) return [{ affectedRows: 0 }, []];
      Object.assign(n, { estado, valorAcordado: valor, propostasJson: propostas });
      return [{ affectedRows: 1 }, []];
    }
    if (/UPDATE negociacoes SET estado = \?, valorAcordado = \?, propostasJson = \? WHERE id = \?/.test(sql)) {
      const [estado, valor, propostas, id] = params as [string, number | null, string, number];
      const n = base.negs.find((x) => x.id === Number(id));
      if (n) Object.assign(n, { estado, valorAcordado: valor, propostasJson: propostas });
      return [{ affectedRows: n ? 1 : 0 }, []];
    }
    if (/UPDATE negociacoes SET estado = 'morta'\s+WHERE pedidoId = \? AND id <> \? AND estado IN \('aberta', 'aguarda_contratacao'\)/.test(sql)) {
      const [pedidoId, excepto] = params as [number, number];
      const outras = base.negs.filter(
        (n) => n.pedidoId === Number(pedidoId) && n.id !== Number(excepto) && ["aberta", "aguarda_contratacao"].includes(n.estado),
      );
      for (const n of outras) n.estado = "morta";
      return [{ affectedRows: outras.length }, []];
    }
    return [[], []];
  }

  function ligacao() {
    let soltar: (() => void) | null = null;
    const largar = () => {
      soltar?.();
      soltar = null;
    };
    return {
      beginTransaction: async () => {
        base.transaccoes += 1;
      },
      commit: async () => largar(),
      rollback: async () => largar(),
      release: () => largar(),
      execute: (sql: string, params: unknown[] = []) =>
        instrucao(sql, params, async (pedidoId) => {
          const antes = base.trancas.get(pedidoId) ?? Promise.resolve();
          let abrir!: () => void;
          const minha = new Promise<void>((r) => (abrir = r));
          base.trancas.set(pedidoId, antes.then(() => minha));
          await antes;
          soltar = abrir;
        }),
    };
  }

  const pool = {
    query: async () => [[], []],
    execute: (sql: string, params: unknown[] = []) => instrucao(sql, params),
    getConnection: async () => ligacao(),
  };
  return { default: { createPool: () => pool, createConnection: () => undefined } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));

let db: typeof import("./db");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
}, 120_000);

const PEDIDO = 640;
const neg = (id: number, estado: string, pedidoId = PEDIDO): Linha => ({ id, pedidoId, estado, valorAcordado: null, propostasJson: "[]" });
const fecho = (valor: number) => ({ estado: "acordada", valorAcordado: valor, propostasJson: `[{"valor":${valor},"estado":"aceite"}]` });
const estados = () => Object.fromEntries(base.negs.map((n) => [n.id, n.estado]));

beforeEach(() => {
  base.negs = [];
  base.trancas.clear();
  base.transaccoes = 0;
});

describe("d26 — dois fechos ao mesmo tempo dão um só contratado", () => {
  it("duas pessoas fecham propostas diferentes do mesmo pedido: passa uma, a outra lê «já decidido»", async () => {
    base.negs = [neg(1, "aberta"), neg(2, "aberta"), neg(3, "aberta")];
    // As duas leram «aberta» antes de qualquer uma gravar.
    const [a, b] = await Promise.all([
      db.gravarNegociacao(1, fecho(300), { estado: "aberta", pedidoId: PEDIDO }),
      db.gravarNegociacao(2, fecho(280), { estado: "aberta", pedidoId: PEDIDO }),
    ]);
    const ganhou = [a, b].filter((r) => r.ok);
    const perdeu = [a, b].filter((r) => !r.ok);
    expect(ganhou).toHaveLength(1);
    expect(perdeu).toEqual([{ ok: false, porque: "ja_decidido" }]);
    // Um só contratado, e as outras encerradas por quem ganhou — na mesma transacção.
    expect(Object.values(estados()).filter((e) => e === "acordada")).toHaveLength(1);
    expect(Object.values(estados()).filter((e) => e === "morta")).toHaveLength(2);
    expect(ganhou[0]).toEqual({ ok: true, encerradas: 2 });
    expect(base.transaccoes).toBe(2);
  });

  it("vale com «aguarda_contratacao» de um lado e «aberta» do outro, e em muitas tentativas seguidas", async () => {
    for (let i = 0; i < 10; i++) {
      base.negs = [neg(1, "aguarda_contratacao"), neg(2, "aberta")];
      base.trancas.clear();
      const r = await Promise.all([
        db.gravarNegociacao(2, fecho(280), { estado: "aberta", pedidoId: PEDIDO }),
        db.gravarNegociacao(1, fecho(300), { estado: "aguarda_contratacao", pedidoId: PEDIDO }),
      ]);
      expect(r.filter((x) => x.ok)).toHaveLength(1);
      expect(Object.values(estados()).sort()).toEqual(["acordada", "morta"]);
    }
  });

  it("dois cliques no mesmo «Contratar»: fecha uma vez", async () => {
    base.negs = [neg(1, "aguarda_contratacao"), neg(2, "aberta")];
    const r = await Promise.all([
      db.gravarNegociacao(1, fecho(300), { estado: "aguarda_contratacao", pedidoId: PEDIDO }),
      db.gravarNegociacao(1, fecho(300), { estado: "aguarda_contratacao", pedidoId: PEDIDO }),
    ]);
    expect(r.filter((x) => x.ok)).toEqual([{ ok: true, encerradas: 1 }]);
    expect(r.filter((x) => !x.ok)).toEqual([{ ok: false, porque: "ja_decidido" }]);
    expect(estados()).toEqual({ 1: "acordada", 2: "morta" });
  });

  it("um pedido já com contratado não ganha segundo, mesmo que a linha ainda esteja como se leu", async () => {
    base.negs = [neg(1, "acordada"), neg(2, "aberta")];
    const r = await db.gravarNegociacao(2, fecho(280), { estado: "aberta", pedidoId: PEDIDO });
    expect(r).toEqual({ ok: false, porque: "ja_decidido" });
    expect(estados()).toEqual({ 1: "acordada", 2: "aberta" });
  });

  it("os fechos de pedidos diferentes não se atrapalham", async () => {
    base.negs = [neg(1, "aberta", 640), neg(2, "aberta", 641)];
    const r = await Promise.all([
      db.gravarNegociacao(1, fecho(300), { estado: "aberta", pedidoId: 640 }),
      db.gravarNegociacao(2, fecho(280), { estado: "aberta", pedidoId: 641 }),
    ]);
    expect(r).toEqual([
      { ok: true, encerradas: 0 },
      { ok: true, encerradas: 0 },
    ]);
  });
});

describe("d26 — a gravação leva o estado que se leu", () => {
  const proposta = { estado: "aberta", valorAcordado: null, propostasJson: '[{"valor":250,"estado":"pendente"}]' };

  it("o parceiro propõe sobre uma negociação que o cliente recusou entretanto: não escreve por cima", async () => {
    base.negs = [neg(1, "desistida")];
    const r = await db.gravarNegociacao(1, proposta, { estado: "aberta", pedidoId: PEDIDO });
    expect(r).toEqual({ ok: false, porque: "ja_decidido" });
    expect(base.negs[0]).toMatchObject({ estado: "desistida", propostasJson: "[]" });
  });

  it("com o estado como se leu, grava — sem transacção quando não fecha nada", async () => {
    base.negs = [neg(1, "aberta"), neg(2, "aberta")];
    const r = await db.gravarNegociacao(1, proposta, { estado: "aberta", pedidoId: PEDIDO });
    expect(r).toEqual({ ok: true, encerradas: 0 });
    expect(base.negs[0].propostasJson).toBe(proposta.propostasJson);
    expect(estados()).toEqual({ 1: "aberta", 2: "aberta" });
    expect(base.transaccoes).toBe(0);
  });

  it("sem o estado lido (redistribuir, contraproposta da conversa) grava como sempre", async () => {
    base.negs = [neg(1, "desistida")];
    expect(await db.gravarNegociacao(1, proposta)).toEqual({ ok: true, encerradas: 0 });
    expect(base.negs[0].estado).toBe("aberta");
  });
});

describe("d26 — todas as portas gravam assim, e respondem 409 a quem chega em segundo", () => {
  const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  /** Sem os comentários de bloco no início da linha — a regra ancorada. */
  const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

  const portas: Array<[string, string, RegExp]> = [
    ["o cliente (link, conta e app)", "src/lib/agir-como-cliente.ts", /\{ estado: linha\.estado, pedidoId \},\s*\);\s*if \(!gravou\.ok\) return falha\(409, JA_FOI_DECIDIDO/],
    ["o parceiro, no painel e na app Pro", "src/app/api/profissionais/negociacao/route.ts", /\{ estado: linha\.estado, pedidoId: linha\.pedidoId \},\s*\);\s*if \(!gravou\.ok\) return NextResponse\.json\(\{ error: JA_FOI_DECIDIDO, jaDecidido: true \}, \{ status: 409 \}\)/],
    ["o parceiro, pelo link do email", "src/app/api/negociacao/[token]/route.ts", /\{ estado: linha\.estado, pedidoId \},\s*\);\s*if \(!gravou\.ok\) \{\s*return NextResponse\.json\(\{ ok: false, error: JA_FOI_DECIDIDO, jaDecidido: true \}, \{ status: 409 \}\)/],
    ["a equipa, em nome do cliente", "src/app/api/admin/negociacoes/agir/route.ts", /\{ estado: linha\.estado, pedidoId \},\s*\);\s*if \(!gravou\.ok\) return NextResponse\.json\(\{ error: JA_FOI_DECIDIDO, jaDecidido: true \}, \{ status: 409 \}\)/],
  ];

  for (const [nome, ficheiro, regra] of portas) {
    it(nome, () => {
      const s = semComentarios(ler(ficheiro));
      expect(s, ficheiro).toMatch(regra);
      // Uma só gravação da negociação por porta, e é a condicionada.
      expect(s.match(/await gravarNegociacao\(/g), ficheiro).toHaveLength(1);
      expect(s, ficheiro).toMatch(/const gravou = await gravarNegociacao\(/);
      // As outras encerram-se dentro da transacção do fecho — nunca à parte, depois.
      expect(s, ficheiro).not.toContain("encerrarOutrasNegociacoes");
    });
  }

  it("fechar pelo WhatsApp passa pela mesma transacção; se perder, a conversa vai a uma pessoa e nada mais sai", () => {
    const s = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    const i = s.indexOf("async function fecharPeloCliente(");
    expect(i).toBeGreaterThan(-1);
    const corpo = s.slice(i, s.indexOf("async function recusarUmaNaBase", i));
    expect(corpo).toMatch(/\{ estado: alvo\.estado\.estado, pedidoId: alvo\.pedidoId \},\s*\);\s*if \(!gravou\.ok\) \{\s*await passarAUmaPessoa\(telefone, [^)]*\);\s*return;\s*\}/);
    expect(corpo).not.toContain("encerrarOutrasNegociacoes");
  });

  it("na base, o fecho prende o pedido antes das negociações e encerra as outras antes do commit", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function gravarNegociacao(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    const pedido = corpo.indexOf("FROM simulatorOrders WHERE id = ? FOR UPDATE");
    const negs = corpo.indexOf("FROM negociacoes WHERE pedidoId = ? FOR UPDATE");
    const grava = corpo.indexOf("conn.execute(gravarSeAinda, valores)");
    const mata = corpo.indexOf("SET estado = 'morta'");
    const commit = corpo.indexOf("await conn.commit()");
    for (const p of [pedido, negs, grava, mata, commit]) expect(p).toBeGreaterThan(-1);
    expect(pedido).toBeLessThan(negs);
    expect(negs).toBeLessThan(grava);
    expect(grava).toBeLessThan(mata);
    expect(mata).toBeLessThan(commit);
    expect(corpo).toContain("WHERE id = ? AND estado = ?");
  });

  it("a frase é uma só, e não fala de «profissional» a quem a lê", async () => {
    const { JA_FOI_DECIDIDO } = await import("./ja-foi-decidido");
    expect(JA_FOI_DECIDIDO).toBe("Este pedido já foi decidido entretanto. Veja como ficou.");
    expect(JA_FOI_DECIDIDO).not.toMatch(/profissional/i);
  });
});
