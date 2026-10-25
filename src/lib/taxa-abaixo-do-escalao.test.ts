import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faltaOMotivoDaTaxa,
  lerMotivoDaTaxa,
  MOTIVO_DA_TAXA_MAXIMO,
  taxaAbaixoDoEscalao,
} from "./oferta-clyon";
import ValorETaxaDoTrabalho from "@/components/admin/ValorETaxaDoTrabalho";

/**
 * ABAIXO DO ESCALÃO, SÓ COM O MOTIVO ESCRITO — 25-10-2026 (decisão d18).
 *
 * O dono manteve os três escalões da taxa de um Trabalho CLYON. Quem escolher
 * à mão uma taxa ABAIXO da do escalão do valor tem de escrever porquê; sem o
 * motivo, não se grava. Subir acima do escalão não pede nada. O motivo fica no
 * trabalho e lê-se no cartão do trabalho e nos Pagamentos.
 */

(globalThis as { React?: typeof React }).React = React;

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a regra", () => {
  it("só fica abaixo quem desce da taxa do escalão", () => {
    expect(taxaAbaixoDoEscalao(350, 0.1)).toBe(true);
    expect(taxaAbaixoDoEscalao(350, 0.15)).toBe(false);
    expect(taxaAbaixoDoEscalao(350, 0.2)).toBe(false);
    expect(taxaAbaixoDoEscalao(150, 0.1)).toBe(false);
    expect(taxaAbaixoDoEscalao(800, 0.15)).toBe(true);
    expect(taxaAbaixoDoEscalao(800, 0.2)).toBe(false);
  });

  it("na taxa do escalão, ou acima, não se pede motivo — e um que venha não se guarda", () => {
    expect(lerMotivoDaTaxa(350, 0.15, undefined)).toEqual({ ok: true, motivo: null });
    expect(lerMotivoDaTaxa(350, 0.2, "")).toEqual({ ok: true, motivo: null });
    expect(lerMotivoDaTaxa(150, 0.2, "qualquer coisa")).toEqual({ ok: true, motivo: null });
  });

  it("abaixo do escalão, sem motivo (ou só com espaços, ou curto de mais), não grava, e diz porquê", () => {
    for (const motivo of [undefined, null, "", "   ", "ok", 42]) {
      const r = lerMotivoDaTaxa(350, 0.1, motivo);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.erro).toContain("A taxa de 10 % fica abaixo da do escalão deste valor (15 %)");
      expect(r.erro).toContain("Escreva o motivo — sem ele, não se grava.");
    }
  });

  it("com o motivo, grava-o aparado e com tamanho limitado", () => {
    expect(lerMotivoDaTaxa(800, 0.1, "  Cliente   recorrente  ")).toEqual({ ok: true, motivo: "Cliente recorrente" });
    const longo = lerMotivoDaTaxa(800, 0.15, "x".repeat(1000));
    expect(longo.ok && longo.motivo?.length).toBe(MOTIVO_DA_TAXA_MAXIMO);
  });

  it("o ecrã sabe quando falta o motivo para poder gravar", () => {
    expect(faltaOMotivoDaTaxa("350", 0.1, "")).toBe(true);
    expect(faltaOMotivoDaTaxa("350", 0.1, "Combinado antes da tabela")).toBe(false);
    expect(faltaOMotivoDaTaxa("350", 0.15, "")).toBe(false);
    // Sem valor ou sem taxa ainda não há o que dizer.
    expect(faltaOMotivoDaTaxa("", 0.1, "")).toBe(false);
    expect(faltaOMotivoDaTaxa("350", null, "")).toBe(false);
  });
});

