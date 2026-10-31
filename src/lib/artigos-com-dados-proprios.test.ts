import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS } from "./blog-data";
import { zonasDoArtigo } from "./blog-zonas";
import { PECAS_DE_REFERENCIA, PRECOS } from "./precos-publicos";
import { faixaSemEComIva, pecaComOIvaAoLado } from "./preco-de-referencia";
import { RECOLHA_DA_CAMARA } from "./recolha-da-camara";
import { referenciasDaCidade } from "./referencias-da-cidade";

/*
 * OS ARTIGOS DE 14-10-2026 (auditoria de SEO, 90 dias): os números e a
 * Câmara saem das mesmas constantes das páginas — o artigo não pode dizer
 * outra coisa.
 */
const artigo = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug)!;

describe("as peças de referência", () => {
  it("ficam dentro da faixa da recolha de móveis", () => {
    for (const p of PECAS_DE_REFERENCIA) {
      expect(p.minimo, p.peca).toBeGreaterThanOrEqual(PRECOS.recolha_moveis.minimo!);
      expect(p.maximo, p.peca).toBeLessThanOrEqual(PRECOS.recolha_moveis.maximo!);
    }
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
    expect(sofa.sections[0].bullets).toContain("Sofá de 2 a 3 lugares: 40 – 70 € + IVA (49,20 – 86,10 € com IVA)");
  });
});

describe("«Quanto custa retirar um sofá em Lisboa»", () => {
  const a = artigo("quanto-custa-retirar-um-sofa-em-lisboa");

  it("diz o preço com o com IVA ao lado, e a Câmara como a página da Câmara", () => {
    expect(a.description).toMatch(/\d+ a \d+ € \+ IVA/);
    const [precos, legenda] = a.sections[0].paragraphs;
    const sofa = PECAS_DE_REFERENCIA.find((p) => p.peca.startsWith("Sofá"))!;
    expect(precos).toContain(faixaSemEComIva(sofa.minimo, sofa.maximo));
    expect(precos).toContain(faixaSemEComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!));
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
