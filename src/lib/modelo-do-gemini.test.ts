import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODELO_ACTUAL, RETIRADOS, escadaLimpa, modeloDoGemini } from "./modelo-do-gemini";

/**
 * O dia em que a Google retirou o modelo por baixo do assistente.
 *
 *   [404 Not Found] This model models/gemini-2.5-flash is no longer available
 *   to new users. Please update your code to use models/gemini-3.6-flash
 *
 * Todas as chamadas devolviam 404, a escada caía para o irmão da mesma
 * geração — no mesmo caso —, e o cérebro passou o dia a responder só ao que
 * conseguia ler por palavras-chave.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("uma variável esquecida a apontar para um modelo morto não cala o assistente", () => {
  it("o retirado é ignorado, e vale o actual", () => {
    expect(modeloDoGemini("gemini-2.5-flash")).toBe(MODELO_ACTUAL);
  });

  it("e o primeiro que estiver vivo é o que manda", () => {
    expect(modeloDoGemini("gemini-2.5-flash", "gemini-3.6-pro")).toBe("gemini-3.6-pro");
  });

  it("sem variável nenhuma, o actual", () => {
    expect(modeloDoGemini(undefined, "")).toBe(MODELO_ACTUAL);
  });

  it("o actual não pode estar na lista dos retirados", () => {
    expect(RETIRADOS.has(MODELO_ACTUAL)).toBe(false);
  });
});

describe("a escada não tem degraus podres nem repetidos", () => {
  it("o retirado sai, e o actual fica sempre no fim", () => {
    expect(escadaLimpa("gemini-2.0-flash")).toEqual([MODELO_ACTUAL]);
  });

  it("um modelo vivo fica à frente do actual", () => {
    expect(escadaLimpa("gemini-3.6-pro")).toEqual(["gemini-3.6-pro", MODELO_ACTUAL]);
  });

  it("e o actual não aparece duas vezes", () => {
    expect(escadaLimpa(MODELO_ACTUAL)).toEqual([MODELO_ACTUAL]);
  });
});

describe("ninguém volta a escrever o nome do modelo à mão", () => {
  const FICHEIROS = [
    "src/lib/whatsapp-compreensao.ts",
    "src/lib/calendar-helpers.ts",
    "src/app/api/simulator/analyze/route.ts",
  ];

  it("quem fala pelo @google/generative-ai passa por modelo-do-gemini", () => {
    for (const f of FICHEIROS) {
      const fonte = ler(f);
      // Fora dos comentários, que contam a história e citam os nomes velhos.
      const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect({ f, tem: /"gemini-[012]\./.test(codigo) }).toEqual({ f, tem: false });
      expect(codigo).toMatch(/modeloDoGemini|MODELO_ACTUAL/);
    }
  });

  it("o chat do simulador não partilha a variável do WhatsApp", () => {
    /*
     * Ele fala pelo SDK `ai`, que exige o nome com fornecedor à frente
     * («google/gemini-…»). Lia GEMINI_MODEL, portanto arranjar o WhatsApp
     * nessa variável punha-lhe lá um nome seco e partia-o.
     */
    const chat = ler("src/app/api/chat-simulador/route.ts");
    expect(chat).not.toContain("process.env.GEMINI_MODEL");
    expect(chat).toContain("process.env.CHAT_MODEL");
  });
});