describe("o campo do valor e da taxa", () => {
  const desenhar = (valor: string, taxa: number | null, motivo: string) =>
    renderToStaticMarkup(
      createElement(ValorETaxaDoTrabalho, {
        valor,
        taxa,
        onValor: () => {},
        onTaxa: () => {},
        motivo,
        onMotivo: () => {},
      }),
    ).replace(/<!-- -->/g, "");

  it("abaixo do escalão abre a caixa do motivo, e sem ele diz que não se grava", () => {
    const html = desenhar("350", 0.1, "");
    expect(html).toContain("Motivo para ficar abaixo do escalão (obrigatório)");
    expect(html).toContain("<textarea");
    expect(html).toContain("Escreva o motivo — sem ele, não se grava.");
  });

  it("com o motivo escrito, a caixa fica e o erro sai", () => {
    const html = desenhar("350", 0.1, "Cliente recorrente");
    expect(html).toContain("Motivo para ficar abaixo do escalão (obrigatório)");
    expect(html).not.toContain("sem ele, não se grava");
  });

  it("na taxa do escalão, ou acima, não há caixa nenhuma", () => {
    expect(desenhar("350", 0.15, "")).not.toContain("Motivo para ficar abaixo do escalão");
    expect(desenhar("350", 0.2, "")).not.toContain("Motivo para ficar abaixo do escalão");
  });
});

describe("onde se grava a taxa de um Trabalho CLYON, o motivo vai junto", () => {
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
  const POST = ROTA.slice(ROTA.indexOf("export async function POST("), ROTA.indexOf("export async function PATCH("));
  const PATCH = ROTA.slice(ROTA.indexOf("export async function PATCH("));

  it("oferecer: sem motivo abaixo do escalão, recusa antes de gravar", () => {
    const le = POST.indexOf("lerMotivoDaTaxa(valor.valor, taxa.taxa, corpo.motivoTaxa)");
    const grava = POST.indexOf("await marcarPedidoComoOfertaClyon(");
    expect(le).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(le);
    expect(POST).toContain("if (!motivoDaTaxa.ok) return NextResponse.json({ error: motivoDaTaxa.erro }, { status: 400 });");
    expect(POST).toContain("taxa.taxa, baseEscolhida, motivoDaTaxa.motivo);");
  });

  it("mudar o valor ou a taxa: o mesmo, e o motivo vai para a base", () => {
    const ramo = PATCH.slice(PATCH.indexOf('if (accao === "valor")'));
    const le = ramo.indexOf("lerMotivoDaTaxa(valor.valor, taxa.taxa, corpo.motivoTaxa)");
    const grava = ramo.indexOf("await mudarValorDoTrabalhoClyon(");
    expect(le).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(le);
    expect(ramo).toContain("if (!motivoDaTaxa.ok) return NextResponse.json({ error: motivoDaTaxa.erro }, { status: 400 });");
    expect(ramo).toContain("base, motivoDaTaxa.motivo);");
  });

  it("a coluna nova é nula por omissão, e a versão das migrações subiu", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("`ALTER TABLE simulatorOrders ADD COLUMN motivoTaxaClyon VARCHAR(300) NULL DEFAULT NULL`,");
    expect(Number(DB.match(/const MIGRATION_VERSION = (\d+);/)?.[1])).toBeGreaterThanOrEqual(22);
    const OFERTA = DB.slice(DB.indexOf("export async function marcarPedidoComoOfertaClyon("));
    expect(OFERTA.slice(0, 2000)).toContain("motivoTaxaClyon = IF(? IS NULL, motivoTaxaClyon, ?)");
  });

  it("os três ecrãs que escolhem a taxa pedem o motivo e não gravam sem ele", () => {
    for (const ecra of [
      "src/components/admin/FormularioDaOferta.tsx",
      "src/components/admin/TrabalhoClyon.tsx",
      "src/components/admin/RegistarPedido.tsx",
    ]) {
      const fonte = ler(ecra);
      expect(fonte, ecra).toMatch(/onMotivo=\{set\w+\}/);
      expect(fonte, ecra).toContain("faltaOMotivoDaTaxa(");
      expect(fonte, ecra).toContain("motivoTaxa");
    }
  });

  it("o motivo lê-se no cartão do trabalho e nos Pagamentos — e os de antes dizem que não têm", () => {
    const CARTAO = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(CARTAO).toContain("t.motivoDaTaxa");
    expect(CARTAO).toContain('"sem motivo registado."');
    const PAGAMENTOS = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(PAGAMENTOS).toContain("t.taxaAbaixo.motivo");
    expect(PAGAMENTOS).toContain('"sem motivo registado."');
    expect(ler("src/lib/trabalhos-para-gerir.ts")).toContain("o.motivoTaxaClyon");
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("motivoDaTaxa: o.motivoDaTaxa,");
  });
});

