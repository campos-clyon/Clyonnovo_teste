import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { artigosDoServico } from "./blog-zonas";
import { artigosPublicados } from "./artigos-do-blog";
import { PAGINAS_EM_INGLES } from "./paginas-em-ingles";
import { camarasDasZonas, primeiraFrase, RECOLHA_DA_CAMARA } from "./recolha-da-camara";
import { PRAZO_DE_RESPOSTA, getRegionCities } from "./seo-data";
import { PRECOS, comMaiuscula, maisIva } from "./precos-publicos";
import { SERVICE_CATEGORIES } from "./service-categories";
import { descricaoQueCabe, LIMITE_DA_DESCRICAO } from "./descricoes-seo";
import { caminhoDaPagina, ID_DA_ORGANIZACAO } from "./dados-estruturados";

/**
 * O PENTE FINO DE SEO — 14-10-2026.
 *
 * Um rastreio das 193 páginas do site encontrou três coisas que o Google
 * nota e o cliente também: terras com a preposição errada escrita à mão
 * («Mudanças em Barreiro», «Parte de Seixal»), artigos do blog que só
 * recebiam ligação da lista do blog, e páginas (como funciona, regiões, as
 * inglesas) quase sem ligações a chegar. Estes testes seguram o que se
 * arrumou.
 */

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

function ficheiros(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) fora.push(...ficheiros(caminho));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome)) fora.push(caminho);
  }
  return fora;
}

