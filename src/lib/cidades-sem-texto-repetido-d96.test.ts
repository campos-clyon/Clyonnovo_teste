import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { CITY_SERVICE_CONTENT } from "./city-content";
import { CIDADES_MUDANCAS, getCidadeMudancaBySlug } from "./mudancas-cidades";
import { getCidadeLocal } from "./cidades-local";
import { recolhaDaCamara } from "./recolha-da-camara";
import { ACTUALIZADO_EM } from "./datas-das-paginas";
import { SITE_URL, getAllCityServiceSlugs } from "./seo-data";
import { TITULO_PROPRIO, cabeNoGoogle, tituloCompleto, tituloDaCidade } from "./titulos-seo";
import { DESCRICAO_PROPRIA, LIMITE_DA_DESCRICAO, descricaoDaCidade, tamanho } from "./descricoes-seo";

/**
 * AS PÁGINAS DE CIDADE NÃO SE REPETEM — 23-11-2026 (d96).
 *
 * O Google pôs de lado 15 páginas de cidade («Rastreada, mas não indexada»):
 * eram o texto genérico com o nome da terra trocado. Cada uma tem agora o seu,
 * e isto mede-o: entre quaisquer duas páginas com texto próprio, a parte de
 * sequências de cinco palavras em comum fica abaixo de 40 %.
 */

const PAGINAS_DA_D96 = [
  "recolha-monos-odivelas",
  "recolha-monos-sesimbra",
  "recolha-monos-montijo",
  "recolha-monos-carnaxide",
  "recolha-monos-olivais",
  "esvaziamento-casas-almada",
  "esvaziamento-casas-seixal",
  "esvaziamento-casas-oeiras",
  "esvaziamento-casas-barreiro",
  "esvaziamento-casas-queluz",
  "esvaziamento-casas-monte-abraao",
  "esvaziamento-casas-alcochete",
  "esvaziamento-casas-carnaxide",
  "esvaziamento-casas-olivais",
  "recolha-entulho-loures",
];
const MUDANCAS_DA_D96 = ["seixal", "amadora", "almada"];

const palavras = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9³]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

function cincoGramas(t: string): Set<string> {
  const p = palavras(t);
  const s = new Set<string>();
  for (let i = 0; i + 5 <= p.length; i++) s.add(p.slice(i, i + 5).join(" "));
  return s;
}

/** A parte comum de dois conjuntos (Jaccard): 0 nada em comum, 1 iguais. */
function semelhanca(a: Set<string>, b: Set<string>): number {
  let comum = 0;
  for (const x of a) if (b.has(x)) comum++;
  const uniao = a.size + b.size - comum;
  return uniao === 0 ? 0 : comum / uniao;
}

const TEXTOS: Array<[string, string]> = [
  ...Object.entries(CITY_SERVICE_CONTENT).map(([chave, c]): [string, string] => [
    chave,
    [c.localIntro, c.accessNotes, c.neighborhoodHighlight, ...c.faqs.flatMap((f) => [f.q, f.a])].join(" "),
  ]),
  ...CIDADES_MUDANCAS.filter((c) => c.textoLocal?.length).map((c): [string, string] => [
    `mudancas/${c.slug}`,
    [...(c.textoLocal ?? []), ...c.faqs.flatMap((f) => [f.pergunta, f.resposta])].join(" "),
  ]),
];

describe("as páginas de cidade com texto próprio não se repetem (d96)", () => {
  it("as 15 páginas e as 3 de mudanças têm texto próprio", () => {
    for (const chave of PAGINAS_DA_D96) {
      const c = CITY_SERVICE_CONTENT[chave];
      expect(c, chave).toBeDefined();
      expect(palavras(`${c.localIntro} ${c.accessNotes} ${c.neighborhoodHighlight}`).length, chave).toBeGreaterThan(90);
      expect(c.faqs.length, chave).toBe(2);
    }
    for (const slug of MUDANCAS_DA_D96) {
      const c = getCidadeMudancaBySlug(slug)!;
      expect(c.textoLocal?.length, slug).toBe(3);
      // Sem preços neste ficheiro: o preço sai do cartão do topo (a lista de parceiros).
      expect(c.textoLocal!.join(" "), slug).not.toContain("€");
    }
  });

  it("5-gramas em comum abaixo de 0,40 entre quaisquer duas", () => {
    const g = TEXTOS.map(([chave, t]) => [chave, cincoGramas(t)] as const);
    const acima: string[] = [];
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const s = semelhanca(g[i][1], g[j][1]);
        if (s >= 0.4) acima.push(`${g[i][0]} × ${g[j][0]}: ${s.toFixed(2)}`);
      }
    }
    expect(acima).toEqual([]);
  });
});

