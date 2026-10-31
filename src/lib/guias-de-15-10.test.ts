import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { partesDoTexto, type BlogPost } from "./blog-data";
import { artigosPublicados } from "./artigos-do-blog";
import { artigosDoServico, zonasDoArtigo } from "./blog-zonas";
import { PRECOS, SEM_IVA_NA_FRASE } from "./precos-publicos";
import { faixaSemEComIva, valorSemEComIva } from "./preco-de-referencia";
import { RECOLHA_DA_CAMARA, primeiraFrase } from "./recolha-da-camara";
import { COMO_SE_RECOLHE_ENTULHO, NAO_HA_CONTENTORES, RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { PRECO_DA_MUDANCA_POR_EXTENSO } from "./tabela-das-mudancas";
import { getAllCityServiceSlugs } from "./seo-data";
import { getAllCidadeSlugs } from "./mudancas-cidades";

/**
 * OS QUATRO GUIAS DE 15-10-2026.
 *
 * *«Não tem mais nada para melhorar?»* — e, escolhidos pelo dono, «mais guias
 * no blog»: para pesquisas com procura que nenhum artigo respondia. O que se
 * guarda: que dizem os números de onde o site os tira (preços, regras das
 * câmaras, entulho, mudanças), que cada um aparece no hub do seu serviço, e
 * que todas as ligações vão dar a páginas que existem.
 */

const GUIAS: Record<string, string> = {
  "recolha-de-monos-camara-ou-profissional": "recolha-monos",
  "entulho-sacos-big-bag-ou-contentor": "recolha-entulho",
  "esvaziar-apartamento-para-arrendar-ou-vender": "esvaziamento-casas",
  "mudanca-entre-lisboa-e-a-margem-sul": "mudancas",
};

const artigo = (slug: string): BlogPost => {
  const a = artigosPublicados().find((p) => p.slug === slug);
  if (!a) throw new Error(`${slug} não está publicado`);
  return a;
};
const textoDe = (a: BlogPost) =>
  [a.intro, ...a.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])]), ...a.faq.map((f) => f.answer)].join("\n");
const ligacoesDe = (a: BlogPost) =>
  [a.intro, ...a.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])])]
    .flatMap(partesDoTexto)
    .filter((p): p is { texto: string; href: string } => "href" in p);

describe("os guias estão publicados, cada um no hub do seu serviço", () => {
  it.each(Object.entries(GUIAS))("%s → %s", (slug, servico) => {
    const a = artigo(slug);
    expect(artigosDoServico(servico).map((p) => p.slug)).toContain(slug);
    expect(zonasDoArtigo(slug).zonas.length).toBeGreaterThan(0);
    // O preço na descrição leva a informação do IVA, e a data não é do futuro.
    expect(a.description).toMatch(/\+ IVA/);
    expect(a.publishDate <= "2026-10-15").toBe(true);
  });
});

describe("as ligações vão dar a páginas que existem", () => {
  const geradas = new Set(getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`));
  const mudancas = new Set(getAllCidadeSlugs().map((c) => `/mudancas/${c}`));
  const publicados = new Set(artigosPublicados().map((a) => `/blog/${a.slug}`));
  const existe = (href: string) => {
    const caminho = href.split("?")[0];
    if (caminho.startsWith("/blog/")) return publicados.has(caminho);
    if (caminho.startsWith("/mudancas/")) return mudancas.has(caminho);
    if (geradas.has(caminho)) return true;
    // As de /servicos/[slug] geram-se da lista GERADAS da própria página.
    const servico = caminho.match(/^\/servicos\/([a-z-]+)$/)?.[1];
    if (servico) {
      const PAGINA = readFileSync(join(process.cwd(), "src/app/servicos/[slug]/page.tsx"), "utf8");
      const geradasDaPagina = PAGINA.match(/const GERADAS = \[([^\]]*)\]/)?.[1] ?? "";
      return geradasDaPagina.includes(`"${servico}"`);
    }
    return existsSync(join(process.cwd(), "src", "app", caminho, "page.tsx"));
  };

  it.each(Object.keys(GUIAS))("%s", (slug) => {
    const quebradas = ligacoesDe(artigo(slug))
      .map((l) => l.href)
      .filter((h) => !existe(h));
    expect(quebradas).toEqual([]);
  });

  it("a Amadora vai à sua página própria, e não à gerada que faz 301", () => {
    const hrefs = ligacoesDe(artigo("recolha-de-monos-camara-ou-profissional")).map((l) => l.href);
    expect(hrefs).toContain("/recolha-de-monos-amadora");
    expect(hrefs).not.toContain("/recolha-monos-amadora");
  });
});

describe("os números saem de onde o site os tira", () => {
  it("monos: o preço com a nota do IVA, e as dezasseis câmaras ligadas", () => {
    const a = artigo("recolha-de-monos-camara-ou-profissional");
    expect(textoDe(a)).toContain(`${PRECOS.recolha_monos.etiqueta}, ${SEM_IVA_NA_FRASE}`);
    const concelhos = ligacoesDe(a).map((l) => l.texto);
    for (const c of Object.values(RECOLHA_DA_CAMARA)) expect(concelhos).toContain(c.concelho);
  });

  it("entulho: o que a CLYON faz e não faz, e as regras das câmaras tal como estão escritas", () => {
    const a = artigo("entulho-sacos-big-bag-ou-contentor");
    const texto = textoDe(a);
    expect(texto).toContain(COMO_SE_RECOLHE_ENTULHO);
    expect(texto).toContain(NAO_HA_CONTENTORES);
    expect(a.faq.map((f) => f.answer)).toContain(RESPOSTA_SOBRE_CONTENTORES);
    const lista = a.sections.find((s) => s.title === "O big bag da câmara")!.bullets!;
    expect(lista.length).toBeGreaterThanOrEqual(4);
    expect(lista.join("\n")).toContain(primeiraFrase(RECOLHA_DA_CAMARA.almada.entulho!.texto));
  });

  it("apartamento: a faixa de referência com o com IVA ao lado (31-10-2026)", () => {
    // Dizia «…começa desde 250 €, também sem IVA.»: o sem IVA sozinho.
    const texto = textoDe(artigo("esvaziar-apartamento-para-arrendar-ou-vender"));
    expect(texto).toContain(
      faixaSemEComIva(PRECOS.esvaziamento_apartamento.minimo!, PRECOS.esvaziamento_apartamento.maximo!),
    );
    expect(texto).toContain(valorSemEComIva(PRECOS.esvaziamento_casa.minimo!));
    expect(texto).not.toMatch(/também sem IVA/);
  });

  it("mudança: a tabela por extenso, e o simulador já em «Mudança»", () => {
    const a = artigo("mudanca-entre-lisboa-e-a-margem-sul");
    expect(textoDe(a)).toContain(PRECO_DA_MUDANCA_POR_EXTENSO);
    expect(ligacoesDe(a).map((l) => l.href)).toContain("/simulador?servico=mudanca");
  });
});

describe("as listas dos artigos aceitam ligações", () => {
  it("cada linha passa pelo mesmo desenho dos parágrafos", () => {
    const PAGINA = readFileSync(join(process.cwd(), "src/app/blog/[slug]/page.tsx"), "utf8");
    expect(PAGINA).toContain("<Paragrafo texto={bullet} />");
  });
});
