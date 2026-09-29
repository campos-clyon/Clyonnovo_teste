import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import sitemap from "@/app/sitemap";
import nextConfig from "../../next.config";
import { artigosPublicados } from "./artigos-do-blog";
import { zonasDoArtigo } from "./blog-zonas";
import { getAllCidadeSlugs } from "./mudancas-cidades";
import {
  ARTIGOS_RETIRADOS,
  GERADAS_COM_PAGINA_ESTATICA,
  PAGINAS_FUNDIDAS,
} from "./paginas-consolidadas";
import {
  REGIONS,
  SERVICES,
  caminhoDoServicoNaCidade,
  getAllCityServiceSlugs,
  getRegionCities,
} from "./seo-data";

/**
 * SEO TÉCNICO — o que a revisão de 29-09-2026 corrigiu, e aqui fica preso.
 *
 * Cada bloco é um problema que o Google estava a ver: um redirect que
 * acabava em 404, um link interno que passava por um redirect, duas páginas
 * a disputar a mesma pesquisa. Nenhum deles dá erro no build — compilam,
 * respondem, e só se vêem no Search Console semanas depois.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** O código sem comentários: a explicação de porque é que algo saiu contém-no. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Onde o middleware manda um endereço — `null` se o deixa seguir. */
async function destinoNoMiddleware(caminho: string): Promise<{ status: number; para: string } | null> {
  const resposta = await middleware(new NextRequest(`https://clyon.pt${caminho}`));
  const para = resposta.headers.get("location");
  if (!para) return null;
  return { status: resposta.status, para: new URL(para).pathname };
}

/** As páginas que existem de facto (as geradas, as de mudanças e o balcão). */
const PAGINAS_DE_CIDADE = new Set([
  ...getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`),
  ...getAllCidadeSlugs().map((c) => `/mudancas/${c}`),
  "/mudancas",
]);

describe("mudanças: nenhum redirect acaba num 404", () => {
  it("o middleware lê as cidades da fonte — não há lista escrita à mão", () => {
    // Eram dezanove cidades escritas no middleware contra treze páginas: seis
    // redirects para 404 (almada, cascais, amadora, seixal, moita, setubal).
    const codigo = semComentarios(ler("src/middleware.ts"));
    expect(codigo).toContain('import { getAllCidadeSlugs } from "@/lib/mudancas-cidades"');
    expect(codigo).toContain("const MUDANCAS_CITIES_WITH_PAGE = getAllCidadeSlugs()");
    expect(codigo).not.toMatch(/"almada",\s*\r?\n/);
  });

  it("uma cidade sem página vai ao balcão geral, e não a /mudancas/<cidade>", async () => {
    for (const cidade of ["almada", "cascais", "amadora", "seixal", "moita", "setubal"]) {
      expect(getAllCidadeSlugs(), cidade).not.toContain(cidade);
      expect(await destinoNoMiddleware(`/mudancas-${cidade}`), cidade).toEqual({
        status: 301,
        para: "/mudancas",
      });
    }
  });

  it("uma cidade com página vai direita a ela", async () => {
    for (const cidade of getAllCidadeSlugs()) {
      expect(await destinoNoMiddleware(`/mudancas-${cidade}`), cidade).toEqual({
        status: 301,
        para: `/mudancas/${cidade}`,
      });
    }
  });

  it("o next.config também só redirecciona as cidades que têm página", async () => {
    const config = ler("next.config.ts");
    expect(config).toContain('...paraAsCidades("/mudancas-")');
    expect(config).not.toContain('source: "/mudancas-lisboa"');
    // A regra que importa: nenhum redirect aponta para uma página de cidade
    // que não existe — seja de que família for.
    const redirects = await nextConfig.redirects!();
    const paraCidades = redirects.filter((r) => r.destination.startsWith("/mudancas/"));
    expect(paraCidades.length).toBeGreaterThan(0);
    for (const r of paraCidades) {
      expect(PAGINAS_DE_CIDADE.has(r.destination), `${r.source} → ${r.destination}`).toBe(true);
    }
  });

  it("os links de serviço por região levam todos a uma página que existe", () => {
    // O cartão «Mudanças» da Margem Sul ligava a /mudancas-almada, e o de
    // Setúbal a /mudancas-setubal — dois 404 atrás de um redirect.
    for (const regiao of REGIONS) {
      const primeira = getRegionCities(regiao.slug)[0]?.slug ?? "lisboa";
      for (const servico of SERVICES) {
        const caminho = caminhoDoServicoNaCidade(servico.slug, primeira);
        expect(PAGINAS_DE_CIDADE.has(caminho), `${regiao.slug} · ${servico.slug} → ${caminho}`).toBe(true);
      }
    }
    expect(caminhoDoServicoNaCidade("mudancas", "almada")).toBe("/mudancas");
    expect(caminhoDoServicoNaCidade("mudancas", "lisboa")).toBe("/mudancas/lisboa");
  });

  it("a página da região não monta o endereço à mão", () => {
    const regiao = semComentarios(ler("src/app/regioes/[region]/page.tsx"));
    expect(regiao).not.toContain("`/${service.slug}-${");
    expect(regiao).toContain("caminhoDoServicoNaCidade(service.slug,");
  });
});

