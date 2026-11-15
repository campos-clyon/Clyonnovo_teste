import { describe, it, expect } from "vitest";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { oQueOSiteSabe, PRECO_FECHADO_SEM_A_FATURA } from "./o-que-o-site-sabe";
import { PRECO_FECHADO } from "./promessas-publicas";
import { AS_DUAS_FATURAS_DO_TRABALHO } from "./voz-da-vitoria";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * A VITÓRIA E AS DUAS FATURAS — o teste da conversa (15-11-2026, decisão d30).
 *
 * «Passam fatura?» levava «Há fatura em todas as vendas, emitida pela empresa
 * parceira da CLYON, e o preço já vem com IVA» — o modelo de antes. Desde
 * 15-11 o parceiro passa a do trabalho (com IVA ou isento, conforme o regime
 * dele) e a empresa parceira da CLYON a da taxa. A frase é a do Jurídico.
 */

// relógio: datas explícitas — cada chamada leva a data (DEPOIS), nunca a do relógio.
const DEPOIS = new Date("2026-11-15T10:00:00Z");

const FRASE_DO_JURIDICO =
  "Cada trabalho tem duas faturas: a do trabalho, passada pelo parceiro (com IVA ou isento, conforme o regime dele), " +
  "e a da taxa da plataforma, passada pela empresa parceira da CLYON.";

/** As formas antigas, que já não saem da boca da Vitória. */
const ANTIGA = /fatura em todas as vendas|emitida pela empresa parceira/i;

describe("«passam fatura?» → as duas faturas", () => {
  it("a frase é a do Jurídico, carácter a carácter", () => {
    expect(AS_DUAS_FATURAS_DO_TRABALHO).toBe(FRASE_DO_JURIDICO);
  });

  for (const pergunta of ["Passam fatura?", "passam factura?", "Quem emite a fatura?", "Recebo fatura?", "Há fatura?"]) {
    it(`«${pergunta}»`, () => {
      const r = respostaFrequente(pergunta, DEPOIS);
      expect(r).toBe(FRASE_DO_JURIDICO);
      expect(r).not.toMatch(ANTIGA);
    });
  }

  it("o aviso ao modelo diz o mesmo, e já não a frase antiga", () => {
    const t = oQueOSiteSabe(DEPOIS);
    expect(t).toContain(FRASE_DO_JURIDICO);
    expect(t).not.toMatch(ANTIGA);
  });

  it("o preço fechado chega ao modelo sem a fatura de antes (a frase pública é do Site)", () => {
    expect(PRECO_FECHADO_SEM_A_FATURA).not.toMatch(ANTIGA);
    expect(PRECO_FECHADO.startsWith(PRECO_FECHADO_SEM_A_FATURA)).toBe(true);
    expect(PRECO_FECHADO_SEM_A_FATURA).toMatch(/fica fechado antes de começar\.$/);
  });

  it("e tem tradução fixa nas três línguas", () => {
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(FRASE_DO_JURIDICO, l)).toBeTruthy();
  });
});
