import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AVALIACOES,
  AVALIACOES_NA_FIXANDO,
  AVALIACOES_NO_GOOGLE,
  CONTAGENS_EM_LINHA,
  CONTRATACOES_NA_FIXANDO,
  NOTAS_EM_FRASE,
  avaliacoesNaClyon,
  mesDaContagem,
} from "./avaliacoes-publicas";

/*
 * UM SÓ NÚMERO POR FONTE, SEMPRE COM A FONTE — 28-10-2026 (d1).
 *
 * As contagens escritas à mão fora de avaliacoes-publicas.ts chumbam no teste
 * da orquestra (regra j). Este guarda o resto: cada fonte tem número, nota e
 * o dia em que foi vista; não há total; e nenhuma página põe um número das
 * constantes no ecrã sem dizer de onde vem.
 */

const RAIZ = process.cwd();
const semComentarios = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

function ficheiros(dir: string, saida: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) ficheiros(p, saida);
    else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) saida.push(p);
  }
  return saida;
}

const TODOS = [
  ...ficheiros(join(RAIZ, "src", "app")),
  ...ficheiros(join(RAIZ, "src", "components")),
  ...ficheiros(join(RAIZ, "src", "lib")),
];

describe("a fonte das avaliações", () => {
  it("cada fonte tem número, nota, o dia em que foi vista e o perfil", () => {
    for (const c of [AVALIACOES_NO_GOOGLE, AVALIACOES_NA_FIXANDO]) {
      expect(c.numero, c.fonte).toBeGreaterThan(0);
      expect(c.nota, c.fonte).toMatch(/^[0-5],\d$/);
      expect(c.vistaEm, c.fonte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${c.vistaEm}T12:00:00Z`).getTime(), c.fonte).toBeLessThanOrEqual(Date.now());
    }
    expect(AVALIACOES_NO_GOOGLE.url).toMatch(/^https:\/\/www\.google\.com\/maps\/place\/\?q=place_id:/);
    expect(AVALIACOES_NA_FIXANDO.url).toMatch(/^https:\/\/www\.fixando\.pt\/profile\/\d+\//);
    expect(CONTRATACOES_NA_FIXANDO.vistaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("os números de hoje: 46 no Google (4,9) e 119 na Fixando (5,0)", () => {
    // Google conferido a 25-10-2026; Fixando a 28-10-2026, no perfil público.
    expect(AVALIACOES.google).toBe(46);
    expect(AVALIACOES.notaGoogle).toBe("4,9");
    expect(AVALIACOES.fixando).toBe(119);
    expect(AVALIACOES.notaFixando).toBe("5,0");
  });

  it("as frases dizem a fonte e o mês da contagem", () => {
    expect(mesDaContagem({ vistaEm: "2026-10-25" })).toBe("outubro de 2026");
    expect(NOTAS_EM_FRASE).toBe(
      "4,9 em 46 avaliações no Google e 5,0 em 119 na Fixando (outubro de 2026)",
    );
    expect(CONTAGENS_EM_LINHA).toBe("46 no Google · 119 na Fixando (outubro de 2026)");
    expect(avaliacoesNaClyon(1)).toBe("1 avaliação na CLYON");
    expect(avaliacoesNaClyon(12)).toBe("12 avaliações na CLYON");
  });
});

describe("as páginas", () => {
  it("não somam as fontes: o total saiu", () => {
    const comTotal = TODOS.filter((f) => /AVALIACOES_TOTAL/.test(semComentarios(readFileSync(f, "utf8"))));
    expect(comTotal.map((f) => f.replace(RAIZ, ""))).toEqual([]);
  });

  it("um número das constantes nunca aparece sem a fonte ao lado", () => {
    /*
     * `AVALIACOES.google` tem de ter «Google» a menos de 200 caracteres (no
     * mesmo texto, rótulo ou frase), e `.fixando`/`.contratacoes`, «Fixando».
     * Era assim que «165 avaliações» saía sozinho.
     */
    const maus: string[] = [];
    for (const f of TODOS) {
      if (f.endsWith("avaliacoes-publicas.ts")) continue;
      const s = semComentarios(readFileSync(f, "utf8"));
      for (const m of s.matchAll(/AVALIACOES\.(google|fixando|contratacoes)\b(?!Url)/g)) {
        const fonte = m[1] === "google" ? "Google" : "Fixando";
        const perto = s.slice(Math.max(0, m.index! - 200), m.index! + 200);
        if (!perto.includes(fonte)) maus.push(`${f.replace(RAIZ, "")}: AVALIACOES.${m[1]} sem «${fonte}» ao lado`);
      }
    }
    expect(maus).toEqual([]);
  });

  it("as avaliações da plataforma dizem que são da CLYON", () => {
    const perfil = semComentarios(readFileSync(join(RAIZ, "src/app/profissionais/[slug]/page.tsx"), "utf8"));
    expect(perfil).toContain("avaliacoesNaClyon(p.quantasAvaliacoes)");
    expect(perfil).not.toMatch(/\{p\.quantasAvaliacoes\} \{p\.quantasAvaliacoes === 1/);
  });
});
