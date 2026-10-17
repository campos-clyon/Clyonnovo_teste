import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFERTA_DA_MUDANCA, PRECO_POR_HORA } from "./tabela-das-mudancas";

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
  it("é o da tabela, à hora e sem IVA", () => {
    expect(OFERTA_DA_MUDANCA.priceSpecification.price).toBe(PRECO_POR_HORA);
    expect(OFERTA_DA_MUDANCA.priceSpecification.unitCode).toBe("HUR");
    expect(OFERTA_DA_MUDANCA.priceSpecification.valueAddedTaxIncluded).toBe(false);
  });

  it("todas as páginas de mudanças o declaram, e nenhuma escreve outro", () => {
    for (const f of [
      "src/app/mudancas/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
      "src/app/precos/mudancas/page.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toMatch(/(offers|oferta): OFERTA_DA_MUDANCA/);
      expect(codigo, f).not.toMatch(/"@type": "(Aggregate)?Offer"/);
      expect(codigo, f).not.toMatch(/lowPrice|minPrice/);
    }
  });

  it("e mostram-no: a tabela ou o cartão do preço", () => {
    expect(ler("src/app/mudancas/page.tsx")).toContain("<TabelaDasMudancas />");
    expect(ler("src/components/mudancas/PaginaDeTipoDeMudanca.tsx")).toContain("<TabelaDasMudancas compacta />");
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toContain("{PRECO_DA_MUDANCA_CURTO}");
  });

  it("o cartão do preço de cada cidade liga à página «quanto custa»", () => {
    expect(semComentarios(ler("src/app/mudancas/[cidade]/page.tsx"))).toContain('<Link href="/precos/mudancas"');
  });
});

describe("as páginas fortes ligam às mudanças", () => {
  const BLOCO = ler("src/components/mudancas/VaiMudarDeCasa.tsx");

  it("o bloco liga a /mudancas, ao preço e às pequenas mudanças, com o preço da tabela", () => {
    for (const href of ['href="/mudancas"', 'href="/precos/mudancas"', 'href="/pequenas-mudancas"']) {
      expect(BLOCO).toContain(href);
    }
    expect(BLOCO).toContain("{PRECO_DA_MUDANCA_CURTO}");
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
