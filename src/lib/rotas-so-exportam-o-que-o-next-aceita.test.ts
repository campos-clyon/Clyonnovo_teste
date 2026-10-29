import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * UM route.ts SÓ EXPORTA O QUE O NEXT ACEITA — 29-10-2026.
 *
 * Uma constante exportada de uma rota (`export const A_ESPERA_DA_MESA`)
 * compila no tsc e passa nos testes, mas parte o `next build` na Vercel — e o
 * deploy falha calado até alguém ver o status do commit. Os textos e as
 * funções partilhadas vivem em `src/lib`.
 */
const PERMITIDOS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
  "runtime", "dynamic", "revalidate", "maxDuration", "fetchCache", "preferredRegion", "dynamicParams",
  "generateStaticParams",
]);

function rotas(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...rotas(caminho));
    else if (nome === "route.ts" || nome === "route.tsx") saida.push(caminho);
  }
  return saida;
}

describe("as rotas do Next", () => {
  it("nenhum route.ts exporta outra coisa que não os métodos e as definições da rota", () => {
    const erradas: string[] = [];
    for (const f of rotas(join(process.cwd(), "src/app"))) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/^export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
        if (!PERMITIDOS.has(m[1])) erradas.push(`${f.replace(process.cwd(), "")}: ${m[1]}`);
      }
      for (const m of s.matchAll(/^export\s*\{([^}]*)\}/gm)) {
        for (const nome of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!).filter(Boolean)) {
          if (!PERMITIDOS.has(nome)) erradas.push(`${f.replace(process.cwd(), "")}: ${nome}`);
        }
      }
    }
    expect(erradas).toEqual([]);
  });
});
