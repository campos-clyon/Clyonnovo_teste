import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS } from "./blog-data";
import { zonasDoArtigo } from "./blog-zonas";
import { PECAS_DE_REFERENCIA, PRECOS, PRECO_POR_ITEM, precoDaPeca } from "./precos-publicos";
import { MOVEIS_POR_PECA, pecaComOIvaAoLado, valorSemEComIva } from "./preco-de-referencia";
import { RECOLHA_DA_CAMARA } from "./recolha-da-camara";
import { referenciasDaCidade } from "./referencias-da-cidade";

/*
 * OS ARTIGOS DE 14-10-2026 (auditoria de SEO, 90 dias): os números e a
 * Câmara saem das mesmas constantes das páginas — o artigo não pode dizer
 * outra coisa.
 */
const artigo = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug)!;

describe("as peças de referência", () => {
  /*
   * Desde 03-11-2026 (d6 v2) a recolha de móveis é por peça (15 / 30 / 50 € + IVA),
   * e desde a d7 (04-11-2026) as peças de referência seguem essa tabela: o sofá, a
   * cama e o armário grande são peças grandes, a mesa com cadeiras uma média.
   */
  it("seguem a tabela das peças (d7)", () => {
    const tamanhos = Object.fromEntries(PECAS_DE_REFERENCIA.map((p) => [p.peca, p.tamanho]));
    expect(tamanhos).toEqual({
      "Sofá de 2 a 3 lugares": "grande",
      "Cama de casal com estrado": "grande",
      "Armário grande": "grande",
      "Mesa com cadeiras": "medio",
    });
    for (const p of PECAS_DE_REFERENCIA) expect(precoDaPeca(p), p.peca).toBe(PRECO_POR_ITEM[p.tamanho]);
  });

  it("as páginas de cidade e o artigo do sofá dizem as mesmas", () => {
    // Desde 31-10-2026 as da página de cidade saem de `referencias-da-cidade.ts`,
    // com o com IVA ao lado (referencias-da-cidade.test.ts confere os números).
    const cidade = readFileSync(join(process.cwd(), "src/app/[...slug]/page.tsx"), "utf8");
    expect(cidade).toContain("referenciasDaCidade(service.slug, city.name)");
    expect(referenciasDaCidade("recolha-moveis", "Lisboa").map((r) => r.oQue)).toEqual(
      expect.arrayContaining(PECAS_DE_REFERENCIA.map((p) => p.peca)),
    );
    // E cada peça com o com IVA ao lado desde 31-10-2026 (iam só sem IVA).
    const sofa = artigo("quanto-custa-retirar-um-sofa-em-lisboa");
    expect(sofa.sections[0].bullets).toEqual(PECAS_DE_REFERENCIA.map(pecaComOIvaAoLado));
    expect(sofa.sections[0].bullets).toContain("Sofá de 2 a 3 lugares: peça grande, 50 € + IVA (61,50 € com IVA)");
    expect(sofa.sections[0].bullets).toContain("Mesa com cadeiras: peça média, 30 € + IVA (36,90 € com IVA)");
  });
});

describe("«Quanto custa retirar um sofá em Lisboa»", () => {
  const a = artigo("quanto-custa-retirar-um-sofa-em-lisboa");

  it("diz o preço com o com IVA ao lado, e a Câmara como a página da Câmara", () => {
    expect(a.description).toContain("50 € + IVA: é uma peça grande");
    const [precos, legenda] = a.sections[0].paragraphs;
    const sofa = PECAS_DE_REFERENCIA.find((p) => p.peca.startsWith("Sofá"))!;
    expect(precos).toContain(valorSemEComIva(precoDaPeca(sofa)));
    // A recolha de móveis por peça (d6 v2), com a recolha mínima (d7).
    expect(precos).toContain(MOVEIS_POR_PECA);
    expect(precos).toContain("recolha mínima 40 € + IVA (49,20 € com IVA)");
    expect(precos).not.toContain("sem mínimo");
    expect(precos).not.toMatch(/também sem IVA/);
    expect(legenda).not.toMatch(/sem IVA/);
    expect(a.sections.flatMap((s) => s.paragraphs)).toContain(RECOLHA_DA_CAMARA.lisboa!.monos!.texto);
  });

  it("liga às zonas da recolha de móveis", () => {
    expect(zonasDoArtigo(a.slug).zonas.length).toBeGreaterThan(0);
  });
});

describe("«Esvaziar a casa de um familiar»", () => {
  const a = artigo("esvaziar-a-casa-de-um-familiar");

  it("dá os valores da tabela, sem IVA e com a nota", () => {
    const texto = JSON.stringify(a);
    expect(texto).toContain(PRECOS.esvaziamento_apartamento.etiqueta);
    expect(texto).toContain("sem IVA (na proposta, o preço já vem com IVA incluído)");
  });

  it("liga às zonas do esvaziamento", () => {
    expect(zonasDoArtigo(a.slug).zonas.length).toBeGreaterThan(0);
  });
});
