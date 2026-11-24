// Relógio: datas explícitas em todas as chamadas — nada aqui lê o dia de hoje.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D102 (CEO e dono, 24-11-2026) — O QUE A VITÓRIA FEZ NAS ÚLTIMAS 24 H.
 * Uma rota só de leitura e só do administrador soma as passagens de cada
 * rotina (quantas, quantas a vermelho, cada número do detalhe) nas últimas
 * 24 h e, com ?dias=7, dia a dia em Lisboa. A soma é genérica: um campo novo
 * no detalhe entra sem mexer no código. Só números — nunca o texto.
 */

const base = vi.hoisted(() => ({
  linhas: [] as Array<{ id: number; rotina: string; comecouEm: string; ok: number; detalhe: string | null }>,
  sqls: [] as string[],
  params: [] as unknown[][],
  semTabela: false,
}));

vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      base.sqls.push(sql);
      base.params.push(params);
      if (base.semTabela) throw Object.assign(new Error("Table doesn't exist"), { code: "ER_NO_SUCH_TABLE" });
      const [desde, depoisDe] = params as [string, number];
      const limite = Number(/LIMIT (\d+)/.exec(sql)?.[1] ?? 1000);
      const rows = base.linhas
        .filter((l) => l.comecouEm >= desde && l.id > depoisDe)
        .sort((a, b) => a.id - b.id)
        .slice(0, limite);
      return [rows];
    },
  }),
}));

import {
  diasPedidos,
  lerDesde,
  nomeDoCampo,
  oQueAVitoriaFez,
  somarDetalhe,
  somarPassagens,
  ROTINAS_DA_VITORIA,
  type SomaDaRotina,
} from "./o-que-a-vitoria-fez";
import { lerOQueAVitoriaFez } from "./o-que-a-vitoria-fez-na-base";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const vazia = (): SomaDaRotina => ({ rotina: "x", titulo: "x", passagens: 0, vermelhas: 0, numeros: {}, vezes: {}, listas: {} });
const AGORA = new Date("2026-11-24T15:00:00Z"); // 15h00 em Lisboa (Inverno, UTC+0)
const daBase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

beforeEach(() => {
  base.linhas = [];
  base.sqls = [];
  base.params = [];
  base.semTabela = false;
});

