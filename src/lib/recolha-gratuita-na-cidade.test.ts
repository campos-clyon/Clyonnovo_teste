import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PRECOS, PRECO_POR_ITEM } from "./precos-publicos";
import { comIva, euros } from "./quanto-custa";
import {
  ANCORA_DA_RECOLHA_GRATUITA,
  PRECO_DOS_MOVEIS,
  QUANDO_COMPENSA_UM_PARCEIRO,
  RECOLHA_GRATUITA_NA_CIDADE,
  recolhaGratuitaNaCidade,
} from "./recolha-gratuita-na-cidade";

/*
 * «Recolha gratuita de móveis usados» em Lisboa e Setúbal — 02-11-2026.
 * Uma secção nas páginas de móveis que já ganham a pesquisa, não uma página
 * nova (ver o cabeçalho de recolha-gratuita-na-cidade.ts).
 */

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8").replace(/\r\n/g, "\n");

function todosOsTextos(): string[] {
  const out: string[] = [...QUANDO_COMPENSA_UM_PARCEIRO, PRECO_DOS_MOVEIS];
  for (const c of Object.values(RECOLHA_GRATUITA_NA_CIDADE)) {
    out.push(c.titulo, c.intro, c.camara.titulo, ...c.camara.frases);
    for (const d of c.doar) out.push(d.nome, d.oQueDiz);
    for (const f of c.faqs) out.push(f.q, f.a);
  }
  return out;
}

describe("recolha gratuita de móveis usados — Lisboa e Setúbal", () => {
  it("só existe nas páginas de móveis de Lisboa e de Setúbal", () => {
    expect(Object.keys(RECOLHA_GRATUITA_NA_CIDADE).sort()).toEqual(["lisboa", "setubal"]);
    expect(recolhaGratuitaNaCidade("recolha-moveis", "lisboa")).not.toBeNull();
    expect(recolhaGratuitaNaCidade("recolha-moveis", "setubal")).not.toBeNull();
    expect(recolhaGratuitaNaCidade("recolha-monos", "lisboa")).toBeNull();
    expect(recolhaGratuitaNaCidade("recolha-moveis", "almada")).toBeNull();
  });

  it("o preço sai da fonte única, com o IVA ao lado", () => {
    // A recolha mínima é o «desde» dos móveis desde a d7 (04-11-2026); as peças, a tabela.
    const { minimo } = PRECOS.recolha_moveis;
    expect(PRECO_DOS_MOVEIS).toContain(`recolha mínima ${minimo} € + IVA (${euros(comIva(minimo!))} com IVA)`);
    expect(PRECO_DOS_MOVEIS).toContain(euros(comIva(PRECO_POR_ITEM.grande)));
    expect(PRECO_DOS_MOVEIS).toMatch(/\+ IVA \(.+ com IVA\)/);
  });

  it("fala como plataforma e não promete o que não se faz", () => {
    for (const t of todosOsTextos()) {
      expect(t).not.toMatch(/profissiona(l|is)/i);
      expect(t).not.toMatch(/verificad[oa]s?/i);
      expect(t).not.toMatch(/pr[óo]prio dia|mesmo dia/i);
      expect(t).not.toMatch(/contentor|big ?bag/i);
      expect(t).not.toMatch(/\bfactura\b/i);
    }
  });

  it("cada via gratuita e cada doação cita a fonte oficial", () => {
    for (const c of Object.values(RECOLHA_GRATUITA_NA_CIDADE)) {
      expect(c.camara.fontes.length).toBeGreaterThan(0);
      for (const f of c.camara.fontes) expect(f.url).toMatch(/^https:\/\/([a-z-]+\.)?(lisboa\.pt|sms-setubal\.pt)\//);
      expect(c.doar.length).toBeGreaterThan(0);
      for (const d of c.doar) expect(d.fonte.url).toMatch(/^https:\/\//);
      expect(c.faqs.length).toBeGreaterThan(0);
    }
  });

  it("a página de cidade mostra a secção, com a âncora, e junta as perguntas ao FAQPage", () => {
    const pagina = ler("src/app/[...slug]/page.tsx");
    expect(pagina).toContain("recolhaGratuitaNaCidade(service.slug, city.slug)");
    expect(pagina).toContain("id={ANCORA_DA_RECOLHA_GRATUITA}");
    expect(pagina).toContain("...(gratuita ? gratuita.faqs : [])");
  });

  it("a página de doar liga às duas secções", () => {
    const doar = ler("src/app/recolha-gratuita-de-moveis-usados/page.tsx");
    expect(ANCORA_DA_RECOLHA_GRATUITA).toBe("recolha-gratuita");
    expect(doar).toContain("/recolha-moveis-lisboa#${ANCORA_DA_RECOLHA_GRATUITA}");
    expect(doar).toContain("/recolha-moveis-setubal#${ANCORA_DA_RECOLHA_GRATUITA}");
  });
});
