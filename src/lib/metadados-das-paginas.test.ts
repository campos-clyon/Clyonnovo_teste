import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Metadata } from "next";

import sitemap from "@/app/sitemap";
import { artigosPublicados } from "./artigos-do-blog";
import { LIMITE_DA_DESCRICAO, descricaoQueCabe, tamanho } from "./descricoes-seo";
import { getAllCityServiceSlugs } from "./seo-data";
import { IMAGEM_DE_PARTILHA, og } from "./open-graph";

/**
 * OS METADADOS DE TODAS AS PÁGINAS PÚBLICAS, LIDOS COMO O NEXT OS LÊ.
 *
 * Os outros testes de SEO deste repositório lêem o código como texto, e isso
 * não chega para metadados: o título de uma página de cidade é montado por
 * uma função, a description leva preços e prazos de constantes, e o que o
 * Google recebe é o resultado. A 29-09-2026 havia duas páginas com o mesmo
 * título palavra por palavra (/recolha-de-monos e /recolha-monos-lisboa),
 * treze com a marca duas vezes («… | CLYON | CLYON») e 144 descriptions
 * acima do que o Google mostra — nenhuma delas visível a ler o ficheiro.
 *
 * Aqui importa-se cada página pública (as geradas também, pelos
 * `generateStaticParams`) e mede-se o que ela declara.
 */

const APP = join(process.cwd(), "src", "app");

/**
 * Áreas que não são para o Google: backoffice, rotas de API, a conta e as
 * entradas, os links com token e o que está atrás do portão do MVP. O perfil
 * público de um profissional vem da base e tem os seus próprios testes.
 */
const PRIVADAS = ["admin", "api", "auth", "conta", "entrar", "orcamento", "pedido", "plataforma", "profissionais"];

/** Todos os page.tsx públicos, como caminhos relativos a src/app. */
function paginasPublicas(dir = APP, achadas: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (dir === APP && PRIVADAS.includes(nome)) continue;
      paginasPublicas(caminho, achadas);
    } else if (nome === "page.tsx") {
      achadas.push(relative(APP, caminho).split(sep).join("/"));
    }
  }
  return achadas;
}

type Entrada = { rota: string; meta: Metadata };

/** O endereço de uma página, com os parâmetros de `generateStaticParams`. */
function rotaDe(ficheiro: string, params: Record<string, string | string[]>): string {
  const segmentos = ficheiro.replace(/(^|\/)page\.tsx$/, "").split("/").filter(Boolean);
  const partes = segmentos.map((s) => {
    const catchAll = s.match(/^\[\.\.\.(\w+)\]$/);
    if (catchAll) return ([] as string[]).concat(params[catchAll[1]]).join("/");
    const dinamico = s.match(/^\[(\w+)\]$/);
    if (dinamico) return String(params[dinamico[1]]);
    return s;
  });
  return `/${partes.join("/")}`;
}

/** O título tal como sai no <title>, com o template do layout. */
function tituloFinal(t: Metadata["title"]): string {
  if (!t) return "";
  if (typeof t === "string") return `${t} | CLYON`;
  if ("absolute" in t && t.absolute) return t.absolute;
  if ("default" in t && t.default) return `${t.default} | CLYON`;
  return "";
}

const indexavel = (m: Metadata) => {
  const r = m.robots;
  if (!r) return true;
  if (typeof r === "string") return !r.includes("noindex");
  return r.index !== false;
};

let PAGINAS: Entrada[] = [];

/*
 * Importar quarenta páginas custa: sozinho, este ficheiro corre em 2 a 4 s;
 * no meio da suite inteira, com os outros ficheiros a transformar código ao
 * mesmo tempo, chegou aos 105 s. Os imports vão em paralelo e o prazo do
 * `beforeAll` é largo de propósito — um teste que chumba por lentidão da
 * máquina não diz nada sobre os metadados.
 */
