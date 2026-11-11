import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ofertaDaMudanca, SEM_PARCEIROS } from "./preco-publico-das-mudancas";

/**
 * AS MUDANÇAS GANHAM FORÇA — 17-10-2026.
 *
 * *«Agora faz as mudanças.»* — o dono, no plano do raio-X da Fixando. As
 * mudanças estão na posição 31 do Search Console. Duas coisas no site:
 *
 *   · os dados estruturados declaram a tabela à hora, que todas as páginas de
 *     mudanças mostram desde 13-10-2026 (antes não declaravam nada, porque o
 *     número de então não era o que o motor praticava);
 *   · as páginas de monos, de móveis e de esvaziamento — as mais fortes do
 *     site — passam a ligar às mudanças, que não tinham ligação nenhuma delas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t: string) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o preço da hora nos dados estruturados", () => {
  it("é o «desde» dos parceiros, à hora e sem IVA; sem parceiros, não há preço (11-11-2026)", () => {
    const o = ofertaDaMudanca({ tipo: "parceiros", parceiros: 1, desde: { semIvaCent: 4250, comIvaCent: 5228 } });
    expect(o?.priceSpecification.price).toBe(42.5);
    expect(o?.priceSpecification.unitCode).toBe("HUR");
    expect(o?.priceSpecification.valueAddedTaxIncluded).toBe(false);
    expect(ofertaDaMudanca(SEM_PARCEIROS)).toBeUndefined();
  });

  it("todas as páginas de mudanças o declaram, e nenhuma escreve outro", () => {
    for (const f of [
      "src/app/mudancas/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
      "src/app/precos/mudancas/page.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toMatch(/(offers|oferta): ofertaDaMudanca\(preco\)/);
      expect(codigo, f).not.toMatch(/"@type": "(Aggregate)?Offer"/);
      expect(codigo, f).not.toMatch(/lowPrice|minPrice/);
    }
  });

  it("e mostram-no: a tabela ou o cartão do preço", () => {
    expect(ler("src/app/mudancas/page.tsx")).toContain("<TabelaDasMudancas preco={preco} />");
    expect(ler("src/components/mudancas/PaginaDeTipoDeMudanca.tsx")).toContain("<TabelaDasMudancas compacta preco={preco} />");
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toContain("{precoDaMudancaCurto(preco)}");
  });

  it("o cartão do preço de cada cidade liga à página «quanto custa»", () => {
    expect(semComentarios(ler("src/app/mudancas/[cidade]/page.tsx"))).toContain('<Link href="/precos/mudancas"');
  });
});

describe("as páginas fortes ligam às mudanças", () => {
  const BLOCO = ler("src/components/mudancas/VaiMudarDeCasa.tsx");

  it("o bloco liga a /mudancas, ao preço e às pequenas mudanças, com o modelo das mudanças", () => {
    for (const href of ['href="/mudancas"', 'href="/precos/mudancas"', 'href="/pequenas-mudancas"']) {
      expect(BLOCO).toContain(href);
    }
    expect(BLOCO).toContain("{MODELO_DA_MUDANCA_CURTO}");
  });

  it("está nas páginas de monos, de móveis e de esvaziamento", () => {
    for (const f of [
      "src/app/recolha-de-monos/page.tsx",
      "src/app/recolha-de-moveis/page.tsx",
      "src/app/esvaziamento-de-casas/page.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toContain('import VaiMudarDeCasa from "@/components/mudancas/VaiMudarDeCasa";');
      expect(codigo, f).toContain("<VaiMudarDeCasa />");
    }
  });
});
