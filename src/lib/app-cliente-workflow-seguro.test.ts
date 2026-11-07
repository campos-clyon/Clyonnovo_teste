import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AS PORTAS DO WORKFLOW DA APP DE CLIENTE — d11, ordem do CEO com o sim do
 * dono (04-11-2026). Quem tiver o EXPO_TOKEN muda a app em todos os
 * telemóveis sem a revisão da Play; este teste guarda as cinco portas
 * fechadas e a lista dos ficheiros de src/lib que entram no bundle da app.
 */

const RAIZ = process.cwd();
const CAMINHO = ".github/workflows/atualizar-app-cliente.yml";
const bruto = readFileSync(join(RAIZ, CAMINHO), "utf8").replace(/\r\n/g, "\n");
// Só as linhas inteiras de comentário: um `#` a meio (as versões ao lado dos
// SHA) fica, e é preciso.
const yml = bruto.replace(/^[ \t]*#.*$/gm, "");

/** Os trabalhos, cada um com o seu texto (dois espaços de recuo sob `jobs:`). */
function trabalhos(): Record<string, string> {
  const inicio = yml.search(/^jobs:\s*$/m);
  expect(inicio).toBeGreaterThan(-1);
  const corpo = yml.slice(inicio);
  const nomes = [...corpo.matchAll(/^ {2}([\w-]+):\s*$/gm)];
  const out: Record<string, string> = {};
  nomes.forEach((m, i) => {
    out[m[1]] = corpo.slice(m.index!, i + 1 < nomes.length ? nomes[i + 1].index : undefined);
  });
  return out;
}

/* ---------- os ficheiros de src/lib que a app de cliente leva ---------- */

const EXTENSOES = [".ts", ".tsx", ".js", ".jsx", ".json"];
const LIB = join(RAIZ, "src", "lib") + sep;
const APP = join(RAIZ, "app-cliente");

function ficheirosDaApp(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "android" || e.name === "ios") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) ficheirosDaApp(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

function resolver(de: string, esp: string): string | null {
  let base: string;
  if (esp.startsWith(".")) base = resolve(dirname(de), esp);
  else if (esp.startsWith("@/")) base = join(RAIZ, "src", esp.slice(2));
  else return null; // um pacote
  const candidatos = [base, ...EXTENSOES.map((x) => base + x), ...EXTENSOES.map((x) => join(base, "index" + x))];
  const achado = candidatos.find((c) => existsSync(c) && statSync(c).isFile());
  if (!achado) throw new Error(`Não resolvi «${esp}» em ${relative(RAIZ, de)}`);
  return achado;
}

function importsDe(ficheiro: string): string[] {
  const s = readFileSync(ficheiro, "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const re =
    /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']|(?:require|import)\(\s*["']([^"']+)["']\s*\)/gm;
  return [...s.matchAll(re)].map((m) => m[1] ?? m[2]);
}

/** Fecho: o que a app importa de src/lib, e o que esses importam, até ao fim. */
function srcLibNaApp(): string[] {
  const daApp = new Set(ficheirosDaApp(APP));
  const vistos = new Set<string>();
  const fila = [...daApp];
  while (fila.length) {
    const f = fila.pop()!;
    for (const esp of importsDe(f)) {
      const r = resolver(f, esp);
      if (!r || daApp.has(r) || vistos.has(r)) continue;
      if (r.startsWith(APP + sep)) continue;
      // O Metro só vê app-cliente/ e src/lib (metro.config.js): outra pasta não chega à app.
      expect(r.startsWith(LIB), `${relative(RAIZ, f)} importa ${relative(RAIZ, r)}, fora de src/lib`).toBe(true);
      vistos.add(r);
      fila.push(r);
    }
  }
  return [...vistos].map((p) => relative(RAIZ, p).split(sep).join("/")).sort();
}

function listaDoWorkflow(): string[] {
  const m = yml.match(/^( +)DO_SITE_NA_APP: >-\n((?:\1 +\S+\n)+)/m);
  expect(m, "falta a lista DO_SITE_NA_APP no passo «A app de cliente mudou?»").not.toBeNull();
  return m![2].split("\n").map((l) => l.trim()).filter(Boolean).sort();
}

describe("a lista dos ficheiros de src/lib que entram no bundle da app de cliente", () => {
  it("é exactamente o que a app importa (directa ou indirectamente)", () => {
    const reais = srcLibNaApp();
    // Sem isto, um leitor de imports partido devolvia [] e a lista vazia passava.
    expect(reais).toContain("src/lib/hora-de-lisboa.ts");
    expect(reais).toContain("src/lib/frases-do-pedido.ts");
    expect(listaDoWorkflow()).toEqual(reais);
  });

  it("entra no git diff da mudança, ao lado de app-cliente/", () => {
    const passo = trabalhos().mudou;
    expect(passo).toMatch(/git diff --name-only "\$ETIQUETA" HEAD -- app-cliente\/ \$DO_SITE_NA_APP/);
  });
});

describe("as portas do workflow da app de cliente", () => {
  it("só lê o repositório por omissão; a escrita é só de «marcar», que não instala nem faz checkout", () => {
    expect(yml).toMatch(/^permissions:\n {2}contents: read\s*$/m);
    const t = trabalhos();
    expect(Object.keys(t).sort()).toEqual(["marcar", "mudou", "publicar"]);
    expect(yml.match(/contents: write/g)?.length).toBe(1);
    expect(t.marcar).toMatch(/permissions:\n\s+contents: write/);
    expect(t.marcar).not.toMatch(/uses:|npm |npx |pnpm |install|secrets\./);
    for (const nome of ["mudou", "publicar"]) expect(t[nome]).not.toMatch(/permissions:/);
  });

  it("os checkouts não guardam as credenciais", () => {
    const checkouts = yml.match(/uses: actions\/checkout@/g) ?? [];
    expect(checkouts.length).toBe(2);
    expect(yml.match(/persist-credentials: false/g)?.length).toBe(checkouts.length);
  });

  it("o eas-cli numa versão fixa, nunca @latest", () => {
    expect(bruto).not.toMatch(/@latest/);
    expect(yml).toMatch(/^ {2}EAS_CLI: eas-cli@\d+\.\d+\.\d+$/m);
    // Cada chamada ao eas-cli passa pela versão fixa.
    expect(yml.replace(/EAS_CLI: eas-cli@\d+\.\d+\.\d+/, "")).not.toMatch(/eas-cli/);
    expect(yml.match(/npx --yes "\$EAS_CLI" update/g)?.length).toBe(2);
  });

  it("as acções por SHA, com a versão em comentário", () => {
    const usos = [...yml.matchAll(/uses:\s*(\S+)(.*)$/gm)];
    expect(usos.length).toBeGreaterThanOrEqual(4);
    for (const [, accao, resto] of usos) {
      expect(accao, accao).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(resto.trim(), accao).toMatch(/^# v\d+\.\d+\.\d+$/);
    }
  });

  it("o «Run» à mão só corre na main", () => {
    const se = trabalhos().mudou.match(/^ {4}if: (.*)$/m)?.[1] ?? "";
    expect(se).toMatch(/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
    // E nenhum outro caminho deixa o dispatch passar sem a main.
    expect(se.match(/workflow_dispatch/g)?.length).toBe(1);
    const t = trabalhos();
    expect(t.publicar).toMatch(/needs: mudou/);
    expect(t.marcar).toMatch(/needs: \[mudou, publicar\]/);
  });

  it("o segredo vem do ambiente app-cliente e só entra no trabalho «publicar»", () => {
    const t = trabalhos();
    expect(t.publicar).toMatch(/^ {4}environment: app-cliente$/m);
    expect(t.mudou).not.toMatch(/secrets\.|environment:/);
    expect(t.marcar).not.toMatch(/secrets\.|environment:/);
    // Só como variável de um passo, nunca no env do trabalho ou do workflow.
    for (const m of yml.matchAll(/^( *)EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}$/gm)) expect(m[1].length).toBe(10);
  });
});
