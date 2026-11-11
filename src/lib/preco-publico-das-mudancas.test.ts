import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MODELO_DA_MUDANCA,
  REFERENCIA_DA_MUDANCA,
  SEM_PARCEIROS,
  ofertaDaMudanca,
  precoDaMudancaCurto,
  precoDaMudancaNaCabeca,
  precoDaMudancaNoWhatsApp,
  precoDaMudancaPorExtenso,
  precoPublicoDosCandidatos,
  regrasDaMudancaParaOModelo,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";
import type { CandidatoDaMudanca } from "./lista-de-parceiros-da-mudanca";
import type { TarifaDasMudancas } from "./conta-da-mudanca";

/*
 * O PREÇO PÚBLICO DAS MUDANÇAS — 11-11-2026 («Textos e nota Google»).
 * A regra: com ≥ 1 parceiro na lista, o «desde» real (a hora mais baixa com 2
 * pessoas); sem nenhum, a referência, dita como referência. Nunca o sem IVA
 * sozinho; «parceiro», nunca «profissional»; sem «no próprio dia».
 */

const TARIFA: TarifaDasMudancas = {
  precoHora2: 45,
  precoHora3: 60,
  minimoHoras: 2,
  precoKm: 0.8,
  kmMinimo: 0,
  kmMaximo: 100,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: null,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};

function candidato(over: Partial<CandidatoDaMudanca> = {}): CandidatoDaMudanca {
  return {
    nome: "Exemplo",
    contaDeTeste: false,
    verificado: true,
    tarifa: TARIFA,
    notaMedia: null,
    avaliacoes: 0,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudanca"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    ...over,
  } as CandidatoDaMudanca;
}

describe("o «desde» sai dos parceiros que entrariam na lista", () => {
  it("o preço da hora mais baixo com 2 pessoas, como o cliente o paga (taxa dentro, IVA por cima)", () => {
    const p = precoPublicoDosCandidatos([
      candidato({ tarifa: { ...TARIFA, precoHora2: 45 } }),
      candidato({ tarifa: { ...TARIFA, precoHora2: 38.5 } }),
    ]);
    expect(p).toMatchObject({ tipo: "parceiros", parceiros: 2, desde: { semIvaCent: 3850, comIvaCent: 4736 } });
    // E o mais baixo com 3 pessoas (11-11-2026: T3 e T4+ só com 3), quando algum faz com 3.
    if (TARIFA.precoHora3 != null) expect(p.tipo === "parceiros" && p.desde3).toBeTruthy();
  });

  it("fora: contas de teste, fora da lista, sem tarifa, inactivos, não aprovados, sem mudanças", () => {
    const fora = [
      candidato({ contaDeTeste: true, tarifa: { ...TARIFA, precoHora2: 20 } }),
      candidato({ tarifa: { ...TARIFA, precoHora2: 21, aparecerNaLista: false } }),
      candidato({ tarifa: null }),
      candidato({ isActive: false, tarifa: { ...TARIFA, precoHora2: 22 } }),
      candidato({ estado: "pendente", tarifa: { ...TARIFA, precoHora2: 23 } }),
      candidato({ categorias: ["recolha_moveis"], tarifa: { ...TARIFA, precoHora2: 24 } }),
    ];
    expect(precoPublicoDosCandidatos(fora)).toEqual(SEM_PARCEIROS);
    const p = precoPublicoDosCandidatos([...fora, candidato()]);
    expect(p.tipo === "parceiros" && p.desde.semIvaCent).toBe(4500);
  });

  it("sem candidatos, a referência", () => {
    expect(precoPublicoDosCandidatos([])).toEqual(SEM_PARCEIROS);
  });
});