describe("d102 — a soma do detalhe é genérica", () => {
  it("soma os números, conta os verdadeiros e o tamanho das listas; o texto fica de fora", () => {
    const s = vazia();
    somarDetalhe(s, JSON.stringify({ enviados: 2, ficaram: 1, ligado: true, desligado: false, linhas: ["#601 a Fulano 912 345 678", "#602"], nota: "texto" }));
    somarDetalhe(s, { enviados: 3, enviadosDosNovos: 4, ligado: true, linhas: ["#603"] });
    expect(s.numeros).toEqual({ enviados: 5, ficaram: 1, enviadosDosNovos: 4 });
    expect(s.vezes).toEqual({ ligado: 2 });
    expect(s.listas).toEqual({ linhas: 3 });
    expect(JSON.stringify(s)).not.toMatch(/Fulano|912|texto|#60/);
  });

  it("um campo que a rotina venha a acrescentar entra sem mexer no código", () => {
    const s = vazia();
    somarDetalhe(s, { naFila: 1, arrancados: 2 });
    somarDetalhe(s, { naFila: 2, umCampoQueAindaNaoExiste: 7 });
    expect(s.numeros).toEqual({ naFila: 3, arrancados: 2, umCampoQueAindaNaoExiste: 7 });
  });

  it("um objecto lá dentro entra como «pai.filho», um nível só", () => {
    const s = vazia();
    somarDetalhe(s, { porEmail: { enviados: 2, fundo: { n: 9 } } });
    expect(s.numeros).toEqual({ "porEmail.enviados": 2 });
    expect(nomeDoCampo("porEmail.enviados")).toBe("por email · enviados");
    expect(nomeDoCampo("enviadosDosNovos")).toBe("enviados dos novos");
  });

  it("chaves feitas de dados (telefones, ids) não entram; JSON cortado não soma nada", () => {
    const s = vazia();
    somarDetalhe(s, { "+351912345678": 1, "601": 2, ok: 1 });
    somarDetalhe(s, '{"enviados": 2, "linhas": ["cortado');
    somarDetalhe(s, null);
    somarDetalhe(s, "[1,2]");
    expect(s.numeros).toEqual({ ok: 1 });
  });
});

describe("d102 — as passagens do período", () => {
  const p = (rotina: string, iso: string, ok: boolean, detalhe: unknown) => ({
    rotina,
    comecouEm: new Date(iso),
    ok,
    detalhe: detalhe == null ? null : JSON.stringify(detalhe),
  });

  it("conta passagens e vermelhas por rotina, só dentro do período; as da Vitória primeiro, mesmo a zero", () => {
    const s = somarPassagens(
      [
        p("envio-aos-parceiros", "2026-11-24T10:00:00Z", true, { enviados: 2, ficaram: 1 }),
        p("envio-aos-parceiros", "2026-11-24T10:15:00Z", false, null),
        p("envio-aos-parceiros", "2026-11-22T10:15:00Z", true, { enviados: 50 }),
        p("rotina-nova", "2026-11-24T11:00:00Z", true, { feitos: 1 }),
      ],
      new Date("2026-11-23T15:00:00Z"),
      new Date("2026-11-24T15:00:01Z"),
    );
    expect(s.rotinas.slice(0, ROTINAS_DA_VITORIA.length).map((r) => r.rotina)).toEqual([...ROTINAS_DA_VITORIA]);
    const envio = s.rotinas.find((r) => r.rotina === "envio-aos-parceiros")!;
    expect(envio).toMatchObject({ passagens: 2, vermelhas: 1, numeros: { enviados: 2, ficaram: 1 } });
    expect(s.rotinas.find((r) => r.rotina === "propostas-ao-cliente")!.passagens).toBe(0);
    expect(s.rotinas[s.rotinas.length - 1].rotina).toBe("rotina-nova");
  });

  it("os 7 dias contam-se em Lisboa — no Verão, as 23h30 UTC já são o dia seguinte", () => {
    const agora = new Date("2026-07-10T12:00:00Z");
    const r = oQueAVitoriaFez([p("assistente", "2026-07-08T23:30:00Z", true, { avisos: 1 })], agora, 7);
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia![0].dia).toBe("2026-07-10");
    const dia9 = r.porDia!.find((d) => d.dia === "2026-07-09")!;
    expect(dia9.rotinas.find((x) => x.rotina === "assistente")!.passagens).toBe(1);
    expect(r.porDia!.find((d) => d.dia === "2026-07-08")!.rotinas.find((x) => x.rotina === "assistente")!.passagens).toBe(0);
  });

  it("?dias aceita 1 a 7; o resto é 1 (só as 24 h)", () => {
    expect(diasPedidos("7")).toBe(7);
    expect(diasPedidos("3")).toBe(3);
    expect(diasPedidos(null)).toBe(1);
    expect(diasPedidos("30")).toBe(1);
    expect(diasPedidos("abc")).toBe(1);
    expect(oQueAVitoriaFez([], AGORA, 1).porDia).toBeNull();
    expect(lerDesde(AGORA, 1).toISOString()).toBe("2026-11-23T15:00:00.000Z");
    expect(lerDesde(AGORA, 7).toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });
});

describe("d102 — com a base simulada", () => {
  it("lê às fatias pelo id, desde o começo do período em UTC, e soma tudo", async () => {
    for (let i = 1; i <= 2500; i++) {
      const quando = new Date(AGORA.getTime() - i * 30 * 1000);
      base.linhas.push({
        id: i,
        rotina: "envio-aos-parceiros",
        comecouEm: daBase(quando),
        ok: i % 500 === 0 ? 0 : 1,
        detalhe: JSON.stringify({ enviados: 1, enviadosDosNovos: 2, ficaram: 0 }),
      });
    }
    base.linhas.push({ id: 9999, rotina: "propostas-ao-cliente", comecouEm: "2026-11-20 10:00:00", ok: 1, detalhe: '{"naFila":5}' });
    const r = await lerOQueAVitoriaFez(AGORA, 1);
    expect(base.sqls).toHaveLength(3);
    expect(base.params[0]).toEqual(["2026-11-23 15:00:00", 0]);
    expect(base.params[1]).toEqual(["2026-11-23 15:00:00", 1000]);
    const envio = r.ultimas24h.rotinas.find((x) => x.rotina === "envio-aos-parceiros")!;
    expect(envio).toMatchObject({ passagens: 2500, vermelhas: 5, numeros: { enviados: 2500, enviadosDosNovos: 5000, ficaram: 0 } });
    expect(r.ultimas24h.rotinas.find((x) => x.rotina === "propostas-ao-cliente")!.passagens).toBe(0);
    expect(r.porDia).toBeNull();
    expect(r.incompleto).toBe(false);
  });

  it("com ?dias=7 lê desde a meia-noite de Lisboa de há 6 dias e dá dia a dia", async () => {
    base.linhas.push({ id: 1, rotina: "propostas-ao-cliente", comecouEm: "2026-11-20 10:00:00", ok: 1, detalhe: '{"naFila":5,"ficam":1}' });
    const r = await lerOQueAVitoriaFez(AGORA, 7);
    expect(base.params[0]).toEqual(["2026-11-18 00:00:00", 0]);
    const dia20 = r.porDia!.find((d) => d.dia === "2026-11-20")!;
    expect(dia20.rotinas.find((x) => x.rotina === "propostas-ao-cliente")).toMatchObject({ passagens: 1, numeros: { naFila: 5, ficam: 1 } });
  });

  it("sem a tabela ainda, dá zero e não rebenta", async () => {
    base.semTabela = true;
    const r = await lerOQueAVitoriaFez(AGORA, 1);
    expect(r.ultimas24h.rotinas.every((x) => x.passagens === 0)).toBe(true);
  });

  it("só lê: nenhuma escrita na base", () => {
    expect(base.sqls.join("\n")).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/);
    const codigo = ler("src/lib/o-que-a-vitoria-fez-na-base.ts").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/);
  });
});

describe("d102 — onde está", () => {
  it("a rota é GET, só do administrador, e o cartão está no painel das Rotinas", () => {
    const rota = ler("src/app/api/admin/rotinas/o-que-a-vitoria-fez/route.ts");
    expect(rota).toContain("requireAdminGeral(req)");
    expect(rota).toContain("export async function GET");
    expect(rota).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    const cartao = ler("src/components/admin/OQueAVitoriaFez.tsx");
    expect(cartao).toContain("O que a Vitória fez nas últimas 24 h");
    expect(cartao).toContain("/api/admin/rotinas/o-que-a-vitoria-fez?dias=");
    expect(ler("src/components/admin/AdminRotinasPanel.tsx")).toContain("<OQueAVitoriaFez />");
  });
});
