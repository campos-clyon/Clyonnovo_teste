import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { carimbarPassagem } from "./licoes-da-vitoria-na-base";
import { ROTINAS, estadoDaRotina, estadoDasRotinas, contarVermelhas, type UltimaPassagem } from "./rotinas";

/**
 * AS ROTINAS CARIMBAM CADA PASSAGEM — 27-10-2026 (decisão d7).
 *
 * Seis das sete rotinas só escreviam no registo quando mexiam em alguma
 * coisa: «sem nada a fazer» e «morreu» pareciam iguais. Este teste exige o
 * carimbo em TODAS as rotas de `src/app/api/cron` — uma rotina nova que não
 * carimbe chumba aqui — e que uma rotina que falha fique vermelha.
 */

/* Uma base de mentira: cada INSERT em passagensDasRotinas fica aqui. */
const inseridas: Array<{ sql: string; params: unknown[] }> = [];
vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      if (/INSERT INTO passagensDasRotinas/.test(sql)) inseridas.push({ sql, params });
      return [[], []];
    },
  }),
}));

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PASTA = join(process.cwd(), "src/app/api/cron");
const pastas = readdirSync(PASTA).filter((n) => statSync(join(PASTA, n)).isDirectory());

describe("todas as rotas de src/app/api/cron carimbam a passagem", () => {
  it("há pelo menos as oito de hoje", () => {
    expect(pastas.length).toBeGreaterThanOrEqual(8);
  });

  for (const nome of pastas) {
    it(`${nome}: chama carimbarPassagem("${nome}", …)`, () => {
      const rota = ler(`src/app/api/cron/${nome}/route.ts`);
      expect(rota).toContain(`import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";`);
      expect(rota).toMatch(new RegExp(`carimbarPassagem\\(\\s*"${nome}"`));
    });

    it(`${nome}: está na lista das rotinas do painel`, () => {
      expect(ROTINAS.map((r) => r.nome)).toContain(nome);
    });
  }

  it("a lista do painel é a do vercel.json, com os mesmos horários", () => {
    const crons = (JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> }).crons;
    expect(crons.map((c) => c.path.replace("/api/cron/", "")).sort()).toEqual(ROTINAS.map((r) => r.nome).sort());
    for (const c of crons) {
      const r = ROTINAS.find((x) => `/api/cron/${x.nome}` === c.path);
      expect(r?.horario).toBe(c.schedule);
    }
  });

  it("o resumo semanal tem try/catch, e um email recusado conta como falha", () => {
    const rota = ler("src/app/api/cron/weekly-digest/route.ts");
    expect(rota).toMatch(/try \{[\s\S]*carimbarPassagem\([\s\S]*\} catch \(error\)/);
    expect(rota).toContain("else recusados++");
    expect(rota).toContain("ok: d.recusados === 0");
  });

  it("a leitura das conversas regista também as falhas, e não só quando fecha", () => {
    const rota = ler("src/app/api/cron/ler-conversas/route.ts");
    expect(rota).toContain("if (r.fechadas > 0 || r.falhas > 0)");
    expect(rota).toContain("ok: Boolean(process.env.GEMINI_API_KEY) && p.falhas === 0");
  });
});

describe("carimbarPassagem — também quando rebenta", () => {
  beforeEach(() => {
    inseridas.length = 0;
  });

  it("uma passagem sem nada a fazer fica carimbada ok", async () => {
    await carimbarPassagem("alcancar-pedidos", async () => ({ novas: 0 }), () => ({ ok: true }));
    expect(inseridas).toHaveLength(1);
    expect(inseridas[0].params[0]).toBe("alcancar-pedidos");
    expect(inseridas[0].params[2]).toBe(1);
  }, 30_000);

  it("uma passagem que rebenta fica carimbada «falhou» com o motivo — e o erro segue para a rota", async () => {
    await expect(
      carimbarPassagem(
        "weekly-digest",
        async () => {
          throw new Error("DB indisponível");
        },
        () => ({ ok: true }),
      ),
    ).rejects.toThrow("DB indisponível");
    expect(inseridas).toHaveLength(1);
    expect(inseridas[0].params[0]).toBe("weekly-digest");
    expect(inseridas[0].params[2]).toBe(0);
    expect(inseridas[0].params[3]).toBe("DB indisponível");
  }, 30_000);
});

describe("a regra do vermelho", () => {
  const assistente = ROTINAS.find((r) => r.nome === "assistente")!;
  const passagem = (p: Partial<UltimaPassagem>): UltimaPassagem => ({
    rotina: "assistente",
    ok: true,
    motivo: null,
    haSegundos: 60,
    durouS: 3,
    ...p,
  });

  it("uma rotina que falhou fica vermelha, com o motivo", () => {
    const e = estadoDaRotina(assistente, passagem({ ok: false, motivo: "recolhas paradas: timeout" }), 86400);
    expect(e.vermelha).toBe(true);
    expect(e.porque).toContain("recolhas paradas: timeout");
  });

  it("uma rotina de 10 em 10 min que não passa há 25 min fica vermelha; aos 15 não", () => {
    expect(estadoDaRotina(assistente, passagem({ haSegundos: 25 * 60 }), 86400).vermelha).toBe(true);
    expect(estadoDaRotina(assistente, passagem({ haSegundos: 15 * 60 }), 86400).vermelha).toBe(false);
  });

  it("nunca passou: só é vermelha depois de os carimbos existirem há mais de 2× o intervalo", () => {
    const semanal = ROTINAS.find((r) => r.nome === "weekly-digest")!;
    expect(estadoDaRotina(semanal, null, 3600).vermelha).toBe(false);
    expect(estadoDaRotina(semanal, null, 15 * 86400).vermelha).toBe(true);
  });

  it("o selo conta as vermelhas", () => {
    const estados = estadoDasRotinas(
      [passagem({ ok: false, motivo: "x" }), { ...passagem({}), rotina: "ler-conversas" }],
      600,
    );
    expect(estados).toHaveLength(ROTINAS.length);
    expect(contarVermelhas(estados)).toBe(1);
  });
});

describe("o painel «Rotinas» é só do administrador", () => {
  it("a rota é requireAdminGeral e não está na lista do assistente", () => {
    expect(ler("src/app/api/admin/rotinas/route.ts")).toContain("await requireAdminGeral(req)");
    expect(ler("src/lib/papel-do-painel.ts")).not.toContain("/api/admin/rotinas");
  });

  it("nas Configs só com papel admin, e o selo só para o administrador", () => {
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toMatch(/papel === "admin" && \(\s*<div[^]*?<AdminRotinasPanel \/>/);
    expect(ler("src/app/api/admin/novidades/route.ts")).toMatch(/if \(colab\.papel === "admin"\) \{[^]*?contarRotinasVermelhas/);
  });
});
