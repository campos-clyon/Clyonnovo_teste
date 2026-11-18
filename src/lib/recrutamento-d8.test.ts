import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESCRICAO_DO_RECRUTAMENTO,
  TITULO_DO_RECRUTAMENTO,
  ZONAS_DO_RECRUTAMENTO,
} from "./pagina-de-recrutamento";
import { concelhoPorId } from "./concelhos-da-cobertura";
import { O_QUE_A_CLYON_NAO_FAZ } from "./como-funciona-para-o-profissional";
import { BLOG_POSTS } from "./blog-data";
import { destinoDaCandidatura } from "@/components/TrabalheConnosco";

/**
 * O RECRUTAMENTO ORGÂNICO — d8 de 18-11-2026, aprovada pelo CEO e pelo dono.
 * O título que fala como quem tem carrinha pesquisa, as zonas onde mais
 * queremos parceiros, as ligações nas páginas de recolha e de mudanças, e o
 * guia do blog. Sem entulho, sem números de taxas, sem tempo de candidatura e
 * sem a CLYON a pagar ao parceiro.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PROIBIDO = /entulho|contentor|big ?bag|próprio dia|a CLYON paga|\d+ ?%|minutos?\b/i;

describe("o título e a descrição da /quero-ser-parceiro", () => {
  it("falam de trabalho com carrinha em Lisboa, e cabem no Google", () => {
    expect(TITULO_DO_RECRUTAMENTO).toBe("Trabalho com carrinha: recolhas e mudanças em Lisboa");
    expect([...`${TITULO_DO_RECRUTAMENTO} | CLYON`].length).toBeLessThanOrEqual(60);
    expect([...DESCRICAO_DO_RECRUTAMENTO].length).toBeLessThanOrEqual(155);
    expect(DESCRICAO_DO_RECRUTAMENTO).toContain("Lisboa, Loures e Sintra");
    expect(`${TITULO_DO_RECRUTAMENTO} ${DESCRICAO_DO_RECRUTAMENTO}`).not.toMatch(PROIBIDO);
  });
});

describe("o bloco de Lisboa, Loures e da Linha de Sintra", () => {
  it("cada ligação leva uma zona que existe e vai à candidatura", () => {
    expect(ZONAS_DO_RECRUTAMENTO.ligacoes.map((l) => new URL(l.href, "https://clyon.pt").searchParams.get("zona"))).toEqual([
      "lisboa",
      "loures",
      "sintra",
    ]);
    for (const l of ZONAS_DO_RECRUTAMENTO.ligacoes) {
      const u = new URL(l.href, "https://clyon.pt");
      expect(concelhoPorId(u.searchParams.get("zona"))).not.toBeNull();
      expect(u.pathname).toBe("/quero-ser-parceiro");
      expect(u.hash).toBe("#candidatura");
    }
    const textos = [ZONAS_DO_RECRUTAMENTO.titulo, ZONAS_DO_RECRUTAMENTO.texto, ZONAS_DO_RECRUTAMENTO.terras].join(" ");
    expect(textos).not.toMatch(PROIBIDO);
    // Sem números escritos à mão: o «Há N pedidos» vem da base (ProcuraNaZona).
    expect(textos).not.toMatch(/\d/);
  });

  it("vem logo a seguir aos cartões do «porquê», antes da caixa da taxa", () => {
    const PAGINA = ler("src/app/quero-ser-parceiro/page.tsx");
    const cartoes = PAGINA.indexOf("{PORQUE.map(");
    const bloco = PAGINA.indexOf("{ZONAS_DO_RECRUTAMENTO.titulo}");
    const taxa = PAGINA.indexOf("{exemplo.frase}");
    expect(cartoes).toBeGreaterThan(-1);
    expect(bloco).toBeGreaterThan(cartoes);
    expect(taxa).toBeGreaterThan(bloco);
  });
});

describe("a linha das mudanças escolhidas", () => {
  it("diz o prazo das 3 horas, e não «sem penalização»", () => {
    const tudo = O_QUE_A_CLYON_NAO_FAZ.join(" ");
    expect(tudo).not.toMatch(/sem penaliza/i);
    expect(tudo).toContain("Se um cliente o escolher numa mudança, responda em 3 horas (das 8h às 21h).");
  });
});

describe("as ligações à candidatura", () => {
  it("o rodapé diz a quem se dirige", () => {
    expect(ler("src/components/Footer.tsx")).toContain('{ href: "/quero-ser-parceiro", texto: "Trabalhe connosco: tem carrinha?" }');
  });

  it("nas páginas de recolha e de mudanças, e nunca nas de entulho", () => {
    const COM = [
      "src/app/recolha-de-moveis/page.tsx",
      "src/app/recolha-de-monos/page.tsx",
      "src/app/recolha-de-moveis-urgente/page.tsx",
      "src/app/recolha-de-armarios/page.tsx",
      "src/app/recolha-de-camas/page.tsx",
      "src/app/recolha-de-eletrodomesticos/page.tsx",
      "src/app/recolha-de-sofas/page.tsx",
      "src/app/recolha-gratuita-de-moveis-usados/page.tsx",
      "src/app/recolha-de-monos-amadora/page.tsx",
      "src/app/mudancas/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
    ];
    for (const f of COM) expect(ler(f), f).toContain("<TrabalheConnosco tipo=");
    expect(ler("src/app/recolha-de-entulho/page.tsx")).not.toContain("TrabalheConnosco");
    // Nas páginas de cidade, só nas recolhas de móveis e de monos.
    const CIDADE = ler("src/app/[...slug]/page.tsx");
    expect(CIDADE).toContain('{service.slug === "recolha-moveis" || service.slug === "recolha-monos" ? (');
  });

  it("numa cidade da cobertura leva a zona; fora dela, não", () => {
    expect(destinoDaCandidatura({ slug: "lisboa" })).toBe("/quero-ser-parceiro?zona=lisboa");
    expect(destinoDaCandidatura({ slug: "amadora" })).toBe("/quero-ser-parceiro?zona=amadora");
    expect(destinoDaCandidatura({ slug: "benfica" })).toBe("/quero-ser-parceiro");
    expect(destinoDaCandidatura(null)).toBe("/quero-ser-parceiro");
  });

  it("o texto da linha não fala de entulho nem de taxas", () => {
    const texto = ler("src/components/TrabalheConnosco.tsx").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "");
    expect(texto).not.toMatch(PROIBIDO);
  });
});

describe("o guia do blog para quem tem carrinha", () => {
  const guia = BLOG_POSTS.find((p) => p.slug === "como-receber-pedidos-de-recolhas-e-mudancas-em-lisboa");

  it("existe, com título e descrição que cabem no Google", () => {
    expect(guia).toBeDefined();
    expect([...`${guia!.metaTitle} | CLYON`].length).toBeLessThanOrEqual(60);
    expect([...guia!.description].length).toBeLessThanOrEqual(155);
    expect(guia!.category).toBe("Para parceiros");
  });

  it("liga à candidatura pelo menos três vezes, e não promete o que não é verdade", () => {
    const tudo = [
      guia!.title,
      guia!.description,
      guia!.intro,
      ...guia!.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
      ...guia!.faq.flatMap((f) => [f.question, f.answer]),
    ].join("\n");
    expect(tudo.match(/\]\(\/quero-ser-parceiro/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(tudo).not.toMatch(PROIBIDO);
    expect(tudo).not.toMatch(/guia de transporte|carteira|levantamento|cativo/i);
    // Quem faz o trabalho é o parceiro; ao leitor do blog, nunca «profissional».
    expect(tudo).not.toMatch(/profissiona/i);
  });
});