beforeAll(async () => {
  const entradas: Entrada[] = [];
  const ficheiros = paginasPublicas();
  const modulos = await Promise.all(ficheiros.map((f) => import(/* @vite-ignore */ join(APP, f))));
  for (const [i, ficheiro] of ficheiros.entries()) {
    const mod = modulos[i];
    const temMeta = typeof mod.generateMetadata === "function" || mod.metadata;
    if (!temMeta) continue; // páginas que só redireccionam
    const dinamica = ficheiro.includes("[");
    const lista: Array<Record<string, string | string[]>> = dinamica
      ? typeof mod.generateStaticParams === "function"
        ? await mod.generateStaticParams()
        : []
      : [{}];
    for (const params of lista) {
      const meta: Metadata =
        typeof mod.generateMetadata === "function"
          ? await mod.generateMetadata({ params: Promise.resolve(params) }, Promise.resolve({}))
          : mod.metadata;
      if (indexavel(meta)) entradas.push({ rota: rotaDe(ficheiro, params), meta });
    }
  }
  PAGINAS = entradas;
}, 600_000);

describe("os títulos", () => {
  it("encontra as páginas todas — as fixas e as geradas", () => {
    const rotas = PAGINAS.map((p) => p.rota);
    expect(rotas).toContain("/");
    expect(rotas).toContain("/recolha-de-monos");
    expect(rotas).toContain("/recolha-monos-lisboa");
    expect(rotas).toContain("/mudancas/sintra");
    expect(rotas).toContain("/regioes/margem-sul");
    expect(PAGINAS.length).toBeGreaterThan(150);
  });

  it("não há duas páginas com o mesmo título", () => {
    /*
     * /recolha-de-monos e /recolha-monos-lisboa diziam as duas «Recolha de
     * Monos em Lisboa — Sem Esperar a Câmara». Com o mesmo título para a
     * mesma pesquisa, o Google indexa uma e deixa a outra de fora — e os
     * sinais das duas ficam divididos.
     */
    const porTitulo = new Map<string, string[]>();
    for (const { rota, meta } of PAGINAS) {
      const t = tituloFinal(meta.title);
      porTitulo.set(t, [...(porTitulo.get(t) ?? []), rota]);
    }
    const repetidos = [...porTitulo.entries()].filter(([, rotas]) => rotas.length > 1);
    expect(repetidos).toEqual([]);
  });

  it("nenhum título leva a marca duas vezes", () => {
    // O template do layout acrescenta « | CLYON». Um título que já acabava
    // em «— CLYON» ou «| CLYON» saía no Google com a marca a dobrar.
    const dobrados = PAGINAS.map(({ rota, meta }) => ({ rota, t: tituloFinal(meta.title) })).filter(
      ({ t }) => /CLYON\s*(\|\s*CLYON)$/.test(t) || /(—|-|\|)\s*CLYON\s*\|\s*CLYON$/.test(t),
    );
    expect(dobrados).toEqual([]);
  });
});

describe("o canónico", () => {
  /** O caminho para onde o canónico de uma página aponta ("" se não tiver). */
  const canonicoDe = (m: Metadata): string => {
    const c = m.alternates?.canonical;
    const url = typeof c === "string" ? c : c instanceof URL ? c.href : c?.url ? String(c.url) : "";
    return url;
  };

  it("cada página pública declara o seu, absoluto e a apontar para si própria", () => {
    // O layout dava `canonical: SITE_URL` a quem não declarasse o seu. Saiu
    // de lá (29-09-2026), e por isso cada página pública tem de o ter.
    const maus = PAGINAS.map(({ rota, meta }) => ({ rota, canonico: canonicoDe(meta) })).filter(
      ({ rota, canonico }) => !canonico.startsWith("https://clyon.pt") || new URL(canonico).pathname !== rota,
    );
    expect(maus).toEqual([]);
  });

  it("o layout não dá canónico a ninguém", () => {
    /*
     * Com `alternates.canonical` no layout, o 404, o /entrar e o
     * /admin/login diziam ao Google que a versão a sério deles era a
     * homepage. Lê-se o ficheiro e não o módulo: o layout carrega as fontes
     * do next/font, que só existem dentro do build.
     */
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8")
      .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(layout).not.toMatch(/alternates\s*:/);
  });

  it("o 404 não tem canónico nenhum", async () => {
    const naoEncontrada = await import("@/app/not-found");
    expect(naoEncontrada.metadata.alternates).toBeUndefined();
    expect(naoEncontrada.metadata.robots).toMatchObject({ index: false });
  });
});