describe("redirects coerentes", () => {
  it("quem escreve «monos» vai à página dos monos, e não à dos móveis", async () => {
    const redirects = await nextConfig.redirects!();
    for (const origem of ["/monos", "/recolha-monos"]) {
      const r = redirects.find((x) => x.source === origem);
      expect(r?.destination, origem).toBe("/recolha-de-monos");
    }
  });

  it("/contacto é só o redirect do next.config — a página morta saiu", async () => {
    // Uma page.tsx com redirect("/contactos") que nunca corria: o redirect do
    // next.config vem primeiro. Era código a manter sem nada a fazer.
    expect(() => ler("src/app/contacto/page.tsx")).toThrow();
    const redirects = await nextConfig.redirects!();
    expect(redirects.find((x) => x.source === "/contacto")?.destination).toBe("/contactos");
  });
});

/** Todos os .ts/.tsx de uma pasta, sem os testes. */
function fontes(dir: string, encontrados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) fontes(caminho, encontrados);
    else if (/\.tsx?$/.test(nome) && !nome.endsWith(".test.ts")) encontrados.push(caminho);
  }
  return encontrados;
}

describe("páginas consolidadas: um endereço por pesquisa", () => {
  /** O que saiu → o que fica, tal como o Search Console o reportou. */
  const CONSOLIDADAS: Record<string, string> = {
    "/esvaziamento-casas-amadora": "/esvaziamento-de-casas-amadora",
    "/recolha-monos-amadora": "/recolha-de-monos-amadora",
    "/recolha-de-sofa-lisboa": "/recolha-de-sofas",
    "/blog/limpeza-pos-obra-e-retirada-de-residuos": "/recolha-de-entulho",
  };
  const QUE_SAIRAM = [
    ...Object.keys(GERADAS_COM_PAGINA_ESTATICA).map((s) => `/${s}`),
    ...Object.keys(PAGINAS_FUNDIDAS),
    ...Object.keys(ARTIGOS_RETIRADOS).map((s) => `/blog/${s}`),
  ];

  it("cada uma faz 301 para a página que fica", async () => {
    const redirects = await nextConfig.redirects!();
    for (const [de, para] of Object.entries(CONSOLIDADAS)) {
      const r = redirects.find((x) => x.source === de);
      expect(r?.destination, de).toBe(para);
      expect(r && "permanent" in r ? r.permanent : false, de).toBe(true);
    }
    expect(QUE_SAIRAM.sort()).toEqual(Object.keys(CONSOLIDADAS).sort());
  });

  it("e a página que fica existe mesmo", () => {
    for (const destino of Object.values(CONSOLIDADAS)) {
      expect(existsSync(join(process.cwd(), "src", "app", destino, "page.tsx")), destino).toBe(true);
    }
  });

  it("nenhuma das que saíram fica no sitemap — e as que ficam estão lá", async () => {
    const caminhos = (await sitemap()).map((e) => new URL(e.url).pathname);
    for (const saiu of QUE_SAIRAM) expect(caminhos, saiu).not.toContain(saiu);
    for (const fica of Object.values(CONSOLIDADAS)) expect(caminhos, fica).toContain(fica);
  });

  it("as geradas que saíram também não se geram no build", () => {
    const slugs = getAllCityServiceSlugs().map((e) => e.slug.join("/"));
    for (const s of Object.keys(GERADAS_COM_PAGINA_ESTATICA)) expect(slugs).not.toContain(s);
  });

  it("os links montados pela cidade vão direitos à que fica", () => {
    expect(caminhoDoServicoNaCidade("esvaziamento-casas", "amadora")).toBe("/esvaziamento-de-casas-amadora");
    expect(caminhoDoServicoNaCidade("recolha-monos", "amadora")).toBe("/recolha-de-monos-amadora");
    expect(caminhoDoServicoNaCidade("recolha-moveis", "amadora")).toBe("/recolha-moveis-amadora");
    const doBlog = zonasDoArtigo("esvaziamento-de-casas-com-recheio").zonas.map((z) => z.href);
    expect(doBlog).toContain("/esvaziamento-de-casas-amadora");
    expect(doBlog).not.toContain("/esvaziamento-casas-amadora");
  });

  it("e nenhum ficheiro do site escreve à mão o endereço que saiu", () => {
    // Um link para um 301 gasta rastreio e diz ao Google que nós próprios
    // ainda usamos o endereço velho. A única casa destes caminhos é a lista
    // que os redirecciona.
    const maus: string[] = [];
    for (const f of [...fontes(join(process.cwd(), "src", "app")), ...fontes(join(process.cwd(), "src", "components")), ...fontes(join(process.cwd(), "src", "lib"))]) {
      if (f.endsWith("paginas-consolidadas.ts")) continue;
      const codigo = semComentarios(readFileSync(f, "utf8"));
      for (const saiu of QUE_SAIRAM) {
        if (new RegExp(`["'\`]${saiu}["'\`]`).test(codigo)) maus.push(`${f.replace(process.cwd(), "")} → ${saiu}`);
      }
    }
    expect(maus).toEqual([]);
  });

  it("o artigo retirado sai da listagem, da página e dos relacionados", () => {
    expect(artigosPublicados().map((a) => a.slug)).not.toContain("limpeza-pos-obra-e-retirada-de-residuos");
    for (const f of ["src/app/blog/page.tsx", "src/app/blog/[slug]/page.tsx", "src/app/sitemap.ts"]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toContain("artigosPublicados()");
      expect(codigo, f).not.toContain("getAllBlogPosts");
      expect(codigo, f).not.toContain("getBlogPost(");
    }
  });
});
