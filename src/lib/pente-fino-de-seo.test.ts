import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { artigosDoServico } from "./blog-zonas";
import { artigosPublicados } from "./artigos-do-blog";
import { PAGINAS_EM_INGLES } from "./paginas-em-ingles";

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
