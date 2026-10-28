import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as fonte from "./avaliacoes-publicas";
import {
  AVALIACOES,
  AVALIACOES_NO_GOOGLE,
  CONTAGENS_EM_LINHA,
  NOTAS_EM_FRASE,
  NOTAS_EM_LINHA,
  PERFIL_NA_FIXANDO_URL,
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
  it("a do Google tem número, nota, o dia em que foi vista e o perfil", () => {
    const c = AVALIACOES_NO_GOOGLE;
    expect(c.numero).toBeGreaterThan(0);
    expect(c.nota).toMatch(/^[0-5],\d$/);
    expect(c.vistaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${c.vistaEm}T12:00:00Z`).getTime()).toBeLessThanOrEqual(Date.now());
    expect(c.url).toMatch(/^https:\/\/www\.google\.com\/maps\/place\/\?q=place_id:/);
  });

  it("o número de hoje: 46 no Google (4,9)", () => {
    // Conferido a 25-10-2026, no perfil público.
    expect(AVALIACOES.google).toBe(46);
    expect(AVALIACOES.notaGoogle).toBe("4,9");
  });

  it("as frases dizem a fonte e o mês da contagem", () => {
    expect(mesDaContagem({ vistaEm: "2026-10-25" })).toBe("outubro de 2026");
    expect(NOTAS_EM_FRASE).toBe("4,9 em 46 avaliações no Google (outubro de 2026)");
    expect(CONTAGENS_EM_LINHA).toBe("46 avaliações no Google (outubro de 2026)");
    expect(NOTAS_EM_LINHA).toBe("4,9 no Google");
    expect(avaliacoesNaClyon(1)).toBe("1 avaliação na CLYON");
    expect(avaliacoesNaClyon(12)).toBe("12 avaliações na CLYON");
  });
});

/*
 * SÓ AS DO GOOGLE — 28-10-2026 (dono). A nota, a contagem e as contratações
 * da Fixando saíram de todos os textos e metadados. O perfil fica só no
 * `sameAs` dos dados estruturados.
 */
describe("da Fixando, nenhum número", () => {
  it("a fonte já não tem nota, contagem nem contratações da Fixando", () => {
    const daFixando = Object.keys(fonte).filter((k) => /fixando|contratac/i.test(k));
    expect(daFixando).toEqual(["PERFIL_NA_FIXANDO_URL"]);
    expect(Object.keys(AVALIACOES).filter((k) => /fixando|contratac/i.test(k))).toEqual([]);
    for (const frase of [NOTAS_EM_FRASE, CONTAGENS_EM_LINHA, NOTAS_EM_LINHA]) expect(frase).not.toMatch(/Fixando/);
    expect(PERFIL_NA_FIXANDO_URL).toMatch(/^https:\/\/www\.fixando\.pt\/profile\/\d+\//);
  });

  it("o perfil da Fixando só aparece no sameAs do layout", () => {
    const usam = TODOS.filter((f) => !f.endsWith("avaliacoes-publicas.ts"))
      .filter((f) => /PERFIL_NA_FIXANDO_URL|fixando\.pt/.test(semComentarios(readFileSync(f, "utf8"))))
      .map((f) => f.replace(RAIZ, "").replace(/\\/g, "/"));
    expect(usam).toEqual(["/src/app/layout.tsx"]);
    const L = semComentarios(readFileSync(join(RAIZ, "src/app/layout.tsx"), "utf8"));
    expect(L).toContain('const PERFIS_DO_NEGOCIO = ["https://www.google.com/maps?cid=6227316191619861484", PERFIL_NA_FIXANDO_URL];');
    expect(L).toContain("sameAs: PERFIS_DO_NEGOCIO,");
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