describe("os textos", () => {
  const COM: PrecoPublicoDasMudancas = { tipo: "parceiros", parceiros: 1, desde: { semIvaCent: 4000, comIvaCent: 4920 } };

  it("com parceiros: o «desde», a equipa de 2 e o convite a comparar", () => {
    expect(precoDaMudancaNaCabeca(COM)).toBe(
      "Mudanças à hora desde 40,00 € + IVA/h (49,20 € com IVA), equipa de 2 — compare os parceiros e escolha.",
    );
    expect(ofertaDaMudanca(COM)?.priceSpecification.price).toBe(40);
  });

  it("sem parceiros: a referência de hoje, dita como referência, e sem preço nos dados estruturados", () => {
    expect(REFERENCIA_DA_MUDANCA).toBe("referência: 50,00 € + IVA por hora (61,50 € com IVA), equipa de 3, mínimo de 3 horas");
    expect(precoDaMudancaCurto(SEM_PARCEIROS)).toBe(REFERENCIA_DA_MUDANCA);
    expect(ofertaDaMudanca(SEM_PARCEIROS)).toBeUndefined();
  });

  it("o modelo: lista, nota, preço por hora, equipa de 2 ou 3, material, folha do dia", () => {
    for (const t of ["parceiros disponíveis", "nota", "preço por hora", "equipa de 2 ou 3", "material", "folha do dia", "parceiro que escolher"]) {
      expect(MODELO_DA_MUDANCA).toContain(t);
    }
    expect(precoDaMudancaPorExtenso(COM)).toContain(MODELO_DA_MUDANCA);
  });

  it("nenhum texto diz «profissional», «no próprio dia», nem o sem IVA sozinho", () => {
    const todos = [SEM_PARCEIROS, COM].flatMap((p) => [
      precoDaMudancaCurto(p),
      precoDaMudancaPorExtenso(p),
      precoDaMudancaNoWhatsApp(p),
    ]);
    for (const t of todos) {
      expect(t).not.toMatch(/profissiona/i);
      expect(t).not.toMatch(/pr[óo]prio dia/i);
      expect(t).toMatch(/\+ IVA[^.]*com IVA/);
    }
  });

  it("a Vitória manda para o simulador de mudanças e não promete um preço fixo", () => {
    expect(precoDaMudancaNoWhatsApp(SEM_PARCEIROS)).toContain("clyon.pt/simulador?servico=mudanca");
    expect(regrasDaMudancaParaOModelo(SEM_PARCEIROS)).toContain("nunca prometas um preço fixo");
    expect(regrasDaMudancaParaOModelo(COM)).toContain("O mais baixo hoje, com 2 pessoas: 40 €/hora");
  });
});

describe("quem lê o preço público", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it("a leitura da base tem cache de 1 h e cai na referência sem base", () => {
    const L = ler("src/lib/ler-preco-publico-das-mudancas.ts");
    expect(L).toContain("SEGUNDOS_DO_PRECO_PUBLICO = 3600");
    expect(L).toContain("unstable_cache(");
    expect(L).toContain("listaDeParceirosNasMudancasLigada");
  });

  it("as páginas das mudanças, a Vitória e a app de cliente lêem-no", () => {
    for (const f of [
      "src/app/mudancas/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/app/precos/mudancas/page.tsx",
      "src/app/pequenas-mudancas/page.tsx",
      "src/app/mudancas-de-escritorio/page.tsx",
      "src/app/transporte-de-moveis/page.tsx",
      "src/app/api/cliente/referencia/route.ts",
      "src/app/api/mudancas/preco-publico/route.ts",
    ]) {
      expect(ler(f), f).toContain("precoPublicoDasMudancas()");
    }
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain("m.precoPublicoDasMudancas()");
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain('fetch("/api/mudancas/preco-publico")');
  });

  it("as páginas das mudanças revêem-se de hora a hora", () => {
    for (const f of [
      "src/app/mudancas/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/app/precos/mudancas/page.tsx",
      "src/app/pequenas-mudancas/page.tsx",
      "src/app/mudancas-de-escritorio/page.tsx",
      "src/app/transporte-de-moveis/page.tsx",
    ]) {
      expect(ler(f), f).toContain("export const revalidate = 3600;");
    }
  });

  it("já ninguém diz «pela tabela da CLYON» nas mudanças", () => {
    for (const f of [
      "src/lib/mudancas-cidades.ts",
      "src/lib/localidades-dos-concelhos.ts",
      "src/components/mudancas/VaiMudarDeCasa.tsx",
      "src/app/pequenas-mudancas/page.tsx",
      "src/app/mudancas-de-escritorio/page.tsx",
      "src/app/transporte-de-moveis/page.tsx",
    ]) {
      expect(ler(f), f).not.toMatch(/pela tabela da\s+CLYON/);
    }
  });
});
