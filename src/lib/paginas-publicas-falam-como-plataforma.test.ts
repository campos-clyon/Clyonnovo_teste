import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS, partesDoTexto } from "./blog-data";
import { CIDADES_MUDANCAS } from "./mudancas-cidades";
import { reviews } from "./reviews-data";
import { TAXA_IVA } from "./taxas-plataforma";
import { PRECO_FECHADO, PROPOSTAS_EM_ATE } from "./promessas-publicas";
import { PRAZO_DE_RESPOSTA } from "./seo-data";

/**
 * AS PÁGINAS LOCAIS E O BLOG FALAM COMO PLATAFORMA — 30-09-2026.
 *
 * A CLYON liga o cliente a profissionais independentes; quem vai a casa é o
 * profissional. As páginas diziam o contrário em dezenas de sítios — «a
 * nossa equipa», «da nossa base em Fernão Ferro», «orçamento imediato»,
 * «seguros incluídos», «não acresce nada no fim», «limpeza pós-obra» — e
 * prometiam coisas que a CLYON não controla. Este teste guarda que não
 * voltam, e que a página de doação responde a quem quer doar.
 *
 * Os comentários saem antes de procurar: é neles que se explica o que saiu,
 * e citam as frases antigas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (t: string) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const FICHEIROS = [
  "src/app/[...slug]/page.tsx",
  "src/lib/city-content.ts",
  "src/lib/cidades-local.ts",
  "src/lib/mudancas-cidades.ts",
  "src/lib/blog-data.ts",
  "src/lib/titulos-seo.ts",
  "src/components/FurnitureSeoLinks.tsx",
  "src/app/orcamento-recolha-lisboa/LandingClient.tsx",
  "src/app/orcamento-recolha-lisboa/page.tsx",
  "src/app/blog/page.tsx",
  "src/app/blog/[slug]/page.tsx",
  "src/app/recolha-de-armarios/page.tsx",
  "src/app/recolha-de-camas/page.tsx",
  "src/app/recolha-de-eletrodomesticos/page.tsx",
  "src/app/recolha-de-entulho/page.tsx",
  "src/app/recolha-de-monos/page.tsx",
  "src/app/recolha-de-monos-amadora/page.tsx",
  "src/app/recolha-de-moveis/page.tsx",
  "src/app/recolha-de-moveis-urgente/page.tsx",  "src/app/recolha-de-sofas/page.tsx",
  "src/app/recolha-gratuita-de-moveis-usados/page.tsx",
  "src/app/esvaziamento-de-casas/page.tsx",
  "src/app/esvaziamento-de-casas-amadora/page.tsx",
  "src/app/retirar-moveis-velhos/page.tsx",
  "src/app/limpeza-de-quintais/page.tsx",
  "src/app/regioes/page.tsx",
  "src/app/regioes/[region]/page.tsx",
  "src/app/mudancas/page.tsx",
  "src/app/mudancas/[cidade]/page.tsx",
  // Os tipos de mudança (09-10-2026).
  "src/lib/tipos-de-mudanca.ts",
  "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
  "src/app/transporte-de-moveis/page.tsx",
  "src/app/pequenas-mudancas/page.tsx",
  "src/app/mudancas-de-escritorio/page.tsx",
];

/** Frases de quem executa, e promessas que a CLYON não controla. */
const PROIBIDAS: RegExp[] = [
  /a nossa equipa/i,
  /nossos cami[õo]es/i,
  /nossa carrinha/i,
  /nossa (base|sede)/i,
  /base (da )?CLYON/i,
  /empresa local/i,
  /somos (vizinhos|locais|a escolha|a refer)/i,
  /estamos (sediados|no Seixal)/i,
  /or[çc]amento (imediato|em minutos|em 15 minutos)/i,
  /(respondemos|resposta) em minutos/i,
  /menos de 1 hora/i,
  /a equipa chega/i,
  /seguros? inclu[íi]d/i,
  /n[ãa]o acresce nada/i,
  /tudo inclu[íi]do/i,
  /melhores pre[çc]os/i,
  /pre[çc]os? (mais )?competitiv/i,
  /ligeiramente (mais altos|superiores) (do que|pela|por causa)/i,
  /domingos (e feriados )?n[ãa]o trabalhamos/i,
  /triagem (respons[áa]vel|para doa)/i,
  /doamos/i,
  /Mariana R\./,
  /\bSEO\b/,
  /inten[çc][ãa]o (comercial|de pesquisa)/i,
];

describe("as páginas públicas não falam como quem executa", () => {
  for (const f of FICHEIROS) {
    it(`${f} não tem frases de empresa executante nem promessas que a CLYON não controla`, () => {
      const codigo = semComentarios(ler(f));
      const achadas = PROIBIDAS.filter((re) => re.test(codigo)).map(String);
      expect(achadas, f).toEqual([]);
    });
  }

  it("a limpeza pós-obra não aparece como serviço fora do artigo que a explica", () => {
    // A landing e /recolha-de-moveis ficam de fora por agora: o JSON-LD
    // LocalBusiness delas ainda lista «limpeza pós-obra», e esse bloco é da
    // equipa do SEO técnico. Quando sair de lá, tiram-se daqui.
    const excepcoes = ["blog-data.ts", "orcamento-recolha-lisboa/page.tsx", "recolha-de-moveis/page.tsx"];
    for (const f of FICHEIROS.filter((f) => !excepcoes.some((e) => f.endsWith(e)))) {
      expect(semComentarios(ler(f)), f).not.toMatch(/limpeza p[óo]s-obra/i);
    }
    const artigo = BLOG_POSTS.find((p) => p.slug === "limpeza-pos-obra-e-retirada-de-residuos")!;
    for (const faq of artigo.faq) expect(faq.answer).not.toMatch(/^Pode fazer|^Sim/);
  });

  it("a frase do preço fechado diz o IVA a quem pede factura, a partir da constante", () => {
    expect(PRECO_FECHADO).toContain(`${Math.round(TAXA_IVA * 100)} %`);
    expect(PRECO_FECHADO).toContain("já inclui a taxa da plataforma");
    // «em até» é construção brasileira; em PT-PT, «em menos de» (30-09-2026).
    expect(PROPOSTAS_EM_ATE).toBe(`em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`);
  });
});