describe("as terras com artigo não levam a preposição seca", () => {
  // «em Barreiro», «de Seixal», «para Amadora» — diz-se «no», «do», «para a».
  const COM_ARTIGO = [
    "Barreiro",
    "Moita",
    "Seixal",
    "Montijo",
    "Amadora",
    "Lumiar",
    "Olivais",
    "Costa da Caparica",
    "Margem Sul",
    "Grande Lisboa",
  ];
  const ERRADA = new RegExp(`\\b(em|de|para) (${COM_ARTIGO.join("|")})\\b`, "g");
  // Nomes oficiais que se escrevem assim.
  const OFICIAIS = ["União de Freguesias de Montijo"];

  it("nenhum texto do site as escreve à mão", () => {
    const achados: string[] = [];
    for (const dir of ["src/app", "src/components", "src/lib"]) {
      for (const f of ficheiros(join(process.cwd(), dir))) {
        let texto = semComentarios(readFileSync(f, "utf8"));
        for (const oficial of OFICIAIS) texto = texto.split(oficial).join("");
        for (const m of texto.matchAll(ERRADA)) achados.push(`${f.replace(process.cwd(), "")}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it("os sítios que as escreviam usam as funções da preposição", () => {
    expect(lerNu("src/components/Footer.tsx")).toContain("Mudanças {emTerra(c.nome)}");
    expect(lerNu("src/app/mudancas/[cidade]/page.tsx")).toContain("Mudanças {emTerra(v.nome)}");
    expect(lerNu("src/app/profissionais/[slug]/page.tsx")).toContain("Parte {deTerra(p.cidade)}");
    expect(lerNu("src/app/[...slug]/page.tsx")).not.toContain("Pode pedir em {");
  });
});

describe("os artigos do blog ligados a partir do hub do seu serviço", () => {
  const HUBS: Array<[string, string]> = [
    ["src/app/recolha-de-moveis/page.tsx", "recolha-moveis"],
    ["src/app/recolha-de-sofas/page.tsx", "recolha-moveis"],
    ["src/app/recolha-de-entulho/page.tsx", "recolha-entulho"],
    ["src/app/recolha-de-monos/page.tsx", "recolha-monos"],
    ["src/app/esvaziamento-de-casas/page.tsx", "esvaziamento-casas"],
    ["src/app/mudancas/page.tsx", "mudancas"],
  ];

  it.each(HUBS)("%s mostra os guias de %s", (pagina, servico) => {
    expect(lerNu(pagina)).toMatch(new RegExp(`<GuiasDoServico servico="${servico}"`));
    // E o bloco não sai vazio: o serviço tem artigos no ar.
    expect(artigosDoServico(servico).length).toBeGreaterThan(0);
  });

  it("só entram artigos publicados, e cada um num serviço só", () => {
    const publicados = new Set(artigosPublicados().map((a) => a.slug));
    const vistos = new Set<string>();
    for (const [, servico] of HUBS) {
      for (const artigo of artigosDoServico(servico)) {
        expect(publicados.has(artigo.slug)).toBe(true);
        vistos.add(`${artigo.slug}→${servico}`);
      }
    }
    const porArtigo = new Map<string, Set<string>>();
    for (const par of vistos) {
      const [slug, servico] = par.split("→");
      porArtigo.set(slug, (porArtigo.get(slug) ?? new Set()).add(servico));
    }
    for (const [, servicos] of porArtigo) expect(servicos.size).toBe(1);
  });

  it("um serviço sem artigos não tem bloco", () => {
    expect(artigosDoServico("servico-que-nao-existe")).toEqual([]);
  });
});

describe("as páginas quase sem ligações passam a recebê-las", () => {
  it("o rodapé, que está em todas, liga a como funciona, regiões e à página inglesa", () => {
    const RODAPE = lerNu("src/components/Footer.tsx");
    expect(RODAPE).toContain('href: "/como-funciona"');
    expect(RODAPE).toContain('href: "/regioes"');
    expect(RODAPE).toContain('href: "/en/junk-removal-lisbon"');
    expect(PAGINAS_EM_INGLES.some((p) => p.slug === "junk-removal-lisbon")).toBe(true);
  });

  it("as páginas inglesas ligam umas às outras, e a portuguesa liga à inglesa", () => {
    expect(lerNu("src/app/en/[pagina]/page.tsx")).toMatch(/PAGINAS_EM_INGLES\.filter\(\(o\) => o\.slug !== p\.slug\)/);
    expect(lerNu("src/app/[...slug]/page.tsx")).toContain("enderecoEmIngles(city.slug)");
  });
});

describe("as páginas de região — 15-10-2026", () => {
  const REGIAO = lerNu("src/app/regioes/[region]/page.tsx");

  it("as perguntas do FAQPage estão à vista, saídas da mesma lista", () => {
    // Viviam só no JSON-LD: o Google lia perguntas que ninguém via.
    expect(REGIAO).toMatch(/mainEntity: perguntas\.map\(/);
    expect(REGIAO).toMatch(/\{perguntas\.map\(\(p\) => \(\s*<div key=\{p\.q\}>\s*<dt[^>]*>\{p\.q\}<\/dt>\s*<dd[^>]*>\{p\.a\}<\/dd>/);
  });

  it("cada terra liga a todos os serviços, e não só à recolha de móveis", () => {
    // O bloco é o TerrasComServicos, também usado em /regioes.
    expect(REGIAO).toContain("<TerrasComServicos cidades={cities} />");
    expect(lerNu("src/components/TerrasComServicos.tsx")).toMatch(
      /cidades\.map\(\(city\) => \([\s\S]*?SERVICES\.map\(\(service, i\) => \([\s\S]*?caminhoDoServicoNaCidade\(service\.slug, city\.slug\)/,
    );
  });

  it("as câmaras de cada região, uma vez cada, pela ordem das terras", () => {
    const margemSul = camarasDasZonas(getRegionCities("margem-sul").map((c) => c.slug)).map((c) => c.concelho);
    expect(margemSul).toEqual(["almada", "seixal", "barreiro", "moita", "montijo", "alcochete"]);
    expect(new Set(margemSul).size).toBe(margemSul.length);
    for (const regiao of ["lisboa", "margem-sul", "setubal"] as const) {
      const camaras = camarasDasZonas(getRegionCities(regiao).map((c) => c.slug));
      expect(camaras.length).toBeGreaterThan(0);
      for (const { camara } of camaras) expect(camara.monos?.texto).toBeTruthy();
    }
  });

  it("o resumo de cada câmara é a primeira frase do que ela publica, inteira", () => {
    expect(primeiraFrase(RECOLHA_DA_CAMARA.montijo.monos!.texto)).toBe("No Montijo, a recolha de monos é gratuita.");
    for (const [concelho, camara] of Object.entries(RECOLHA_DA_CAMARA)) {
      if (!camara.monos) continue;
      const frase = primeiraFrase(camara.monos.texto);
      expect(frase, concelho).toMatch(/\.$/);
      expect(camara.monos.texto.startsWith(frase), concelho).toBe(true);
    }
  });

  it("a página /regioes liga a todas as terras e a todos os hubs", () => {
    const REGIOES = lerNu("src/app/regioes/page.tsx");
    expect(REGIOES).not.toContain("cities.slice(0, 4)");
    expect(REGIOES).toContain('caminhoDoServicoNaCidade("recolha-moveis", city.slug)');
    for (const hub of ["/recolha-de-moveis", "/recolha-de-monos", "/recolha-de-entulho", "/esvaziamento-de-casas", "/mudancas"]) {
      expect(REGIOES).toContain(`href: "${hub}"`);
    }
  });
});

describe("os preços com maiúscula onde começam a frase — 15-10-2026", () => {
  it("comMaiuscula", () => {
    expect(comMaiuscula("desde 57 €")).toBe("Desde 57 €");
    expect(comMaiuscula("40 – 120 €")).toBe("40 – 120 €");
  });

  it("em /precos, o preço vai sozinho num título", () => {
    expect(lerNu("src/app/precos/page.tsx")).toMatch(/return comMaiuscula\(/);
  });

  it("as descrições de /servicos/* cabem e não têm «. desde»", () => {
    const SERVICO = lerNu("src/app/servicos/[slug]/page.tsx");
    expect(SERVICO).toContain("comMaiuscula(maisIva(preco.etiqueta))");
    expect(SERVICO).not.toContain("${preco.etiqueta}, sem IVA.");
    expect(SERVICO).not.toContain("começa ${");
    // A mesma conta da página, para as três.
    for (const slug of ["esvaziamento-apartamento", "montagem-moveis", "manutencao-casa"]) {
      const cat = SERVICE_CATEGORIES.find((c) => c.slug === slug)!;
      const preco = PRECOS[cat.id];
      const descricao = descricaoQueCabe([
        cat.description,
        preco ? `${comMaiuscula(maisIva(preco.etiqueta))}.` : null,
        `${PRAZO_DE_RESPOSTA.frase}, com profissionais verificados.`,
      ]);
      expect(descricao.length, slug).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
      expect(descricao, slug).not.toMatch(/\. [a-zà-ÿ]/);
      expect(descricao, slug).toContain("IVA");
    }
  });

  it("as três páginas de serviço dizem o que conta para o preço e para onde seguir", () => {
    const SERVICO = lerNu("src/app/servicos/[slug]/page.tsx");
    expect(SERVICO).toContain("O que conta para o preço");
    expect(SERVICO).toMatch(/href: "\/regioes\/margem-sul"/);
    expect(SERVICO).toMatch(/"esvaziamento-apartamento": \[\s*\{ href: "\/esvaziamento-de-casas"/);
  });
});

describe("o caminho e a imagem nos dados estruturados — 15-10-2026", () => {
  it("caminhoDaPagina põe a marca na raiz e numera os passos", () => {
    const c = caminhoDaPagina([["Blog", "/blog"], ["Um artigo", "/blog/um-artigo"]]);
    expect(c["@type"]).toBe("BreadcrumbList");
    expect(c.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(c.itemListElement[0].item).toBe("https://clyon.pt");
    expect(c.itemListElement[2]).toMatchObject({ name: "Um artigo", item: "https://clyon.pt/blog/um-artigo" });
  });

  it("os artigos têm caminho, imagem e o autor por @id da Organization do layout", () => {
    const ARTIGO = lerNu("src/app/blog/[slug]/page.tsx");
    expect(ARTIGO).toContain("jsonLd(breadcrumbSchema)");
    expect(ARTIGO).toMatch(/caminhoDaPagina\(\[\s*\["Blog", "\/blog"\]/);
    expect(ARTIGO).toContain("image: [`${SITE_URL}${IMAGEM_DE_PARTILHA.url}`]");
    expect(ARTIGO).toContain("\"@id\": ID_DA_ORGANIZACAO");
    expect(lerNu("src/app/layout.tsx")).toContain("\"@id\": `${SITE_URL}/#organization`");
    expect(ID_DA_ORGANIZACAO).toBe("https://clyon.pt/#organization");
  });

  it.each(["recolha-de-entulho", "recolha-de-monos"])("o hub %s tem caminho", (hub) => {
    const HUB = lerNu(`src/app/${hub}/page.tsx`);
    expect(HUB).toContain(`"/${hub}"]`);
    expect(HUB).toContain("jsonLd(breadcrumbSchema)");
  });

  it("os perfis levam a imagem de partilha (o openGraph da página substitui o do layout)", () => {
    expect(lerNu("src/app/profissionais/[slug]/page.tsx")).toMatch(/openGraph: \{\s*\.\.\.og\(\{/);
  });
});

describe("/areas-de-atuacao juntou-se a /regioes — 15-10-2026", () => {
  it("/regioes ficou com o que a outra tinha de seu", () => {
    const REGIOES = lerNu("src/app/regioes/page.tsx");
    expect(REGIOES).toContain("{CITIES.length} localidades");
    expect(REGIOES).toContain("Sede da CLYON");
    expect(REGIOES).toContain("Fora destas zonas");
    expect(REGIOES).toContain("jsonLd(servicoSchema)");
    expect(REGIOES).toContain("<TerrasComServicos cidades={getRegionCities(region.slug)} />");
    // Com o openGraph dela, e não o do layout (que tem o endereço da inicial).
    expect(REGIOES).toContain("openGraph: og(");
  });

  it("a página que saiu já não existe, e a que fica sim", () => {
    expect(existsSync(join(process.cwd(), "src/app/areas-de-atuacao/page.tsx"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/app/regioes/page.tsx"))).toBe(true);
  });

  it("as páginas de região usam o mesmo bloco das terras", () => {
    expect(lerNu("src/app/regioes/[region]/page.tsx")).toContain("<TerrasComServicos cidades={cities} />");
  });
});
