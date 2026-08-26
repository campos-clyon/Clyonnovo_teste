import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getAllCityServiceSlugs } from "@/lib/seo-data";
import { zonasDoArtigo } from "@/lib/blog-zonas";

describe("robots.txt — o grupo específico não pode anular as restrições", () => {
  // Em robots.txt vence o grupo de user-agent mais específico, e um robô só
  // lê esse. Um grupo `Googlebot` com `Allow: /` e sem `Disallow` fazia o
  // Google ignorar a lista toda — e rastrear /api/, /_next/ e /auth.
  const r = robots();
  const regras = Array.isArray(r.rules) ? r.rules : [r.rules];

  it("há um único grupo, para não haver um mais específico a ganhar", () => {
    expect(regras).toHaveLength(1);
    expect(regras[0]?.userAgent).toBe("*");
  });

  it("nenhum grupo permite tudo sem restrições", () => {
    for (const regra of regras) {
      const bloqueado = regra?.disallow;
      const lista = Array.isArray(bloqueado) ? bloqueado : bloqueado ? [bloqueado] : [];
      expect(lista.length, `grupo ${String(regra?.userAgent)} sem disallow`).toBeGreaterThan(0);
    }
  });

  it("bloqueia o que queimava orçamento de rastreio", () => {
    const lista = regras[0]?.disallow as string[];
    // /colaboradores/ saiu da lista quando as páginas foram removidas
    for (const caminho of ["/api/", "/_next/", "/auth", "/admin"]) {
      expect(lista, caminho).toContain(caminho);
    }
  });

  // Bloquear não desindexa: uma página em Disallow nunca é lida, logo o
  // `noindex` que traz no HTML nunca é visto e o URL fica no índice sem
  // descrição. /entrar e /conta são ligadas pelo menu em todas as páginas —
  // o Google conhece-lhes o URL de qualquer forma — por isso têm de ser
  // rastreáveis para que o noindex delas chegue a ser lido.
  it("não bloqueia as páginas que dependem do noindex para sair do índice", () => {
    const lista = regras[0]?.disallow as string[];
    for (const caminho of ["/entrar", "/conta"]) {
      expect(lista, caminho).not.toContain(caminho);
    }
  });
});

describe("sitemap — só URLs canónicos", () => {
  const urls = sitemap().map((e) => e.url);

  it("não inclui o /mudancas-lisboa com hífen, que redirecciona", () => {
    expect(urls).not.toContain("https://clyon.pt/mudancas-lisboa");
  });

  it("inclui as páginas de cidade no caminho canónico", () => {
    expect(urls).toContain("https://clyon.pt/mudancas/lisboa");
    expect(urls).toContain("https://clyon.pt/mudancas/sesimbra");
  });

  // Um sitemap com um redirect ensina o Google a desconfiar do sitemap todo
  it("nenhum URL de mudanças usa a forma com hífen", () => {
    const comHifen = urls.filter((u) => /\/mudancas-[a-z-]+$/.test(u));
    expect(comHifen).toEqual([]);
  });

  it("não há URLs repetidos", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("páginas geradas — nenhuma que um redirect torne invisível", () => {
  // Geravam-se 18 páginas mudancas-<cidade> que nunca chegavam a servir: os
  // redirects do next.config apanham-nas antes. Se um redirect falhasse,
  // apareceriam como duplicado de /mudancas/<cidade>, que é a página a sério.
  it("não se geram páginas mudancas-<cidade>", () => {
    const slugs = getAllCityServiceSlugs().map((e) => e.slug.join("/"));
    expect(slugs.filter((s) => s.startsWith("mudancas-"))).toEqual([]);
  });

  it("os outros serviços continuam a ter página por cidade", () => {
    const slugs = getAllCityServiceSlugs().map((e) => e.slug.join("/"));
    expect(slugs).toContain("recolha-moveis-benfica");
    expect(slugs).toContain("esvaziamento-casas-almada");
    expect(slugs.length).toBeGreaterThan(90);
  });
});

describe("lastmod — só muda quando o conteúdo muda", () => {
  // Carimbar a data do build em todas as páginas diz ao Google que 157
  // mudaram a cada deploy. Ele aprende depressa a ignorar o campo, e
  // perde-se o único sinal de "esta vale a pena revisitar".
  const entradas = sitemap();

  it("as datas não são todas iguais", () => {
    const datas = new Set(entradas.map((e) => String(e.lastModified)));
    expect(datas.size).toBeGreaterThan(1);
  });

  it("nenhuma data está no futuro", () => {
    const agora = Date.now() + 60_000;
    for (const e of entradas) {
      const t = new Date(String(e.lastModified)).getTime();
      expect(Number.isNaN(t), `${e.url} com data inválida`).toBe(false);
      expect(t, `${e.url} no futuro`).toBeLessThan(agora);
    }
  });

  it("as páginas de cidade partilham a data do conteúdo local", () => {
    const cidade = entradas.filter((e) => e.url.includes("/recolha-moveis-"));
    const datas = new Set(cidade.map((e) => String(e.lastModified)));
    expect(cidade.length).toBeGreaterThan(10);
    expect(datas.size).toBe(1);
  });
});

describe("ligações do blog para as zonas", () => {
  it("um artigo de móveis liga a páginas de recolha de móveis", () => {
    const { servico, zonas } = zonasDoArtigo("recolha-de-moveis-como-funciona");
    expect(servico).toBe("recolha-moveis");
    expect(zonas.length).toBeGreaterThan(5);
    for (const z of zonas) expect(z.href).toMatch(/^\/recolha-moveis-/);
  });

  it("um artigo de entulho liga a entulho, não a móveis", () => {
    const { zonas } = zonasDoArtigo("recolha-de-entulho-legal-e-organizada");
    for (const z of zonas) expect(z.href).toMatch(/^\/recolha-entulho-/);
  });

  // Ligar tudo a tudo é ruído para o leitor e sinal fraco para o Google
  it("um artigo sem serviço associado não ganha o bloco", () => {
    expect(zonasDoArtigo("artigo-que-nao-existe").zonas).toEqual([]);
  });

  it("cada zona leva uma nota real, não 'clique aqui'", () => {
    const { zonas } = zonasDoArtigo("recolha-de-monos-o-que-inclui");
    for (const z of zonas) {
      expect(z.nota.length, z.cidade).toBeGreaterThan(10);
      expect(z.nota).not.toMatch(/clique|saiba mais/i);
    }
  });
});
