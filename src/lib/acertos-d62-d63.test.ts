import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ITENS_A_MAIS_PARA_O_CLIENTE, TABELA_DOS_ITENS_A_MAIS } from "./itens-a-mais";
import { comIvaDaEtiqueta, etiquetaDoCartao, linhaDeReferencia, precoDeReferencia } from "./preco-de-referencia";
import { PECAS_EM_TEXTO, PRECOS } from "./precos-publicos";
import { lembrarPrecoPublico, SEM_PARCEIROS, type PrecoPublicoDasMudancas } from "./preco-publico-das-mudancas";
import { TAXA_IVA } from "./taxas-plataforma";

/*
 * ACERTOS DA D62/D63 — 17-11-2026. O que ainda dizia os preços de antes da d60:
 * os itens a mais («grande 50 €» sozinho), a referência dos monos («60 – 100 €»
 * em texto público) e o com IVA da mudança nos cartões (67,65 €/h, o da equipa
 * de 3, por baixo da etiqueta da equipa de 2, 40 €/h).
 */

/** «1 599,00» → 1599 */
const numero = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

/** Os números de um texto, pela ordem («260 – 1 300 €» → 260, 1300). */
const valores = (t: string) => [...t.matchAll(/\d{1,3}(?:\s\d{3}(?!\d))*(?:,\d+)?/g)].map((m) => numero(m[0]));

const comIva = (v: number) => Math.round(v * (1 + TAXA_IVA) * 100) / 100;

afterEach(() => lembrarPrecoPublico(SEM_PARCEIROS));

describe("d62/d63 — os itens a mais pela tabela da d60", () => {
  it("a tabela dos itens a mais é a da fonte única, com a primeira grande a 65 €", () => {
    expect(TABELA_DOS_ITENS_A_MAIS).toBe(`${PECAS_EM_TEXTO} + IVA`);
    expect(TABELA_DOS_ITENS_A_MAIS).toContain("grande 65 € a primeira e 50 € as seguintes");
  });

  it("ao cliente, com o com IVA de cada valor certo", () => {
    expect(ITENS_A_MAIS_PARA_O_CLIENTE).toBe(
      "cada item a mais conta pela tabela das peças: pequena 15 €, média 30 €, grande 65 € a primeira e 50 € as seguintes + IVA (18,45 / 36,90 / 79,95 e 61,50 € com IVA)",
    );
    const [semIva, emComIva] = ITENS_A_MAIS_PARA_O_CLIENTE.split("+ IVA");
    expect(valores(emComIva)).toEqual(valores(semIva).map(comIva));
  });
});

describe("d62/d63 — os monos, «desde» no texto público", () => {
  it("a referência dos monos diz o «desde 60 € + IVA (73,80 € com IVA)»", () => {
    expect(precoDeReferencia("recolha_monos")).toBe("desde 60 € + IVA (73,80 € com IVA)");
    expect(linhaDeReferencia("recolha_monos")).not.toMatch(/100/);
    expect(comIvaDaEtiqueta("recolha_monos")).toBe("desde 73,80 € com IVA");
  });

  it("o tecto fica no motor (PRECOS.recolha_monos não mudou)", () => {
    expect(PRECOS.recolha_monos.minimo).toBe(60);
    expect(PRECOS.recolha_monos.maximo).toBe(100);
  });
});

describe("d62/d63 — o com IVA ao lado de cada etiqueta é a etiqueta × 1,23", () => {
  /** A linha grande e a pequena de um cartão: os números da segunda são os da primeira com IVA. */
  function mesmoPreco(servico: string) {
    const grande = etiquetaDoCartao(servico);
    const pequena = comIvaDaEtiqueta(servico);
    if (grande == null || pequena == null) return;
    expect(valores(pequena), `${servico}: ${grande} | ${pequena}`).toEqual(valores(grande).map(comIva));
  }

  it("sem parceiros na lista: a mudança diz 40 €/h e 49,20 €/h", () => {
    expect(etiquetaDoCartao("mudanca")).toBe("referência desde 40 €/hora + IVA");
    expect(comIvaDaEtiqueta("mudanca")).toBe("referência desde 49,20 €/hora com IVA");
    expect(comIvaDaEtiqueta("mudanca")).not.toContain("67,65");
    for (const s of Object.keys(PRECOS)) if (s !== "recolha_moveis") mesmoPreco(s);
  });

  it("com parceiros na lista: as duas linhas dizem o «desde» da lista", () => {
    const lista: PrecoPublicoDasMudancas = { tipo: "parceiros", parceiros: 2, desde: { semIvaCent: 4500, comIvaCent: 5535 } };
    lembrarPrecoPublico(lista);
    expect(etiquetaDoCartao("mudanca")).toBe("desde 45 €/hora + IVA");
    expect(comIvaDaEtiqueta("mudanca")).toBe("desde 55,35 €/hora com IVA");
    mesmoPreco("mudanca");
  });

  it("os cartões de /contactos e de /servicos lêem as duas linhas da mesma fonte", () => {
    for (const f of ["src/app/contactos/page.tsx", "src/app/servicos/[slug]/page.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).toContain("etiquetaDoCartao(");
      expect(s, f).toContain("comIvaDaEtiqueta(");
    }
  });
});
