import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO, O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO, oQueAClyonFaz } from "./frase-unica";
import { instrucaoDaLeitura } from "./leitura-das-conversas";
import { instrucaoDaLicao } from "./propor-licoes";
import { buildAnalysisPrompt } from "./prompt-do-orcamento";
import { QUEM_E_A_CLYON_NO_MODELO_ANTIGO, QUEM_E_A_CLYON_NO_NOVO_MODELO, quemEACLYON } from "./whatsapp-compreensao";
import { COMO_SE_PAGA_NO_WHATSAPP } from "./o-pagamento-da-vitoria";
import { COMO_SE_PAGA_NO_NOVO_MODELO } from "./pagamento-na-plataforma";
import { SO_PARA_OS_DADOS_DO_PEDIDO } from "./pagar-ao-parceiro";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { COMO_SE_PAGA } from "./seo-data";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";

/**
 * OS AVISOS AOS MODELOS DA VITÓRIA PELA DATA — d16 (I&D, 13-11-2026).
 *
 * A leitura das conversas, as lições, o orçamentista, o resumo operacional e a
 * compreensão diziam ao modelo que «a CLYON organiza, guarda o acordo e o
 * pagamento». Desde 15-11 o pagamento do trabalho já não passa pela CLYON:
 * lêem «o que a CLYON faz» de `frase-unica.ts`, pela data. Antes da data nada
 * muda. Sem mensagens a ninguém.
 */

const ANTES = new Date("2026-11-14T23:59:00Z");
const DEPOIS = new Date("2026-11-15T10:00:00Z");
const ANTIGA = "guarda o acordo e o pagamento";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("o que a CLYON faz, pela data", () => {
  it("antes de 15-11, a de sempre; desde 15-11, sem o pagamento", () => {
    expect(oQueAClyonFaz(ANTES)).toBe(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO);
    expect(oQueAClyonFaz(DEPOIS)).toBe(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO);
    expect(falaDoModeloAntigo(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO, "cliente")).toBeNull();
    expect(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO).toContain(ANTIGA);
  });

  it("a compreensão diz o mesmo de antes, e lê a mesma frase", () => {
    expect(QUEM_E_A_CLYON_NO_MODELO_ANTIGO.endsWith(`e ${O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO}`)).toBe(true);
    expect(QUEM_E_A_CLYON_NO_NOVO_MODELO.endsWith(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO)).toBe(true);
    expect(quemEACLYON(DEPOIS)).not.toContain(ANTIGA);
  });
});

describe("os avisos aos modelos", () => {
  it("a leitura das conversas e as lições: a de sempre antes, a nova depois", () => {
    expect(instrucaoDaLeitura(ANTES)).toContain(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO);
    expect(instrucaoDaLeitura(DEPOIS)).toContain(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO);
    expect(instrucaoDaLeitura(DEPOIS)).not.toContain(ANTIGA);
    expect(instrucaoDaLicao(ANTES)).toContain(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO);
    expect(instrucaoDaLicao(DEPOIS)).toContain(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO);
    expect(instrucaoDaLicao(DEPOIS)).not.toContain(ANTIGA);
  });

  it("com a data simulada (fora da produção), o orçamentista diz o modelo novo", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NOVO_MODELO_DATA_SIMULADA", "2026-11-16T10:00:00Z");
    const p = buildAnalysisPrompt("(o pedido)", "(as regras)");
    expect(p).toContain(O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO);
    expect(p).not.toContain(ANTIGA);
  });

  it("em produção a data simulada é ignorada — e antes da data, o de sempre", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NOVO_MODELO_DATA_SIMULADA", "2026-11-16T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(ANTES);
    try {
      expect(buildAnalysisPrompt("(o pedido)", "(as regras)")).toContain(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO);
      expect(instrucaoDaLeitura()).toContain(O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO);
    } finally {
      vi.useRealTimers();
    }
  });

  it("o resumo operacional para o profissional lê a mesma frase, pela data", () => {
    const f = readFileSync(join(process.cwd(), "src/lib/calendar-helpers.ts"), "utf8");
    expect(f).toContain("${oQueAClyonFaz(agoraDoModelo())}");
    expect(f).not.toContain(ANTIGA);
  });
});

describe("«Como se paga?» da Vitória lê o texto do site", () => {
  it("desde 15-11 é o «como se paga» do site, com «pague só para esses dados»", () => {
    expect(COMO_SE_PAGA_NO_WHATSAPP.startsWith(COMO_SE_PAGA_NO_NOVO_MODELO)).toBe(true);
    expect(COMO_SE_PAGA_NO_WHATSAPP).toContain(SO_PARA_OS_DADOS_DO_PEDIDO);
    expect(respostaFrequente("Como se paga?", DEPOIS)).toBe(COMO_SE_PAGA_NO_WHATSAPP);
  });
  it("antes de 15-11, a de sempre", () => {
    expect(respostaFrequente("Como se paga?", ANTES)).toBe(COMO_SE_PAGA);
  });
});
