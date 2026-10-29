import { describe, it, expect } from "vitest";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";

import sitemap from "@/app/sitemap";
import nextConfig from "../../next.config";
import { BLOG_POSTS } from "./blog-data";
import { caminhoDoServicoNaCidade } from "./caminho-da-cidade";
import { LOCALIDADES_DO_CONCELHO, localidadesDaPagina } from "./localidades-dos-concelhos";
import { CIDADES_MUDANCAS, getAllCidadeSlugs } from "./mudancas-cidades";
import {
  SERVICOS_DAS_PAGINAS_DE_TERRA,
  TERRAS_JUNTAS_AO_CONCELHO,
} from "./paginas-consolidadas";
import { PROMESSA_DO_PRAZO } from "./promessas-publicas";
import {
  CIDADES_COM_PAGINA,
  CITIES,
  REGIONS,
  SERVICES,
  SITE_URL,
  getAllCityServiceSlugs,
  getRegionCities,
  getRelatedCities,
} from "./seo-data";

/**
 * NENHUM 301 DE UMA PÁGINA DE CIDADE SEM ESTAR NESTA LISTA — 28-10-2026 (d13).
 *
 * Uma página de cidade com cliques que leva um 301 perde-os. A regra do plano
 * de 28-10: só leva 301 a página de uma localidade com poucos cliques, sem
 * cliques na pesquisa com o nome dela, e só depois de a página do concelho
 * ter uma secção sobre ela. Quem decide é o dono, uma página de cada vez.
 *
 * Por isso a lista é FECHADA e escrita à mão: um redirect novo de uma página
 * de cidade (`/<serviço>-<terra>` ou `/mudancas/<terra>`), venha de onde vier,
 * chumba aqui até entrar nela — com a data da decisão.
 */
const APROVADOS_NA_D13: Readonly<Record<string, string>> = {
  "/recolha-moveis-amora": "/recolha-moveis-seixal",
  "/recolha-monos-amora": "/recolha-monos-seixal",
  "/recolha-entulho-amora": "/recolha-entulho-seixal",
  "/esvaziamento-casas-amora": "/esvaziamento-casas-seixal",
  "/mudancas/amora": "/mudancas/seixal",
  "/recolha-moveis-corroios": "/recolha-moveis-seixal",
  "/recolha-monos-corroios": "/recolha-monos-seixal",
  "/recolha-entulho-corroios": "/recolha-entulho-seixal",
  "/esvaziamento-casas-corroios": "/esvaziamento-casas-seixal",
  "/mudancas/corroios": "/mudancas/seixal",
  "/recolha-moveis-costa-da-caparica": "/recolha-moveis-almada",
  "/recolha-monos-costa-da-caparica": "/recolha-monos-almada",
  "/recolha-entulho-costa-da-caparica": "/recolha-entulho-almada",
  "/esvaziamento-casas-costa-da-caparica": "/esvaziamento-casas-almada",
  "/mudancas/costa-da-caparica": "/mudancas/almada",
};

/** Os que já existiam antes da d13 (29-09-2026 e antes), e porquê. */
const ANTERIORES: Readonly<Record<string, string>> = {
  // 29-09-2026: as geradas que tinham uma estática a dizer o mesmo.
  "/esvaziamento-casas-amadora": "/esvaziamento-de-casas-amadora",
  "/recolha-monos-amadora": "/recolha-de-monos-amadora",
  // Uma página antiga, de antes das páginas por cidade.
  "/recolha-moveis-parque-das-nacoes": "/recolha-moveis-lisboa",
};

/** O endereço de uma página de cidade — gerada pelo [...slug] ou de mudanças. */
const PAGINA_DE_CIDADE = new RegExp(
  `^/((${SERVICES.filter((s) => s.slug !== "mudancas")
    .map((s) => s.slug)
    .join("|")})-[a-z0-9-]+|mudancas/[a-z0-9-]+)$`,
);

type Regra = { source: string; destination: string; statusCode: number; regex: RegExp };

