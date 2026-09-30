import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import sitemap from "@/app/sitemap";
import nextConfig from "../../next.config";
import { artigosPublicados } from "./artigos-do-blog";
import { LOCALIDADES_SERVIDAS, PRESTADOR, validadeDoPreco } from "./dados-estruturados";
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
  getAllCityServiceSlugs,
  getRegionCities,
} from "./seo-data";
import { caminhoDoServicoNaCidade } from "./caminho-da-cidade";

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

describe("links internos: nenhum passa por um redirect", () => {
  /** Os caminhos estáticos de todos os `href` do site, sem query string. */
  function hrefsDoSite(): Array<{ ficheiro: string; caminho: string }> {
    const encontrados: Array<{ ficheiro: string; caminho: string }> = [];
    for (const f of [...fontes(join(process.cwd(), "src", "app")), ...fontes(join(process.cwd(), "src", "components"))]) {
      if (f.includes(`${join("src", "app", "api")}`) || f.includes(`${join("src", "app", "admin")}`)) continue;
      const codigo = semComentarios(readFileSync(f, "utf8"));
      for (const m of codigo.matchAll(/href(?:=|:\s*)\{?\s*["'`](\/[^"'`${}]*)["'`]/g)) {
        encontrados.push({ ficheiro: f.replace(process.cwd(), ""), caminho: m[1].split("?")[0].split("#")[0] });
      }
    }
    return encontrados;
  }

  it("nenhum href aponta para a origem de um redirect", async () => {
    // Cada um destes é um salto a mais para o Google e um sinal de que nós
    // próprios ainda usamos o endereço velho. /esvaziamento-casas estava em
    // quatro sítios, incluindo o hub de todas as páginas de cidade.
    const redirects = await nextConfig.redirects!();
    const exactos = new Set([
      ...redirects.filter((r) => !r.source.includes(":")).map((r) => r.source),
      // Redirects que vivem na própria página ou no middleware:
      "/esvaziamento-casas",
      "/auth",
      "/profissionais/login",
    ]);
    // Os apanha-tudo (`/camiao-com-motorista-:city(.*)`, e `:city*` antes do
    // Next 15.5) valem como prefixo: tudo o que comece assim redirecciona.
    const prefixos = redirects
      .map((r) => r.source.match(/^(.*?):[a-zA-Z]+(?:\(\.\*\)|\*)$/)?.[1])
      .filter((p): p is string => Boolean(p) && !p!.endsWith("/"));
    expect(prefixos).toContain("/camiao-com-motorista-");

    const hrefs = hrefsDoSite();
    expect(hrefs.length).toBeGreaterThan(100);
    const maus = hrefs.filter(
      ({ caminho }) => exactos.has(caminho) || prefixos.some((p) => caminho.startsWith(p)),
    );
    expect(maus).toEqual([]);
  });

  it("o /conta leva nofollow onde aparece — para quem não tem sessão é um 307", () => {
    const nav = semComentarios(ler("src/components/MobileBottomNav.tsx"));
    expect(nav).toMatch(/href: "\/conta",[^}]*rel: "nofollow"/);
    expect(nav).toContain("rel={rel}");
    const header = semComentarios(ler("src/components/Header.tsx"));
    const links = header.match(/href="\/conta"/g) ?? [];
    const comNofollow = header.match(/href="\/conta"\s*\r?\n\s*rel="nofollow"/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(comNofollow.length).toBe(links.length);
  });

  it("a âncora para a página da recolha gratuita diz o que lá está", () => {
    const maus: string[] = [];
    for (const f of [...fontes(join(process.cwd(), "src", "app")), ...fontes(join(process.cwd(), "src", "components"))]) {
      const codigo = semComentarios(readFileSync(f, "utf8"));
      for (const m of codigo.matchAll(/href: "\/recolha-gratuita-de-moveis-usados", label: "([^"]+)"/g)) {
        // Desde 30-09-2026 a página responde a quem quer doar: a âncora diz isso.
        if (m[1] !== "Doar móveis usados") maus.push(`${f.replace(process.cwd(), "")}: ${m[1]}`);
      }
    }
    expect(maus).toEqual([]);
    expect(ler("src/components/FurnitureSeoLinks.tsx")).toContain('label: "Doar móveis usados"');
  });
});

describe("dados estruturados: uma CLYON só, com o prestador por @id", () => {
  /** As páginas do site (sem API nem backoffice), sem comentários. */
  const paginasDoSite = () =>
    fontes(join(process.cwd(), "src", "app"))
      .filter((f) => !f.includes(join("src", "app", "api")) && !f.includes(join("src", "app", "admin")))
      .map((f) => ({ f: f.replace(process.cwd(), "").split("\\").join("/"), codigo: semComentarios(readFileSync(f, "utf8")) }));

  it("só o layout declara o LocalBusiness da CLYON", () => {
    /*
     * Havia um por página de mudanças por cidade («CLYON — Mudanças em
     * Sintra», com morada em Sintra), um duplicado em /recolha-de-moveis com
     * horário das 19:00, e outros sem morada. O perfil de um profissional
     * declara o negócio DELE, e fica.
     */
    const comNegocio = paginasDoSite()
      .filter(({ codigo }) => /"@type":\s*(\[\s*)?"(LocalBusiness|HomeAndConstructionBusiness)"/.test(codigo))
      .map(({ f }) => f);
    expect(comNegocio.sort()).toEqual(["/src/app/layout.tsx", "/src/app/profissionais/[slug]/page.tsx"]);
  });

  it("todo o `provider` é a referência ao negócio do layout", () => {
    const maus: string[] = [];
    let vistos = 0;
    for (const { f, codigo } of paginasDoSite()) {
      if (f.endsWith("profissionais/[slug]/page.tsx")) continue;
      // Só onde há dados estruturados: a tabela de /cookies também tem um
      // campo `provider`, e é o fornecedor de cada cookie.
      if (!codigo.includes("https://schema.org")) continue;
      for (const m of codigo.matchAll(/provider:\s*([^,\r\n]+)/g)) {
        vistos++;
        if (m[1].trim() !== "PRESTADOR") maus.push(`${f}: provider: ${m[1].trim()}`);
      }
    }
    expect(vistos).toBeGreaterThan(15);
    expect(maus).toEqual([]);
    expect(PRESTADOR).toEqual({ "@id": "https://clyon.pt/#localbusiness" });
    expect(semComentarios(ler("src/app/layout.tsx"))).toContain('"@id": ID_DO_NEGOCIO');
  });

  it("o negócio descreve-se como plataforma, sem a limpeza pós-obra", () => {
    const layout = semComentarios(ler("src/app/layout.tsx"));
    expect(layout).toContain(
      "Plataforma que liga clientes a profissionais independentes e verificados de recolha de móveis, monos e entulho, esvaziamento de casas e mudanças em Lisboa, Margem Sul e Setúbal.",
    );
    const bloco = layout.slice(layout.indexOf("const localBusinessSchema"), layout.indexOf("const organizationSchema"));
    expect(bloco.length).toBeGreaterThan(100);
    expect(bloco).not.toMatch(/limpeza pós-obra/i);
  });

  it("a área servida inclui as localidades com página — e não as freguesias de Lisboa", () => {
    for (const terra of ["Lisboa", "Costa da Caparica", "Amora", "Corroios", "Alcochete", "Setúbal"]) {
      expect(LOCALIDADES_SERVIDAS, terra).toContain(terra);
    }
    for (const freguesia of ["Benfica", "Lumiar", "Alvalade", "Olivais"]) {
      expect(LOCALIDADES_SERVIDAS, freguesia).not.toContain(freguesia);
    }
    expect(semComentarios(ler("src/app/layout.tsx"))).toContain("areaServed: LOCALIDADES_SERVIDAS.map(");
  });

  it("o horário é o mesmo em todo o lado: 08:00–20:00", () => {
    const horarios = paginasDoSite().flatMap(({ f, codigo }) =>
      [...codigo.matchAll(/closes:\s*"([^"]+)"/g)].map((m) => `${f}: ${m[1]}`),
    );
    expect(horarios.length).toBeGreaterThan(0);
    expect(horarios.filter((h) => !h.endsWith(": 20:00"))).toEqual([]);
  });

  it("nenhum preço declarado caduca: a validade é calculada", () => {
    const aMao = paginasDoSite().filter(({ codigo }) => /priceValidUntil:\s*["'`]/.test(codigo));
    expect(aMao.map(({ f }) => f)).toEqual([]);
    expect(validadeDoPreco(new Date("2026-09-29T12:00:00Z"))).toBe("2027-12-31");
  });

  it("/avaliacoes não declara nota nem avaliações", () => {
    const pagina = semComentarios(ler("src/app/avaliacoes/page.tsx"));
    expect(pagina).not.toContain("aggregateRating");
    expect(pagina).not.toMatch(/"@type":\s*"Review"/);
  });
});

describe("o que vai para o browser", () => {
  it("seo-data.ts não arrasta as cidades de mudanças para os componentes de cliente", () => {
    // O Header, o rodapé e o CTABlock importam seo-data; `caminhoDoServicoNaCidade`
    // precisa das cidades de mudanças (com os textos todos) e por isso vive
    // em caminho-da-cidade.ts, que só as páginas do servidor importam.
    const seoData = semComentarios(ler("src/lib/seo-data.ts"));
    expect(seoData).not.toContain("mudancas-cidades");
    expect(seoData).not.toContain("export function caminhoDoServicoNaCidade");
    for (const cliente of ["src/components/Header.tsx", "src/components/Footer.tsx", "src/components/CTABlock.tsx"]) {
      expect(semComentarios(ler(cliente)), cliente).not.toContain("caminho-da-cidade");
    }
  });
});
