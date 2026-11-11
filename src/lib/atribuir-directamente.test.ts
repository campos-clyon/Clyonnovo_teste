import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avisoDeEscolhaAoProfissional } from "./aviso-de-oferta-clyon";

/**
 * «ATRIBUIR DIRECTAMENTE A…» — 11-11-2026 (dono, o #591).
 *
 * *«Não consigo atribuir esse pedido a ele: ele tem de ir à conta aceitar, e
 * ele não sabe usar a aplicação. Quero só atribuir o pedido a ele e ficar
 * ligado a ele, sem ele ter de fazer nada.»*
 *
 * A base finge-se aqui: o que se verifica é o que a transacção escreve.
 */

const base = vi.hoisted(() => ({
  pedido: null as null | Record<string, unknown>,
  negs: [] as Array<Record<string, unknown>>,
  provider: { id: 7, name: "Jorge Mudança", estado: "aprovado" } as null | Record<string, unknown>,
  escritas: [] as Array<{ sql: string; params: unknown[] }>,
  insercoes: 0,
  commits: 0,
  rollbacks: 0,
}));

vi.mock("mysql2/promise", () => {
  const conn = {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {
      base.commits += 1;
    }),
    rollback: vi.fn(async () => {
      base.rollbacks += 1;
    }),
    release: vi.fn(),
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (/FROM simulatorOrders WHERE id = \? FOR UPDATE/.test(sql)) return [base.pedido ? [base.pedido] : [], []];
      if (/FROM negociacoes n/.test(sql)) return [base.negs, []];
      if (/^\s*INSERT INTO negociacoes/.test(sql)) {
        base.insercoes += 1;
        base.escritas.push({ sql, params });
        return [{ insertId: 99 }, []];
      }
      if (/^\s*UPDATE/.test(sql)) {
        base.escritas.push({ sql, params });
        return [{ affectedRows: /estado = 'morta'/.test(sql) ? base.negs.filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao").length : 1 }, []];
      }
      return [[], []];
    }),
  };
  const pool = {
    query: vi.fn(async () => [[], []]),
    execute: vi.fn(async (sql: string) => {
      if (/FROM providers WHERE id = \?/.test(sql)) return [base.provider ? [base.provider] : [], []];
      return [[], []];
    }),
    getConnection: vi.fn(async () => conn),
  };
  // A preparação das colunas (ensureProvidersSchema) abre uma ligação à parte.
  const avulsa = { execute: vi.fn(async () => [[], []]), query: vi.fn(async () => [[], []]), end: vi.fn(async () => {}) };
  return { default: { createPool: vi.fn(() => pool), createConnection: vi.fn(async () => avulsa) } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));

let db: typeof import("./db");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
}, 120_000);

beforeEach(() => {
  base.pedido = {
    id: 591,
    status: "atribuido",
    valorFixoClyon: "280.00",
    taxaClyon: "0.1500",
    dataAgendada: new Date("2026-11-20T09:00:00Z"),
  };
  base.negs = [];
  base.provider = { id: 7, name: "Jorge Mudança", estado: "aprovado" };
  base.escritas = [];
  base.insercoes = 0;
  base.commits = 0;
  base.rollbacks = 0;
});

const neg = (id: number, providerId: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  providerId,
  estado,
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  profissional: `PRO${providerId}`,
  ...extra,
});

describe("atribuir directamente um Trabalho CLYON", () => {
  it("o #591: sem negociação dele, nasce uma já «acordada» com o valor e a taxa — sem ele aceitar", async () => {
    const r = await db.atribuirDirectamenteTrabalhoClyon(591, 7);
    expect(r).toMatchObject({ ok: true, pedidoId: 591, negociacaoId: 99, providerId: 7, profissional: "Jorge Mudança", valor: 280, taxa: 0.15 });
    expect(base.insercoes).toBe(1);
    const fecho = base.escritas.find((e) => /SET estado = 'acordada'/.test(e.sql))!;
    expect(fecho.sql).toMatch(/ofertaClyon = 'directa', atribuidaEm = NOW\(\)/);
    expect(fecho.sql).toMatch(/taxaCliente = 0, taxaProfissional = \?/);
    // [valorAcordado, propostas, taxa, dia, id]
    expect(fecho.params[0]).toBe(280);
    expect(JSON.parse(String(fecho.params[1]))).toMatchObject([{ por: "cliente", valor: 280, estado: "aceite" }]);
    expect(fecho.params[2]).toBe(0.15);
    expect(fecho.params[3]).toEqual(new Date("2026-11-20T09:00:00Z"));
    expect(fecho.params[4]).toBe(99);
    expect(base.commits).toBe(1);
  });

  it("com a oferta já na mão dele (à espera de aceitar), fecha essa mesma, e os outros ficam de fora", async () => {
    base.negs = [neg(5, 7, "aberta"), neg(6, 8, "aguarda_contratacao"), neg(4, 9, "desistida")];
    const r = await db.atribuirDirectamenteTrabalhoClyon(591, 7);
    if (!r.ok) throw new Error("devia ter atribuído");
    expect(base.insercoes).toBe(0);
    expect(r.negociacaoId).toBe(5);
    const morta = base.escritas.find((e) => /SET estado = 'morta'/.test(e.sql))!;
    expect(morta.params).toEqual([591, 5]);
    expect(morta.sql).toMatch(/estado IN \('aberta', 'aguarda_contratacao'\)/);
  });

  it("já com outro, recusa (é «Trocar profissional»); já dele, também não mexe", async () => {
    base.negs = [neg(5, 8, "acordada")];
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "outro_tem", detalhe: "PRO8" });
    base.negs = [neg(5, 7, "acordada")];
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "ja_e_dele" });
    expect(base.escritas).toEqual([]);
  });

  it("nem num trabalho feito, cancelado, sem taxa, ou que não seja Trabalho CLYON", async () => {
    base.negs = [neg(5, 8, "acordada", { execucaoEnviadaEm: new Date() })];
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "ja_feito" });
    base.negs = [];
    base.pedido = { ...base.pedido!, status: "cancelado" };
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "arrumado" });
    base.pedido = { ...base.pedido!, status: "atribuido", taxaClyon: null };
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "sem_taxa" });
    base.pedido = { ...base.pedido!, valorFixoClyon: null };
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "nao_e_clyon" });
    base.provider = null;
    expect(await db.atribuirDirectamenteTrabalhoClyon(591, 7)).toMatchObject({ ok: false, porque: "sem_profissional" });
    expect(base.escritas).toEqual([]);
  });
});