describe("o sitemap e as páginas dizem o mesmo", () => {
  /**
   * Páginas públicas e indexáveis que ficam de fora do sitemap de propósito:
   * as políticas legais. Estão abertas ao Google (e ligadas do rodapé), mas
   * não são páginas que se peça para rastrear.
   */
  const FORA_DE_PROPOSITO = ["/privacidade", "/cookies"];

  let urls: Awaited<ReturnType<typeof sitemap>> = [];
  beforeAll(async () => {
    urls = await sitemap();
  });

  it("cada endereço do sitemap é uma página pública, indexável e canónica", () => {
    // Um redirect, um 404 ou uma página noindex no sitemap ensinam o Google a
    // desconfiar dele todo. Os perfis dos profissionais vêm da base e têm os
    // seus próprios testes.
    const rotas = new Set(PAGINAS.map((p) => p.rota));
    const estranhos = urls
      .map((e) => new URL(e.url).pathname)
      .filter((c) => !c.startsWith("/profissionais/"))
      .filter((c) => !rotas.has(c));
    expect(estranhos).toEqual([]);
  });

  it("cada página pública e indexável está no sitemap", () => {
    // /como-funciona, /limpeza-de-quintais, /orcamento-recolha-lisboa e as
    // três de /servicos respondiam 200, com canónico próprio, e não estavam
    // lá (29-09-2026).
    const noSitemap = new Set(urls.map((e) => new URL(e.url).pathname));
    const esquecidas = PAGINAS.map((p) => p.rota).filter(
      (r) => !noSitemap.has(r) && !FORA_DE_PROPOSITO.includes(r),
    );
    expect(esquecidas).toEqual([]);
  });

  it("os artigos levam a data do último retoque, quando o houve", () => {
    for (const artigo of artigosPublicados()) {
      const entrada = urls.find((e) => e.url.endsWith(`/blog/${artigo.slug}`));
      expect(entrada, artigo.slug).toBeDefined();
      expect(new Date(String(entrada!.lastModified)).toISOString(), artigo.slug).toBe(
        new Date(artigo.updatedDate ?? artigo.publishDate).toISOString(),
      );
    }
  });
});

