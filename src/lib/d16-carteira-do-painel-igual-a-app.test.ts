import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROTULOS_DA_CARTEIRA, rotulosDaCarteira } from "./rotulos-da-carteira";

/**
 * D16 — A CARTEIRA DO PAINEL DIZ O MESMO QUE A APP PRO (CEO e dono, 13-11-2026).
 *
 * A app Pro escolhe as notas da carteira por `rotulosDaCarteira(dados.novoModelo
 * != null)` — o modelo dito pelo servidor. O painel do profissional no site
 * fazia o mapa fixo (as notas de antes de 15-11). Agora os dois pela mesma
 * função e pela mesma pergunta.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = semComentarios(ler("src/app/profissionais/painel/Carteira.tsx"));
const APP = semComentarios(ler("app-pro/src/app/(app)/carteira.tsx"));

describe("a carteira do painel e a da app pela mesma função", () => {
  it("os dois perguntam ao servidor (novoModelo), nunca ao relógio", () => {
    expect(APP).toContain("rotulosDaCarteira(noNovoModelo)");
    expect(APP).toContain("const noNovoModelo = dados.novoModelo != null;");
    expect(PAINEL).toContain("const R = rotulosDaCarteira(dados.novoModelo != null);");
    expect(PAINEL).toContain("novoModelo={dados.novoModelo != null}");
    expect(PAINEL).toContain("const R = rotulosDaCarteira(novoModelo);");
    expect(PAINEL).not.toMatch(/ROTULOS_DA_CARTEIRA as R\b/);
  });

  it("as notas que o painel mostra são as da função, nos dois modelos", () => {
    const usadas = [...PAINEL.matchAll(/\bR\.(\w+)\.nota\b/g)].map((m) => m[1]);
    expect(usadas.length).toBeGreaterThan(0);
    const novo = rotulosDaCarteira(true);
    // No modelo novo muda pelo menos uma das notas que o painel mostra.
    expect(usadas.some((k) => novo[k as keyof typeof novo].nota !== ROTULOS_DA_CARTEIRA[k as keyof typeof novo].nota)).toBe(true);
    // Antes, o mapa de sempre; os nomes nunca mudam.
    expect(rotulosDaCarteira(false)).toBe(ROTULOS_DA_CARTEIRA);
    for (const k of Object.keys(ROTULOS_DA_CARTEIRA) as Array<keyof typeof novo>) {
      expect(novo[k].rotulo).toBe(ROTULOS_DA_CARTEIRA[k].rotulo);
    }
  });
});