describe("mudanças: nada que não se possa mostrar de onde veio", () => {
  it("nenhuma cidade mede a distância à base da CLYON", () => {
    for (const c of CIDADES_MUDANCAS) {
      expect(c, c.slug).not.toHaveProperty("distanceKm");
      expect(c, c.slug).not.toHaveProperty("tempoMedio");
    }
  });

  it("um testemunho só existe se estiver, palavra por palavra, em reviews-data", () => {
    const reais = new Set(reviews.map((r) => r.text));
    for (const c of CIDADES_MUDANCAS) {
      if (c.testemunho) expect(reais.has(c.testemunho.texto), c.slug).toBe(true);
    }
  });
});

describe("a página para quem quer doar", () => {
  const PAGINA = ler("src/app/recolha-gratuita-de-moveis-usados/page.tsx");
  const CODIGO = semComentarios(PAGINA);

  it("responde a quem quer doar, no título, na descrição e no H1", () => {
    expect(PAGINA).toContain('title: "Doar Móveis Usados em Lisboa: Quem Recolhe de Graça",');
    expect(PAGINA).toMatch(/<h1[^>]*>\s*Doar móveis usados em Lisboa: quem recolhe de graça/);
    const descricao = PAGINA.match(/description:\r?\n\s*"([^"]+)"/)?.[1] ?? "";
    expect(descricao).toMatch(/doar/i);
    expect([...descricao].length).toBeLessThanOrEqual(155);
  });

  it("cada entidade aponta para a fonte oficial, e não se escrevem telefones", () => {
    const fontes = [...CODIGO.matchAll(/fonte: "([^"]+)"/g)].map((m) => m[1]);
    expect(fontes.length).toBeGreaterThanOrEqual(10);
    for (const u of fontes) expect(u).toMatch(/^https:\/\//);
    expect(CODIGO).not.toMatch(/\b\d{3}\s?\d{3}\s?\d{3}\b/);
    expect(CODIGO).not.toContain("tel:");
  });

  it("a FAQ visível e a do FAQPage são a mesma lista, e não há nota agregada", () => {
    expect(CODIGO).toContain("mainEntity: faqs.map(");
    expect(CODIGO).toContain("{faqs.map((faq) => (");
    expect(CODIGO).not.toContain("aggregateRating");
  });

  it("a CLYON aparece no fim como é: paga, com propostas em menos de 6 horas, e sem prometer doação", () => {
    expect(CODIGO).toContain("Quando ninguém aceita ou não pode esperar");
    expect(CODIGO).toContain("é um serviço pago");
    expect(CODIGO).toContain("PROPOSTAS_EM_ATE");
    expect(CODIGO).toContain('href="/simulador"');
    expect(CODIGO).toContain("a CLYON não encaminha peças para doação");
  });
});

describe("o blog", () => {
  it("todos os títulos cabem no Google, marca incluída", () => {
    for (const p of BLOG_POSTS) {
      expect([...`${p.metaTitle ?? p.title} | CLYON`].length, p.slug).toBeLessThanOrEqual(60);
    }
  });

  it("e a página do artigo usa o metaTitle", () => {
    expect(ler("src/app/blog/[slug]/page.tsx")).toContain("title: post.metaTitle ?? post.title,");
  });

  it("as descrições são para leitores e cabem no resultado", () => {
    for (const p of BLOG_POSTS) {
      expect(p.description, p.slug).not.toMatch(/SEO/);
      expect([...p.description].length, p.slug).toBeLessThanOrEqual(155);
    }
  });

  it("os três artigos de doação ligam à página de doação com a âncora certa", () => {
    for (const slug of [
      "doacao-de-moveis-ou-despejo",
      "onde-doar-vender-ou-anunciar-moveis-usados",
      "recolha-gratuita-de-moveis-usados-costa-da-caparica",
    ]) {
      const post = BLOG_POSTS.find((p) => p.slug === slug);
      expect(post, slug).toBeDefined();
      const ligacoes = [post!.intro, ...post!.sections.flatMap((s) => s.paragraphs)]
        .flatMap(partesDoTexto)
        .filter((p): p is { texto: string; href: string } => "href" in p);
      expect(ligacoes, slug).toContainEqual({
        texto: "doar móveis usados em Lisboa",
        href: "/recolha-gratuita-de-moveis-usados",
      });
    }
  });

  it("as ligações só podem ser internas", () => {
    expect(partesDoTexto("veja [aqui](https://exemplo.com)")).toEqual([
      { texto: "veja [aqui](https://exemplo.com)" },
    ]);
    expect(partesDoTexto("a [recolha](/recolha-de-moveis).")).toEqual([
      { texto: "a " },
      { texto: "recolha", href: "/recolha-de-moveis" },
      { texto: "." },
    ]);
  });

  it("o índice do blog deixou de disputar as pesquisas de doação", () => {
    const INDICE = ler("src/app/blog/page.tsx");
    const meta = INDICE.slice(INDICE.indexOf("export const metadata"), INDICE.indexOf("export const revalidate"));
    expect(meta).not.toMatch(/doa[rç]/i);
    expect(INDICE).toContain('href="/recolha-gratuita-de-moveis-usados"');
  });
});
