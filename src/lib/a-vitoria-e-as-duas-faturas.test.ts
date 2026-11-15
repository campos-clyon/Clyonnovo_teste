import { describe, it, expect } from "vitest";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { oQueOSiteSabe, PRECO_FECHADO_SEM_A_FATURA } from "./o-que-o-site-sabe";
import { PRECO_FECHADO } from "./promessas-publicas";
import { AS_DUAS_FATURAS_DO_TRABALHO } from "./voz-da-vitoria";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { NA_PROPOSTA_COM_IVA } from "./seo-data";
import { notaDoPrecoPara, O_IVA_ESTA_INCLUIDO } from "./whatsapp-recolha";

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

/**
 * «É COM IVA?» — 15-11-2026 (d30, a segunda frase). Com parceiros isentos, «os
 * preços já vêm com IVA incluído» deixou de ser verdade para todos: a Vitória
 * diz o mesmo que o site (`NA_PROPOSTA_COM_IVA`), na recolha, nas perguntas
 * frequentes e no aviso ao modelo.
 */
describe("«é com IVA?» → o total a pagar, com IVA ou isento", () => {
  const FRASE_DO_SITE = "Na proposta, o preço já é o total a pagar: com IVA incluído ou isento, conforme o regime do parceiro.";
  const ANTIGA_DO_IVA = /já vêm com IVA|já vem com IVA incluído/i;

  it("a frase da Vitória é a do site, importada", () => {
    expect(NA_PROPOSTA_COM_IVA).toBe(FRASE_DO_SITE);
    expect(O_IVA_ESTA_INCLUIDO).toBe(NA_PROPOSTA_COM_IVA);
  });

  for (const pergunta of ["É com IVA?", "O preço é com IVA?", "Já inclui o IVA?"]) {
    it(`«${pergunta}» nas perguntas frequentes`, () => {
      const r = respostaFrequente(pergunta, DEPOIS) ?? "";
      expect(r).toContain(FRASE_DO_SITE);
      expect(r).not.toMatch(ANTIGA_DO_IVA);
    });
  }

  it("a meio da recolha: «Quanto custa? É com IVA?»", () => {
    const nota = notaDoPrecoPara("Quanto custa? É com IVA?", "andar", false, "recolha_monos");
    expect(nota).toContain(FRASE_DO_SITE);
    expect(nota).not.toMatch(ANTIGA_DO_IVA);
  });

  it("o aviso ao modelo diz o mesmo", () => {
    const t = oQueOSiteSabe(DEPOIS);
    expect(t).toContain(FRASE_DO_SITE);
    expect(t).not.toMatch(ANTIGA_DO_IVA);
  });

  it("e tem tradução fixa nas três línguas", () => {
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(FRASE_DO_SITE, l)).toBeTruthy();
  });
});
