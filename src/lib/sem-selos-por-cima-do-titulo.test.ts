import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * SEM O SELO POR CIMA DO TÍTULO — 18-10-2026.
 *
 * *«Remova esse design de IA»* — o dono, com a captura do selo «✦ SOBRE A
 * CLYON»: a pílula com contorno, letras maiúsculas espaçadas e um ícone, logo
 * antes do <h1>. Estava em dez páginas. As etiquetas de categoria do FAQ e as
 * do painel não são selos de topo e ficam.
 */
const RAIZ = process.cwd();
const ficheiros: string[] = [];
const andar = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (n === "admin" || n === "painel") continue;
      andar(p);
    } else if (n.endsWith(".tsx")) ficheiros.push(p);
  }
};
andar(join(RAIZ, "src/app"));
andar(join(RAIZ, "src/components"));

const SELO_ANTES_DO_H1 =
  /<(div|p) className=(?:"[^"]*rounded-full border[^"]*uppercase[^"]*"|\{`[^`]*rounded-full border[^`]*uppercase[^`]*`\})>[\s\S]{0,300}?<\/\1>\s*<h1/;

describe("os títulos não têm selo por cima", () => {
  it("nenhuma página põe uma pílula maiúscula logo antes do <h1>", () => {
    expect(ficheiros.length).toBeGreaterThan(100);
    const maus = ficheiros
      .filter((f) => SELO_ANTES_DO_H1.test(readFileSync(f, "utf8").replace(/\r\n/g, "\n")))
      .map((f) => relative(RAIZ, f));
    expect(maus).toEqual([]);
  });

  it("o guarda reconhece o selo que saiu", () => {
    const antigo =
      '<p className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-acao">\n' +
      '  <Sparkles className="h-3.5 w-3.5" />\n  Sobre a CLYON\n</p>\n<h1 className="text-tinta">';
    expect(SELO_ANTES_DO_H1.test(antigo)).toBe(true);
  });
});