describe("as descriptions", () => {
  const descricaoDe = (m: Metadata) => (typeof m.description === "string" ? m.description : "");
  const ogDe = (m: Metadata) => {
    const d = m.openGraph?.description;
    return typeof d === "string" ? d : "";
  };

  it("cada página pública tem a sua", () => {
    const sem = PAGINAS.filter(({ meta }) => descricaoDe(meta).length === 0).map((p) => p.rota);
    expect(sem).toEqual([]);
  });

  it("nenhuma passa do que o Google mostra — e as geradas ficam nos 155", () => {
    /*
     * A 29-09-2026 eram 144 acima dos 160. As das páginas de cidade juntavam
     * as freguesias à frase e cortavam o conjunto aos 320: o Google mostrava
     * meia frase, e das mais importantes. As páginas fixas cabem em 160; as
     * que saem de `descricaoDaCidade` e das mudanças por cidade, em 155.
     */
    const DE_CIDADE = new Set(getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`));
    const geradas = (rota: string) => rota.startsWith("/mudancas/") || DE_CIDADE.has(rota);
    const compridas = PAGINAS.map(({ rota, meta }) => ({ rota, n: tamanho(descricaoDe(meta)), og: tamanho(ogDe(meta)) }))
      .filter(({ rota, n, og }) => n > (geradas(rota) ? LIMITE_DA_DESCRICAO : 160) || og > 160);
    expect(compridas).toEqual([]);
  });

  it("nenhuma é cortada a meio — acabam todas numa frase inteira", () => {
    const cortadas = PAGINAS.map(({ rota, meta }) => ({ rota, d: descricaoDe(meta) })).filter(
      ({ d }) => !/[.!?]$/.test(d.trim()),
    );
    expect(cortadas).toEqual([]);
  });

  it("não vendem o que a CLYON já não faz, nem falam da taxa", () => {
    // A limpeza pós-obra deixou de ser serviço; e desde 29-09-2026 o cliente
    // vê um preço por proposta já com a taxa — «+ 5 %» nos metadados seria
    // um segundo preço que a página já não mostra.
    const maus = PAGINAS.filter(({ meta }) => /pós-obra|taxa de \d/i.test(`${descricaoDe(meta)} ${ogDe(meta)}`)).map(
      (p) => p.rota,
    );
    expect(maus).toEqual([]);
  });
});

describe("descricaoQueCabe", () => {
  it("põe a primeira sempre, e as outras só inteiras", () => {
    expect(descricaoQueCabe(["Um.", "Dois.", "Três."], 10)).toBe("Um. Dois.");
    // A que não cabe fica de fora, e a seguinte, mais curta, ainda entra.
    expect(descricaoQueCabe(["Um.", "Uma frase comprida.", "Dois."], 10)).toBe("Um. Dois.");
    expect(descricaoQueCabe(["Só esta.", null, undefined], 5)).toBe("Só esta.");
  });

  it("conta caracteres como o Google, e não bytes", () => {
    expect(tamanho("é€")).toBe(2);
  });
});

describe("a partilha (Open Graph e Twitter)", () => {
  it("cada página com openGraph próprio leva a língua, o nome e a imagem", () => {
    /*
     * O Next junta os metadados por campo: um `openGraph` na página substitui
     * o do layout INTEIRO. As páginas davam título, descrição e endereço, e
     * perdiam o pt_PT, o siteName e a imagem sem ninguém dar por isso.
     */
    const maus: string[] = [];
    for (const { rota, meta } of PAGINAS) {
      const o = meta.openGraph as Record<string, unknown> | undefined;
      if (!o) continue;
      const imagens = o.images;
      if (o.locale !== "pt_PT") maus.push(`${rota}: locale ${String(o.locale)}`);
      if (o.siteName !== "CLYON") maus.push(`${rota}: siteName ${String(o.siteName)}`);
      if (!imagens || (Array.isArray(imagens) && imagens.length === 0)) maus.push(`${rota}: sem imagem`);
      if (typeof o.url !== "string" || new URL(o.url, "https://clyon.pt").pathname !== rota) {
        maus.push(`${rota}: og:url ${String(o.url)}`);
      }
    }
    expect(maus).toEqual([]);
    // E são praticamente todas: o helper não é opcional.
    expect(PAGINAS.filter((p) => p.meta.openGraph).length).toBeGreaterThan(140);
  });

  it("nenhuma página define um twitter próprio — o do layout chega", () => {
    // Um `twitter` na página substitui o do layout e perde a imagem; sem ele,
    // o Next preenche o título e a descrição com os do Open Graph.
    expect(PAGINAS.filter((p) => p.meta.twitter).map((p) => p.rota)).toEqual([]);
  });

  it("o layout não dá a ninguém o título, a descrição ou o endereço da homepage", () => {
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8")
      .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const bloco = (nome: string) => {
      const i = layout.indexOf(`${nome}: {`);
      expect(i, nome).toBeGreaterThan(-1);
      return layout.slice(i, layout.indexOf("},", i));
    };
    for (const nome of ["openGraph", "twitter"]) {
      const b = bloco(nome);
      expect(b, nome).not.toMatch(/\btitle:|\bdescription:|\burl: SITE_URL/);
      expect(b, nome).toContain("IMAGEM_DE_PARTILHA");
    }
  });

  it("og() completa o bloco com o que o site todo partilha", () => {
    const o = og({ title: "T", description: "D", url: "/x" }) as Record<string, unknown>;
    expect(o).toMatchObject({ title: "T", description: "D", url: "/x", locale: "pt_PT", siteName: "CLYON", type: "website" });
    expect(o.images).toEqual([IMAGEM_DE_PARTILHA]);
    expect(IMAGEM_DE_PARTILHA).toMatchObject({ url: "/og-image.jpg", width: 1200, height: 630 });
    const artigo = og({ title: "A", url: "/blog/a", type: "article", publishedTime: "2026-03-16" }) as Record<string, unknown>;
    expect(artigo).toMatchObject({ type: "article", publishedTime: "2026-03-16" });
  });
});
