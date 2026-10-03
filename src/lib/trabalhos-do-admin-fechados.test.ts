import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A GALERIA DO BACKOFFICE DEIXA DE SE LER SEM SESSÃO.
 *
 * O GET de /api/admin/trabalhos (e o de /api/admin/trabalhos/[id]) era
 * público "porque a galeria do site o consome" — e não consumia: o site lê os
 * publicados directamente. Devolvia a toda a gente os trabalhos por publicar.
 * E o painel não mandava o token em chamada nenhuma: a escrita dava 401.
 */

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

function doGet(fonte: string): string {
  const i = fonte.indexOf("export async function GET");
  expect(i).toBeGreaterThan(-1);
  const fim = fonte.indexOf("export async function", i + 10);
  return fonte.slice(i, fim > -1 ? fim : undefined);
}

function ficheiros(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe("as rotas de leitura pedem administrador", () => {
  it("a lista e o trabalho pelo número", () => {
    for (const rota of [
      "src/app/api/admin/trabalhos/route.ts",
      "src/app/api/admin/trabalhos/[id]/route.ts",
    ]) {
      expect(doGet(lerNu(rota)), rota).toContain("await requireAdmin(request)");
    }
  });

  it("o site público não passa por elas", () => {
    const quemChama = ficheiros(join(process.cwd(), "src"))
      .filter((f) => !/[\\/]admin[\\/]/.test(f))
      /*
       * A rota dos trabalhos, e não a dos Trabalhos CLYON — 03-10-2026. A
       * lista das permissões do assistente (`papel-do-painel.ts`, fora de
       * /admin/) passou a nomear «/api/admin/trabalhos-clyon», que é outra
       * rota e não é chamada pelo site público.
       */
      .filter((f) => /\/api\/admin\/trabalhos(?![-\w])/.test(readFileSync(f, "utf8")));
    expect(quemChama).toEqual([]);
    expect(lerNu("src/app/trabalhos/page.tsx")).toContain("listTrabalhos({ publicadoOnly: true })");
  });
});

describe("o painel identifica-se em todas as chamadas", () => {
  it("cada fetch leva o cabeçalho da sessão", () => {
    const PAINEL = lerNu("src/app/admin/trabalhos/AdminTrabalhosClient.tsx");
    const chamadas = PAINEL.match(/fetch\(/g)?.length ?? 0;
    const comSessao = PAINEL.match(/headers:\s*comSessao\(/g)?.length ?? 0;
    expect(chamadas).toBeGreaterThanOrEqual(6);
    expect(comSessao).toBe(chamadas);
    expect(PAINEL).toContain('getColaboradorItem("token")');
  });
});
