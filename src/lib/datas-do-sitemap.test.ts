import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { ACTUALIZADO_EM } from "./datas-das-paginas";
import { REGIONS, SITE_URL, getAllCityServiceSlugs } from "./seo-data";
import { getAllCidadeSlugs } from "./mudancas-cidades";

/**
 * O `lastmod` DO SITEMAP SÓ DIZ DATAS VERDADEIRAS — 28-10-2026 (d1).
 *
 * Foi a data do build; depois a do git por grupos (07-10-2026), que dava a
 * mesma data a 145 páginas porque um botão no modelo das cidades as
 * carimbava todas. Uma análise de fora leu-o como carimbo. Agora:
 *   · artigos do blog → a data deles;
 *   · perfis dos profissionais → a última mudança na base;
 *   · páginas de ACTUALIZADO_EM (datas-das-paginas.ts) → o dia em que o texto
 *     mudou, escrito à mão por quem o mudou;
 *   · as outras → sem `lastmod`.
 * Nem o build nem o git: a Vercel clona sem histórico.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const SITEMAP = ler("src/app/sitemap.ts");

describe("o lastmod do sitemap", () => {
  it("não vem do git nem do build", () => {
    expect(existsSync(join(process.cwd(), "src/lib/conteudo-datas.generated.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "scripts/gerar-datas-conteudo.mjs"))).toBe(false);
    expect(SITEMAP).not.toContain("conteudo-datas");
    expect(SITEMAP).not.toMatch(/new Date\(\)/);
    expect(SITEMAP).toContain('from "@/lib/datas-das-paginas"');
  });

  it("as páginas de cidade, de mudanças por cidade e das regiões não levam data", async () => {
    const geradas = new Set([
      ...getAllCityServiceSlugs().map(({ slug }) => `${SITE_URL}/${slug.join("/")}`),
      ...getAllCidadeSlugs().map((s) => `${SITE_URL}/mudancas/${s}`),
      ...REGIONS.map((r) => `${SITE_URL}/regioes/${r.slug}`),
    ]);
    const entradas = (await sitemap()).filter((e) => geradas.has(e.url));
    expect(entradas.length).toBeGreaterThan(100);
    expect(entradas.filter((e) => e.lastModified).map((e) => e.url)).toEqual([]);
  }, 30_000);

  it("nenhuma data se repete por mais de 40 endereços", async () => {
    // Era o sintoma: 145 com o mesmo lastmod. Uma data verdadeira pode repetir-se
    // (um dia de muitas mudanças), mas não em centenas de páginas.
    const contagem = new Map<string, number>();
    for (const e of await sitemap()) {
      if (!e.lastModified) continue;
      const d = new Date(e.lastModified as Date).toISOString().slice(0, 10);
      contagem.set(d, (contagem.get(d) ?? 0) + 1);
    }
    for (const [d, n] of contagem) expect(n, d).toBeLessThanOrEqual(40);
  }, 30_000);

  it("cada data da lista é uma data, nenhuma no futuro, e cada página está no sitemap", async () => {
    const urls = new Set((await sitemap()).map((e) => e.url.slice(SITE_URL.length) || "/"));
    for (const [caminho, dia] of Object.entries(ACTUALIZADO_EM)) {
      expect(dia, caminho).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${dia}T00:00:00Z`).getTime(), caminho).toBeLessThanOrEqual(Date.now());
      expect(urls.has(caminho), `${caminho} não está no sitemap`).toBe(true);
    }
  }, 30_000);

  it("as páginas legais têm a data que dizem no texto", () => {
    const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    for (const [caminho, ficheiro] of [
      ["/termos", "src/app/termos/page.tsx"],
      ["/privacidade", "src/app/privacidade/page.tsx"],
      ["/cookies", "src/app/cookies/page.tsx"],
    ] as const) {
      const [a, m, d] = ACTUALIZADO_EM[caminho].split("-").map(Number);
      expect(ler(ficheiro), caminho).toContain(`Última atualização: ${d} de ${MESES[m - 1]} de ${a}.`);
    }
  });
});
