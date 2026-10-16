import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ÍNDICE DO BLOG NÃO DISPUTA AS PESQUISAS DAS PÁGINAS DE SERVIÇO — 16-10-2026.
 *
 * No Search Console (3 meses até 12/10), /blog tinha 7,4 mil impressões, e as
 * pesquisas que o levavam eram «recolha gratuita de móveis usados lisboa»,
 * «doar móveis usados», «doação de móveis usados»… — as da página
 * /recolha-gratuita-de-moveis-usados. A causa: cada cartão do índice mostrava
 * quatro etiquetas com as palavras-chave do artigo, e somadas faziam do índice
 * a página com mais dessas palavras no site. Fica o tema de cada artigo.
 */

const INDICE = readFileSync(join(process.cwd(), "src/app/blog/page.tsx"), "utf8");
const semComentarios = (t: string) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o índice do blog", () => {
  it("não mostra as palavras-chave dos artigos", () => {
    expect(semComentarios(INDICE)).not.toMatch(/post\.keywords/);
  });

  it("mostra o tema de cada artigo, e continua a ligar à página de doar", () => {
    expect(INDICE).toContain("{post.category}");
    expect(INDICE).toContain('href="/recolha-gratuita-de-moveis-usados"');
  });
});