describe("o que o profissional lê", () => {
  const AGORA = new Date("2026-11-11T10:00:00Z");
  it("o trabalho é seu, como combinado, sem nada para aceitar, com o dia em Lisboa", () => {
    const t = avisoDeEscolhaAoProfissional(
      "Jorge",
      {
        pedidoId: 591,
        servico: "mudanca",
        localidade: "Seixal",
        valor: 238,
        link: "https://clyon.pt/profissionais/painel",
        porFora: true,
        quando: new Date("2026-11-20T09:00:00Z"),
      },
      AGORA,
    );
    expect(t).toContain("(#591) é seu, como ficou combinado");
    expect(t).toContain("Não precisa de aceitar nada.");
    expect(t).toContain("Fica marcado para 20/11, 09:00.");
  });

  it("a escolha de sempre não muda", () => {
    const t = avisoDeEscolhaAoProfissional(
      "Jorge",
      { pedidoId: 591, servico: "mudanca", localidade: "Seixal", valor: 238, link: "x" },
      AGORA,
    );
    expect(t).toContain("O trabalho é seu: a CLYON escolheu-o para");
    expect(t).not.toContain("Fica marcado");
  });
});

describe("as peças ligadas", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");

  it("a rota: porta do painel, a guia antes de atribuir, e o atribuir não distribui", () => {
    const patch = ROTA.slice(ROTA.indexOf("export async function PATCH"));
    expect(patch.indexOf("requireAdmin(req)")).toBeLessThan(patch.indexOf('if (accao === "atribuir")'));
    const post = ROTA.slice(ROTA.indexOf("export async function POST"), ROTA.indexOf("export async function PATCH"));
    const ramo = post.slice(post.indexOf("if (atribuirA != null) {"), post.indexOf("const geo = await coordenadasDoPedido"));
    expect(ramo).toContain("guiaImpedeOProfissional(pedidoId, atribuirA)");
    expect(ramo.indexOf("guiaImpedeOProfissional")).toBeLessThan(ramo.indexOf("marcarPedidoComoOfertaClyon"));
    expect(ramo).toContain("atribuirDirectamente({");
    expect(ramo).not.toContain("distribuirPedido(");
  });

  it("o histórico diz quem atribuiu e que foi acordado por fora, e ele é avisado", () => {
    const L = ler("src/lib/atribuir-directamente.ts");
    expect(L).toContain("Atribuído pela CLYON (${a.quem}) a ${nome} — acordado por fora");
    expect(L).toContain("porFora: true");
    expect(L).toContain("guiaImpedeOProfissional(a.pedidoId, a.providerId)");
  });

  it("o ecrã: «Atribuir directamente a…» no cartão e na oferta; no «Duplicar», «Manter com o mesmo profissional» por omissão", () => {
    expect(ler("src/components/admin/AtribuirDirectamente.tsx")).toContain("Atribuir directamente a…");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain('mexer({ accao: "atribuir", providerId }');
    const F = ler("src/components/admin/FormularioDaOferta.tsx");
    expect(F).toContain('useState<"distribuir" | "escolher" | "atribuir">(atribuirInicial ? "atribuir" : "distribuir")');
    expect(F).toContain("Manter com o mesmo profissional");
    expect(F).toContain("atribuirA } : {}");
    const R = ler("src/components/admin/RegistarPedido.tsx");
    expect(R).toContain("valorFixo != null ? { valor: valorClyon, taxa: taxaClyon, motivo: motivoTaxaClyon, atribuido } : null");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("atribuirInicial={original.atribuido ?? null}");
  });
});
