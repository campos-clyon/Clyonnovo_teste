import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * O BOTÃO BRANCO DÁ O TEXTO ESCURO POR OMISSÃO, E NÃO À FORÇA.
 *
 * O globals.css tinha `a.bg-white span, button.bg-white svg` (e companhia) com
 * `color: #0f172a !important`, fora de qualquer camada. Era o contrapeso das
 * regras `[class*="bg-cyan-"]`, que punham texto branco nos botões brancos com
 * `hover:bg-cyan-50`; corrigidas essas a 01-10-2026, sobrou só o peso. Todos os
 * span e svg dentro de um botão branco ficavam quase pretos, pedissem o que
 * pedissem: no cartão do trabalho do painel do profissional (um <button>
 * branco), o «+3» das fotografias ficava escuro sobre o escurecido da
 * fotografia, as pílulas do estado e o «novo» perdiam a cor, o valor deixava
 * de ser verde e uma data já passada deixava de ser vermelha.
 *
 * Agora é `a.bg-white, button.bg-white { color: #0f172a }` dentro de
 * `@layer base`: escuro para quem não disser nada, e qualquer `text-*` do
 * componente (camada `utilities`, que vem depois) ganha-lhe.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

// Só o que o browser lê: o comentário que explica a regra cita a antiga. Só os
// comentários que começam a linha (`tirar-comentarios-sem-comer-codigo.test.ts`).
const REGRAS = CSS.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "");

type Bloco = { selectores: string[]; declaracoes: string; dentroDe: string[] };

/** Os blocos com declarações, cada um com os `@…` que o envolvem. */
function blocos(css: string): Bloco[] {
  const out: Bloco[] = [];
  const pilha: string[] = [];
  let inicio = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      // Depois do último `;`: um `@import …;` antes do bloco não é selector.
      pilha.push(css.slice(inicio, i).split(";").pop()!.trim());
      inicio = i + 1;
    } else if (css[i] === "}") {
      const prelude = pilha.pop() ?? "";
      const corpo = css.slice(inicio, i);
      if (corpo.includes(":") && !prelude.startsWith("@")) {
        out.push({ selectores: prelude.split(",").map((s) => s.trim()), declaracoes: corpo, dentroDe: [...pilha] });
      }
      inicio = i + 1;
    }
  }
  return out;
}

const BLOCOS = blocos(REGRAS);

/** Os selectores que falam do fundo branco inteiro — não do `bg-white/20`. */
const DO_BRANCO = BLOCOS.flatMap((b) =>
  b.selectores.filter((s) => /bg-white(?![\w\\/-])/.test(s)).map((s) => ({ selector: s, bloco: b })),
);

describe("⚠️ o botão branco no globals.css", () => {
  it("dá texto escuro a quem não pede cor, dentro de @layer base", () => {
    // Sanidade: se o corte dos comentários comesse a regra, o resto passava
    // sem guardar nada.
    expect(DO_BRANCO.length).toBeGreaterThan(0);
    for (const s of ["a.bg-white", "button.bg-white"]) {
      const achado = DO_BRANCO.find((d) => d.selector === s);
      expect(achado, s).toBeDefined();
      expect(achado!.bloco.declaracoes).toMatch(/color:\s*#0f172a\s*;/);
      expect(achado!.bloco.dentroDe, s).toContain("@layer base");
    }
  });

  it("sem !important: o text-* do componente ganha-lhe", () => {
    // Com `!important` passava por cima do `text-acao` dos «Simular orçamento»
    // brancos e do `hover:text-acao` dos links brancos.
    for (const { selector, bloco } of DO_BRANCO) {
      expect(bloco.declaracoes, selector).not.toContain("!important");
    }
  });

  it("fora de camada nenhuma regra do branco: aí ganhava a qualquer utilitário", () => {
    for (const { selector, bloco } of DO_BRANCO) {
      expect(bloco.dentroDe.some((p) => p.startsWith("@layer")), selector).toBe(true);
    }
  });

  it("e não pinta o que está lá dentro — os span e os svg ficam com a sua cor", () => {
    // `a.bg-white span`, `button.bg-white:hover svg`, `[class~="bg-white"] > *`:
    // nada pode vir depois da parte que diz `bg-white`. Quem não declara cor
    // herda-a do botão; quem declara, fica com ela.
    for (const { selector } of DO_BRANCO) {
      const depois = selector.slice(selector.lastIndexOf("bg-white") + "bg-white".length);
      expect(depois, selector).not.toMatch(/[\s>+~]/);
    }
  });
});

const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o cartão do trabalho, que é um botão branco", () => {
  const FONTE = semNotas(
    readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8"),
  );
  const inicio = FONTE.indexOf("onClick={() => abrirTrabalho(p)}");
  const CARTAO = FONTE.slice(inicio, FONTE.indexOf("</button>", inicio));

  it("o «novo» escreve no tinta do WhatsApp, e não a branco sobre o verde", () => {
    // Branco sobre #25D366 dá 1,98:1. Saía escuro só por causa da regra antiga.
    expect(inicio).toBeGreaterThan(-1);
    const novo = CARTAO.match(/className="distintivo-novo[^"]*"/)?.[0];
    expect(novo).toBeDefined();
    expect(novo).toContain("bg-[#25D366]");
    expect(novo).toContain("text-whatsapp-tinta");
    expect(novo).not.toMatch(/\btext-white\b/);
  });

  it("e os textos apagados não descem ao slate-400, que ali dá 2,6:1", () => {
    // Nunca se tinham visto: a regra antiga pintava-os de quase preto.
    expect(CARTAO.length).toBeGreaterThan(1000);
    expect(CARTAO).toContain("text-tinta-fraca");
    const spans = CARTAO.match(/<span[^>]*className=\{?[`"][^`"]*[`"]/g) ?? [];
    expect(spans.length).toBeGreaterThan(5);
    for (const s of spans) expect(s, s).not.toMatch(/\btext-slate-[34]00\b/);
  });
});
