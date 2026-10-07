import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

/**
 * AS FUNÇÕES CORREM AO PÉ DA BASE — 07-10-2026.
 *
 * O MySQL está no Railway em Singapura e as funções corriam em Washington:
 * cada consulta custava ~0,23 s (medido: 0,20 s sem base, 0,43 s com um
 * SELECT), e a lista dos trabalhos do profissional faz várias seguidas. Desde
 * hoje o `vercel.json` põe as funções em `sin1`.
 *
 * Ficam em Washington (`functions` do vercel.json, `regions: ["iad1"]`) só
 * as rotas que não tocam na base — moradas, mapas, localização, envio de
 * fotos. Passam pelo limitador (Redis), que está nos EUA: em Singapura cada
 * uma ficava 0,22 s mais lenta (medido: 0,19 s → 0,49 s). O `preferredRegion`
 * do Next não serve — o Vercel ignorou-o nas funções Node.
 *
 * O perigo é uma delas passar a ler a base sem ninguém reparar: pagava 0,23 s
 * por consulta, do outro lado do mundo. Por isso este teste segue os imports
 * de cada rota fora de Singapura até ao fim, e chumba se algum chegar à base.
 */

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const SRC = path.join(RAIZ, "src");

/** Comentários fora — com a regra ancorada, que não come `image/*`. */
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** O que este ficheiro importa em tempo de execução (os `import type` não contam). */
function importsDe(fonte: string): string[] {
  const s = semComentarios(fonte);
  const achados: string[] = [];
  const padroes = [
    /(?:^|[\n;])\s*(?:import|export)\s+(?!type[\s{])[^'";]*?\sfrom\s+["']([^"']+)["']/g,
    /(?:^|[\n;])\s*import\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const p of padroes) for (const m of s.matchAll(p)) achados.push(m[1]);
  return achados;
}

function resolver(origem: string, alvo: string): string | null {
  let base: string;
  if (alvo.startsWith("@/")) base = path.join(SRC, alvo.slice(2));
  else if (alvo.startsWith(".")) base = path.resolve(path.dirname(origem), alvo);
  else return null; // pacote
  const tentativas = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return tentativas.find((t) => existsSync(t) && statSync(t).isFile()) ?? null;
}

const PACOTES_DA_BASE = ["mysql2", "mysql2/promise", "drizzle-orm/mysql2"];
const DB = path.join(SRC, "lib", "db.ts");

/** O caminho de imports que leva à base, ou null se não leva. */
function caminhoAteABase(ficheiro: string): string[] | null {
  const vistos = new Set<string>();
  const fila: Array<{ f: string; via: string[] }> = [{ f: ficheiro, via: [ficheiro] }];
  while (fila.length > 0) {
    const { f, via } = fila.shift()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    if (f === DB) return via;
    for (const alvo of importsDe(readFileSync(f, "utf8"))) {
      if (PACOTES_DA_BASE.includes(alvo)) return [...via, alvo];
      const r = resolver(f, alvo);
      if (r && !vistos.has(r)) fila.push({ f: r, via: [...via, r] });
    }
  }
  return null;
}

function ficheirosDeRota(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...ficheirosDeRota(p));
    else if (/^(route|page|layout)\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

const rel = (f: string) => path.relative(RAIZ, f).split(path.sep).join("/");
const VERCEL = JSON.parse(readFileSync(path.join(RAIZ, "vercel.json"), "utf8")) as {
  regions?: string[];
  functions?: Record<string, { regions?: string[] }>;
};

/** O glob do vercel.json em expressão regular: `**` atravessa pastas, `*` não. */
const globEmRegex = (g: string) =>
  new RegExp(
    "^" +
      g
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*\//g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, "(?:.*/)?") +
      "$",
  );

const ROTAS = ficheirosDeRota(path.join(SRC, "app")).map(rel);
const padroes = Object.entries(VERCEL.functions ?? {}).map(([glob, cfg]) => ({
  glob,
  regioes: cfg.regions ?? VERCEL.regions ?? [],
  ficheiros: ROTAS.filter((r) => globEmRegex(glob).test(r)),
}));
const comRegiaoPropria = padroes
  .filter((p) => JSON.stringify(p.regioes) !== JSON.stringify(["sin1"]))
  .flatMap((p) => p.ficheiros.map((r) => ({ f: path.join(RAIZ, r), regiao: p.regioes.join(",") })));

describe("a região das funções", () => {
  it("o vercel.json põe as funções em Singapura, ao pé da base", () => {
    expect(VERCEL.regions).toEqual(["sin1"]);
  });

  it("cada padrão de `functions` apanha pelo menos uma rota", () => {
    // Um padrão que não apanha nada faz o Vercel recusar o build.
    expect(padroes.filter((p) => p.ficheiros.length === 0).map((p) => p.glob)).toEqual([]);
  });

  it("o autocompletar de moradas do simulador fica em Washington", () => {
    // É o que o cliente usa a escrever, tecla a tecla — não pode ir a Singapura.
    expect(comRegiaoPropria).toContainEqual({
      f: path.join(SRC, "app", "api", "maps", "autocomplete", "route.ts"),
      regiao: "iad1",
    });
  });

  it("nenhuma rota fora de Singapura chega à base, nem por arrasto", () => {
    expect(comRegiaoPropria.length).toBeGreaterThan(0);
    const queChegam = comRegiaoPropria
      .filter((r) => r.regiao !== "sin1")
      .map((r) => ({ rota: rel(r.f), via: caminhoAteABase(r.f) }))
      .filter((r) => r.via !== null)
      .map((r) => `${r.rota}: ${r.via!.map((v) => (path.isAbsolute(v) ? rel(v) : v)).join(" → ")}`);
    expect(queChegam).toEqual([]);
  });

  it("o detector apanha mesmo uma rota que lê a base", () => {
    // Sem isto, um detector partido passava o teste de cima às cegas.
    const queLe = path.join(SRC, "app", "api", "profissionais", "meus-pedidos", "route.ts");
    expect(caminhoAteABase(queLe)).not.toBeNull();
    // E por arrasto: a sessão do profissional chega à base por outro módulo.
    expect(caminhoAteABase(path.join(SRC, "lib", "sessao-activa-do-profissional.ts"))).not.toBeNull();
  });
});