/** Os redirects do next.config, compilados como o Next os compila para a Vercel. */
async function regras(): Promise<Regra[]> {
  const redirects = await nextConfig.redirects!();
  return redirects.map((r) => {
    const feita = buildCustomRoute("redirect", r, ["/_next"]);
    return {
      source: r.source,
      destination: r.destination,
      statusCode: feita.statusCode ?? 0,
      regex: new RegExp(feita.regex, "i"),
    };
  });
}
const primeira = (todas: Regra[], caminho: string) => todas.find((r) => r.regex.test(caminho)) ?? null;

const GERADAS = new Set(getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`));
const MUDANCAS = new Set(getAllCidadeSlugs().map((c) => `/mudancas/${c}`));
const existe = (caminho: string) => GERADAS.has(caminho) || MUDANCAS.has(caminho);

describe("a lista fechada dos 301 de páginas de cidade", () => {
  it("a d13 tem 15, e cada terra tem as cinco páginas", () => {
    expect(Object.keys(APROVADOS_NA_D13)).toHaveLength(15);
    for (const terra of Object.keys(TERRAS_JUNTAS_AO_CONCELHO)) {
      expect(Object.keys(APROVADOS_NA_D13).filter((o) => o.endsWith(`-${terra}`) || o.endsWith(`/${terra}`)), terra)
        .toHaveLength(5);
    }
  });

  it("os redirects de páginas de cidade são exactamente os da lista — nem um a mais", async () => {
    const deCidade = Object.fromEntries(
      (await nextConfig.redirects!())
        .filter((r) => PAGINA_DE_CIDADE.test(r.source))
        .map((r) => [r.source, r.destination]),
    );
    expect(deCidade).toEqual({ ...ANTERIORES, ...APROVADOS_NA_D13 });
  });

  it("os serviços das páginas de terra são os de SERVICES sem as mudanças", () => {
    expect([...SERVICOS_DAS_PAGINAS_DE_TERRA].sort()).toEqual(
      SERVICES.filter((s) => s.slug !== "mudancas").map((s) => s.slug).sort(),
    );
  });
});

describe("cada um dos 15 vai num salto só para uma página que fica", () => {
  it("permanente, directo e para uma página gerada", async () => {
    const todas = await regras();
    for (const [origem, destino] of Object.entries(APROVADOS_NA_D13)) {
      const regra = primeira(todas, origem);
      expect(regra?.destination, origem).toBe(destino);
      expect(regra?.statusCode, origem).toBe(308);
      expect(primeira(todas, destino), `${origem} → ${destino}`).toBeNull();
      expect(existe(destino), destino).toBe(true);
      // A página antiga deixou de ser gerada.
      expect(existe(origem), origem).toBe(false);
    }
  });

  it("os endereços antigos de cada terra vão directos ao concelho, sem passar pela terra", async () => {
    const todas = await regras();
    for (const [terra, concelho] of Object.entries(TERRAS_JUNTAS_AO_CONCELHO)) {
      const esperado: Record<string, string> = {
        [`/mudancas-${terra}`]: `/mudancas/${concelho}`,
        [`/mudan%C3%A7as-${terra}`]: `/mudancas/${concelho}`,
        [`/mudan%c3%a7as-${terra}`]: `/mudancas/${concelho}`,
        [`/camiao-com-motorista-${terra}`]: `/mudancas/${concelho}`,
        [`/limpeza-pos-obra-${terra}`]: `/recolha-entulho-${concelho}`,
      };
      for (const [origem, destino] of Object.entries(esperado)) {
        expect(primeira(todas, origem)?.destination, origem).toBe(destino);
        expect(primeira(todas, destino), `${origem} → ${destino}`).toBeNull();
        expect(existe(destino), destino).toBe(true);
      }
    }
  });

  it("o sitemap deixa de os ter, e tem as 10 páginas que ficam", async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const [origem, destino] of Object.entries(APROVADOS_NA_D13)) {
      expect(urls.has(`${SITE_URL}${origem}`), origem).toBe(false);
      expect(urls.has(`${SITE_URL}${destino}`), destino).toBe(true);
    }
  }, 120_000);
});

describe("sem casa nova, não há 301", () => {
  it("cada endereço da d13 tem a sua secção na página para onde vai", () => {
    for (const [origem, destino] of Object.entries(APROVADOS_NA_D13)) {
      const seccoes = localidadesDaPagina(destino);
      expect(seccoes.map((l) => l.enderecoAntigo), `${origem} em ${destino}`).toContain(origem);
    }
    // E nenhuma secção fala de um endereço que não está na lista.
    for (const [pagina, seccoes] of Object.entries(LOCALIDADES_DO_CONCELHO)) {
      for (const l of seccoes) expect(APROVADOS_NA_D13[l.enderecoAntigo], l.enderecoAntigo).toBe(`/${pagina}`);
    }
  });

  it("as secções têm 80 a 150 palavras, a promessa do prazo e o IVA ao lado de cada preço", () => {
    for (const seccoes of Object.values(LOCALIDADES_DO_CONCELHO)) {
      for (const l of seccoes) {
        const palavras = l.texto.split(/\s+/).filter(Boolean).length;
        expect(palavras, l.titulo).toBeGreaterThanOrEqual(80);
        expect(palavras, l.titulo).toBeLessThanOrEqual(150);
        expect(l.texto, l.titulo).toContain(PROMESSA_DO_PRAZO);
        // Cada «€» seguido de «+ IVA» ou de «com IVA» (também à hora).
        expect(l.texto, l.titulo).not.toMatch(/€(?!(\/h)? (\+ IVA|com IVA))/);
        expect(l.titulo, l.titulo).toContain(l.nome);
        if (l.ligacao) {
          expect(l.texto, l.titulo).toContain(l.ligacao.texto);
          expect(existe(l.ligacao.href) || l.ligacao.href.startsWith("/blog/"), l.ligacao.href).toBe(true);
        }
      }
    }
  });

  it("as duas rotas mostram as secções", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/app/[...slug]/page.tsx")).toMatch(/localidadesDaPagina\(getCityServiceSlug\(service\.slug, city\.slug\)\)/);
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toMatch(/localidadesDaPagina\(`mudancas\/\$\{c\.slug\}`\)/);
  });
});

describe("nenhuma ligação interna para as terras juntas", () => {
  const TERRAS = Object.keys(TERRAS_JUNTAS_AO_CONCELHO);

  it("as terras continuam em CITIES — saem as páginas, não as cidades", () => {
    for (const t of TERRAS) expect(CITIES.map((c) => c.slug), t).toContain(t);
    for (const t of TERRAS) expect(CIDADES_COM_PAGINA.map((c) => c.slug), t).not.toContain(t);
    for (const t of TERRAS) expect(CIDADES_MUDANCAS.map((c) => c.slug), t).not.toContain(t);
  });

  it("as vizinhas e as regiões não as mostram", () => {
    for (const c of CITIES) {
      for (const v of getRelatedCities(c.slug, 4)) {
        expect(TERRAS, `${c.slug} → ${v.slug}`).not.toContain(v.slug);
        expect(v.slug, c.slug).not.toBe(c.slug);
      }
    }
    for (const r of REGIONS) {
      for (const c of getRegionCities(r.slug)) expect(TERRAS, r.slug).not.toContain(c.slug);
    }
    for (const c of CIDADES_MUDANCAS) {
      for (const v of c.cidadesVizinhas) expect(TERRAS, `${c.slug} → ${v}`).not.toContain(v);
    }
  });

  it("o caminho de um serviço numa terra junta já é o do concelho", () => {
    for (const c of CITIES) {
      for (const s of SERVICES) {
        const caminho = caminhoDoServicoNaCidade(s.slug, c.slug);
        expect(APROVADOS_NA_D13[caminho], `${s.slug} · ${c.slug} → ${caminho}`).toBeUndefined();
        expect(ANTERIORES[caminho], `${s.slug} · ${c.slug} → ${caminho}`).toBeUndefined();
      }
    }
    expect(caminhoDoServicoNaCidade("mudancas", "amora")).toBe("/mudancas/seixal");
    expect(caminhoDoServicoNaCidade("mudancas", "costa-da-caparica")).toBe("/mudancas/almada");
    expect(caminhoDoServicoNaCidade("recolha-monos", "corroios")).toBe("/recolha-monos-seixal");
  });

  it("o blog não liga a nenhum dos 15", () => {
    const texto = JSON.stringify(BLOG_POSTS);
    for (const origem of Object.keys(APROVADOS_NA_D13)) {
      expect(texto.includes(`](${origem})`), origem).toBe(false);
      expect(texto.includes(`"${origem}"`), origem).toBe(false);
    }
  });
});
