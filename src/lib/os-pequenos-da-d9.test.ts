import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAS_DOS_ERROS_DA_APP } from "./retencao";

/**
 * OS PEQUENOS DA d9 — 28-10-2026 (relatório de Segurança e Confiança).
 *
 *   a) o qs fora da versão vulnerável (override ^6.16.1);
 *   b) o teste dos telemóveis lê o repositório inteiro — em
 *      `sem-telemoveis-de-pessoas.test.ts`;
 *   c) a configuração local do Claude fora do repositório público;
 *   d) os erros da app CLYON Pro saem aos 30 dias, na purga da noite;
 *   e) as contas de teste fora do perfil público e do sitemap.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

/* Uma base de mentira atrás do mysql2: regista o SQL dos erros da app. */
const base = { sql: [] as string[], contagem: 4, apagadas: 3 };
vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({
      execute: async (sql: string) => {
        base.sql.push(sql.replace(/\s+/g, " ").trim());
        if (/SELECT COUNT\(\*\) AS n FROM errosDaApp/.test(sql)) return [[{ n: base.contagem }], []];
        if (/DELETE FROM errosDaApp/.test(sql)) return [{ affectedRows: base.apagadas }, []];
        return [[], []];
      },
    }),
  },
}));

describe("a) o qs", () => {
  it("o override pede a 6.16.1 ou mais, e o lock tem uma dessas", () => {
    const pacote = JSON.parse(ler("package.json"));
    expect(pacote.pnpm.overrides.qs).toBe("^6.16.1");
    const lock = ler("pnpm-lock.yaml");
    const versoes = [...lock.matchAll(/^ {2}qs@(\d+)\.(\d+)\.(\d+):/gm)].map((m) => m.slice(1).map(Number));
    expect(versoes.length).toBeGreaterThan(0);
    for (const [maior, menor, rev] of versoes) {
      const v = maior * 1e6 + menor * 1e3 + rev;
      expect(v, `qs@${maior}.${menor}.${rev}`).toBeGreaterThanOrEqual(6 * 1e6 + 16 * 1e3 + 1);
    }
  });
});

describe("c) a configuração local do Claude", () => {
  it("não está no git, e o .gitignore não a deixa voltar", () => {
    const noGit = execFileSync("git", ["ls-files", "-z", ".claude"], { cwd: RAIZ, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    expect(noGit).not.toContain(".claude/settings.local.json");
    // O launch.json fica: é o que abre as pré-visualizações.
    expect(noGit).toContain(".claude/launch.json");
    expect(ler(".gitignore")).toMatch(/^\.claude\/settings\.local\.json$/m);
  });
});

describe("d) os erros da app saem aos 30 dias", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://teste/teste";
    base.sql = [];
  });

  it("o prazo é de 30 dias", () => {
    expect(DIAS_DOS_ERROS_DA_APP).toBe(30);
  });

  // Importar o db.ts leva uns segundos no meio da suite inteira: prazo largo.
  const PRAZO = 120_000;

  it("a sério, apaga os que têm mais de 30 dias, pela hora da base", async () => {
    const { purgarErrosDaApp } = await import("./db");
    base.sql = [];
    expect(await purgarErrosDaApp(DIAS_DOS_ERROS_DA_APP, { aSerio: true })).toBe(3);
    const apagar = base.sql.find((s) => s.startsWith("DELETE FROM errosDaApp"));
    expect(apagar).toBe("DELETE FROM errosDaApp WHERE recebidoEm < NOW() - INTERVAL 30 DAY LIMIT 2000");
  }, PRAZO);

  it("a seco, só conta — não apaga nada", async () => {
    const { purgarErrosDaApp } = await import("./db");
    base.sql = [];
    expect(await purgarErrosDaApp(DIAS_DOS_ERROS_DA_APP, { aSerio: false })).toBe(4);
    expect(base.sql.some((s) => s.startsWith("DELETE"))).toBe(false);
    expect(base.sql).toContain("SELECT COUNT(*) AS n FROM errosDaApp WHERE recebidoEm < NOW() - INTERVAL 30 DAY");
  }, PRAZO);

  it("corre na purga da noite, à parte das regras dos pedidos e sem as mudar", () => {
    const rota = semComentarios(ler("src/app/api/cron/purgar-pedidos/route.ts"));
    const passo = rota.indexOf("purgarErrosDaApp(DIAS_DOS_ERROS_DA_APP, { aSerio: armada })");
    expect(passo).toBeGreaterThan(-1);
    // Depois da purga dos pedidos, e por `passoSecundario`: uma falha não estraga o relatório.
    expect(passo).toBeGreaterThan(rota.indexOf("purgarPedidosTerminados("));
    expect(rota.slice(passo - 200, passo)).toContain("passoSecundario(");
    // Conta para a noite não se dizer «nada apagado», e fica no registo.
    const i = rota.search(/const nadaParaFazer =\r?\n\s*passosQueFalharam\.length === 0/);
    expect(i).toBeGreaterThan(-1);
    expect(rota.slice(i, i + 600)).toContain("errosDaApp === 0 &&");
    expect(rota).toContain("errosDaAppApagados: errosDaApp");
  });

  it("a rotina é a da purga, que corre todas as noites", () => {
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/purgar-pedidos", schedule: "30 4 * * *" });
  });
});

describe("e) as contas de teste não têm página pública", () => {
  const LIB = semComentarios(ler("src/lib/perfil-publico-do-profissional.ts"));

  it("a página por slug pede a marca a zero (e o nome continua a valer)", () => {
    const porSlug = LIB.slice(LIB.indexOf("export async function perfilPublicoPorSlug"));
    const consulta = porSlug.slice(0, porSlug.indexOf("LIMIT 1"));
    expect(consulta).toContain("COALESCE(contaDeTeste, 0) = 0");
    expect(porSlug).toMatch(/eContaDeTeste\(linha\.name\)\)\s*return null/);
  });

  it("a lista de onde saem o sitemap e os blocos das cidades também", () => {
    const aLista = LIB.slice(LIB.indexOf("export async function profissionaisComPagina"));
    const consulta = aLista.slice(0, aLista.indexOf("GROUP BY"));
    expect(consulta).toContain("COALESCE(p.contaDeTeste, 0) = 0");
    expect(aLista).toContain("!eContaDeTeste(");
    expect(ler("src/app/sitemap.ts")).toContain("profissionaisParaOSitemap");
    expect(aLista).toContain("export async function profissionaisParaOSitemap");
  });
});