/*
 * A BASE, FINGIDA — o que a transacção de mudar o valor escreve.
 */
const base = vi.hoisted(() => ({
  pedido: null as null | Record<string, unknown>,
  negs: [] as Array<Record<string, unknown>>,
  escritas: [] as Array<{ sql: string; params: unknown[] }>,
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
      if (/^\s*UPDATE/.test(sql)) {
        base.escritas.push({ sql, params });
        return [{ affectedRows: 1 }, []];
      }
      return [[], []];
    }),
  };
  const pool = {
    query: vi.fn(async () => [[], []]),
    execute: vi.fn(async () => [[], []]),
    getConnection: vi.fn(async () => conn),
  };
  return { default: { createPool: vi.fn(() => pool), createConnection: vi.fn() } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));

let db: typeof import("./db");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
}, 120_000);

beforeEach(() => {
  base.pedido = {
    id: 430,
    status: "atribuido",
    valorFixoClyon: "350.00",
    taxaClyon: "0.1000",
    motivoTaxaClyon: null,
    baseDoPreco: null,
  };
  base.negs = [];
  base.escritas = [];
  base.commits = 0;
  base.rollbacks = 0;
});

const doMotivo = () => base.escritas.filter((e) => /SET motivoTaxaClyon = \?/.test(e.sql));

describe("mudar o valor, com o motivo", () => {
  it("o motivo grava-se com o valor e a taxa novos", async () => {
    const r = await db.mudarValorDoTrabalhoClyon(430, 800, 0.15, null, "Cliente recorrente");
    expect(r.ok).toBe(true);
    expect(doMotivo().map((e) => e.params)).toEqual([["Cliente recorrente", 430]]);
    expect(base.commits).toBe(1);
  });

  it("subir para o escalão limpa o motivo", async () => {
    base.pedido = { ...base.pedido!, motivoTaxaClyon: "Cliente recorrente" };
    const r = await db.mudarValorDoTrabalhoClyon(430, 350, 0.15, null, null);
    expect(r.ok).toBe(true);
    expect(doMotivo().map((e) => e.params)).toEqual([[null, 430]]);
  });

  it("com o mesmo valor e a mesma taxa, escrever só o motivo grava-o e não incomoda ninguém", async () => {
    const r = await db.mudarValorDoTrabalhoClyon(430, 350, 0.1, null, "Valor combinado antes da tabela");
    expect(r).toMatchObject({ ok: true, soOMotivo: true, avisar: [] });
    expect(base.escritas.map((e) => e.params)).toEqual([["Valor combinado antes da tabela", 430]]);
    expect(base.escritas.some((e) => /UPDATE negociacoes/.test(e.sql))).toBe(false);
    expect(base.commits).toBe(1);
  });

  it("o mesmo valor, a mesma taxa e o mesmo motivo continuam a ser «igual»", async () => {
    base.pedido = { ...base.pedido!, motivoTaxaClyon: "Cliente recorrente" };
    const r = await db.mudarValorDoTrabalhoClyon(430, 350, 0.1, null, "Cliente recorrente");
    expect(r).toEqual({ ok: false, porque: "igual" });
    expect(base.escritas).toEqual([]);
  });
});
