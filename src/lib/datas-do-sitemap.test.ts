import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEUDO_DATAS } from "./conteudo-datas.generated";

/**
 * O `lastmod` DO SITEMAP ACOMPANHA O CONTEÚDO — 07-10-2026.
 *
 * As páginas das cidades mudaram de título, de descrição e de texto a
 * 30-09-2026, e o sitemap continuou a dizer ao Google que não mudavam desde
 * 29 de Julho: o título e a descrição tinham passado a viver em
 * `titulos-seo.ts` e `descricoes-seo.ts`, que o gerador das datas não
 * conhecia. Várias páginas de serviço do sitemap também não estavam em grupo
 * nenhum.
 *
 * O gerador (`scripts/gerar-datas-conteudo.mjs`) continua a ser corrido à mão
 * — a Vercel não tem o histórico do git. O que estes testes garantem é que
 * cada página do sitemap tem quem lhe mexa na data.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const GERADOR = ler("scripts/gerar-datas-conteudo.mjs");
const SITEMAP = ler("src/app/sitemap.ts");

/** Os caminhos de um grupo, como estão escritos no gerador. */
function grupo(nome: string): string[] {
  const i = GERADOR.indexOf(`  ${nome}: [`);
  const fim = GERADOR.indexOf("\n  ],", i);
  return [...GERADOR.slice(i, fim).matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1]);
}

describe("cada página do sitemap tem quem lhe mexa na data", () => {
  it("as estáticas estão todas no grupo delas", () => {
    const estaticas = grupo("estaticas");
    const inicio = SITEMAP.indexOf("const staticPages");
    const fim = SITEMAP.indexOf("export default async function sitemap");
    const caminhos = [...SITEMAP.slice(inicio, fim).matchAll(/url: `\$\{SITE_URL\}([^`]*)`/g)].map((m) => m[1]);
    expect(caminhos.length).toBeGreaterThan(20);

    const semGrupo = caminhos.filter((c) => {
      // As regiões têm grupo próprio.
      if (c === "/regioes") return !grupo("regioes").includes("src/app/regioes/page.tsx");
      if (c === "") return !estaticas.includes("src/app/page.tsx");
      return !estaticas.some((f) => f === `src/app${c}` || f === `src/app${c}/page.tsx` || `src/app${c}`.startsWith(`${f}/`));
    });
    expect(semGrupo).toEqual([]);
  });

  it("as das cidades contam com o título, a descrição e o preço", () => {
    const cidades = grupo("cidadeServico");
    for (const f of ["src/lib/titulos-seo.ts", "src/lib/descricoes-seo.ts", "src/lib/precos-publicos.ts", "src/app/[...slug]/page.tsx"]) {
      expect(cidades, f).toContain(f);
    }
  });

  it("as datas geradas são datas, e nenhuma está no futuro", () => {
    for (const [grupoNome, iso] of Object.entries(CONTEUDO_DATAS)) {
      const d = new Date(iso);
      expect(Number.isNaN(d.getTime()), grupoNome).toBe(false);
      expect(d.getTime(), grupoNome).toBeLessThanOrEqual(Date.now());
    }
  });
});