describe("títulos e descrições próprios (d96)", () => {
  const paginas = new Set(getAllCityServiceSlugs().map(({ slug }) => slug.join("/")));

  it("cada página existe, e o título e a descrição são os dela, dentro dos limites", () => {
    for (const [chave, titulo] of Object.entries(TITULO_PROPRIO)) {
      expect(paginas.has(chave), chave).toBe(true);
      expect(cabeNoGoogle(titulo), tituloCompleto(titulo)).toBe(true);
      expect(titulo, chave).not.toContain(" — ");
      const item = getAllCityServiceSlugs().find(({ slug }) => slug.join("/") === chave)!;
      expect(tituloDaCidade(item.service.name, item.city.name, item.service.slug, item.city.slug)).toBe(titulo);
      const d = DESCRICAO_PROPRIA[chave];
      expect(d, chave).toBeTruthy();
      expect(tamanho(d), d).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
      expect(descricaoDaCidade(item.service.slug, item.service.name, item.city.name, item.city.slug)).toBe(d);
      // O preço sem IVA nunca sozinho.
      if (d.includes("€")) expect(d, chave).toContain("com IVA");
    }
  });

  it("nenhum título de página de cidade se repete", () => {
    const vistos = new Map<string, string>();
    for (const { slug, city, service } of getAllCityServiceSlugs()) {
      const t = tituloDaCidade(service.name, city.name, service.slug, city.slug);
      expect(vistos.get(t), `${slug.join("/")} repete ${vistos.get(t)}`).toBeUndefined();
      vistos.set(t, slug.join("/"));
    }
  });

  it("Cascais sem o prazo de 24 h de terceiros", () => {
    expect(TITULO_PROPRIO["recolha-monos-cascais"]).not.toMatch(/24/);
    expect(DESCRICAO_PROPRIA["recolha-monos-cascais"]).not.toMatch(/24/);
  });
});

describe("os factos que o Marketing encontrou errados (d96)", () => {
  it("Loures e Odivelas não têm ecocentro da Valorsul", () => {
    for (const slug of ["loures", "odivelas"]) {
      expect(getCidadeLocal(slug)!.destinoResiduos.nome, slug).not.toMatch(/Loures|Odivelas/);
    }
  });

  it("Moscavide é de Loures, não dos Olivais; o Alto da Loba é de Paço de Arcos, não de Carnaxide", () => {
    expect(getCidadeLocal("olivais")!.zonas).not.toContain("Moscavide");
    expect(JSON.stringify(CITY_SERVICE_CONTENT)).not.toContain("Alto da Loba");
  });

  it("em Odivelas os monos são das juntas, e Oeiras é grátis até 1 m³", () => {
    expect(recolhaDaCamara("odivelas")!.monos!.texto).toMatch(/das juntas de freguesia/);
    expect(recolhaDaCamara("oeiras")!.monos!.texto).toMatch(/gratuita até 1 m³/);
    expect(recolhaDaCamara("oeiras")!.monos!.consultadasEm).toBe("2026-11-23");
  });
});

describe("o hub das mudanças (d96)", () => {
  it("cada cidade tem a sua linha, e nenhuma se repete", () => {
    const linhas = CIDADES_MUDANCAS.map((c) => c.linhaNoHub);
    expect(linhas.every(Boolean), JSON.stringify(CIDADES_MUDANCAS.filter((c) => !c.linhaNoHub).map((c) => c.slug))).toBe(true);
    expect(new Set(linhas).size).toBe(linhas.length);
  });
});

describe("o sitemap diz quando estas páginas mudaram (d96)", () => {
  it("as páginas de cidade e de mudanças mudadas levam lastmod, e só com a data da lista", async () => {
    const porUrl = new Map((await sitemap()).map((e) => [e.url.slice(SITE_URL.length), e]));
    for (const caminho of [...PAGINAS_DA_D96.map((p) => `/${p}`), ...MUDANCAS_DA_D96.map((s) => `/mudancas/${s}`)]) {
      expect(ACTUALIZADO_EM[caminho], caminho).toBe("2026-11-23");
      expect(porUrl.get(caminho)?.lastModified, `${caminho} sem lastmod`).toBeTruthy();
    }
    // Uma página de mudanças sem data na lista continua sem lastmod.
    expect(porUrl.get("/mudancas/setubal")?.lastModified).toBeUndefined();
  }, 30_000);
});
