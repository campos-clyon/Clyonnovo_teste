import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * As regras do ciano no globals.css procuram a CLASSE INTEIRA.
 *
 * Até 01-10-2026 eram `button[class*="bg-cyan-"]` (texto branco) e
 * `[class*="bg-cyan-50"]` (texto na cor da marca), com `!important`. O `*=`
 * casa com um pedaço de texto em qualquer sítio do atributo, e «bg-cyan-50» é
 * um pedaço de «bg-cyan-500»: o «Enviar convite» do backoffice
 * (`bg-cyan-600 hover:bg-cyan-500 text-white`) saía com texto azul-petróleo
 * sobre ciano, e os distintivos tingidos do backoffice escuro
 * (`bg-cyan-500/20 text-cyan-200`) com azul-petróleo sobre preto.
 *
 * Enquanto isto esteve partido, as agendas e a secção dos Profissionais
 * passaram a escrever o ciano em hexadecimal (`bg-[#0891B2]`). Ficaram assim:
 * não fazem mal, e na agenda o hexadecimal continua a ser preciso — os blocos
 * claros querem texto escuro, e a regra da marca pinta, de propósito, o texto
 * de qualquer botão `bg-cyan-50`.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

// Os comentários do globals.css citam os selectores antigos para explicar
// porque saíram — só conta o que o browser lê.
const REGRAS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Os blocos `selectores { declarações }`, com os selectores um a um. */
const BLOCOS = REGRAS.split("}")
  .map((b) => b.split("{"))
  .filter((p) => p.length >= 2)
  .map((p) => ({
    selectores: p[p.length - 2].split(",").map((s) => s.trim()),
    declaracoes: p[p.length - 1],
  }));

function corDe(selector: string): string | undefined {
  const bloco = BLOCOS.find((b) => b.selectores.includes(selector));
  return bloco?.declaracoes.match(/color:\s*([^;]+);/)?.[1].trim();
}

describe("⚠️ as regras do ciano no globals.css", () => {
  it("não procuram «bg-cyan-50» nem «bg-cyan-» como pedaço da classe", () => {
    // Sanidade: se o corte dos comentários comesse as regras, isto passava
    // sem guardar nada.
    expect(REGRAS).toContain('[class~="bg-cyan-50"]');

    expect(REGRAS).not.toContain('[class*="bg-cyan-50"]');
    expect(REGRAS).not.toContain('[class*="bg-cyan-"]');
  });

  it("nem nenhum fundo, de cor nenhuma, por pedaço, prefixo ou sufixo", () => {
    // `^=`, `$=` e `|=` têm o mesmo defeito que o `*=`: «bg-cyan-50» é o
    // início de «bg-cyan-500/20». Só `~=` (a classe inteira) e `=` servem.
    // Apanha também `[class*="hover\\:bg-…"]`, que esteve cá sem nunca casar
    // com nada (no HTML a classe não tem a barra).
    expect(REGRAS).not.toMatch(/\[\s*class\s*[*^$|]=\s*["']?[^"'\]]*bg-/);
  });

  it("um botão de fundo ciano escuro continua com texto branco", () => {
    for (const s of [
      'a[class~="bg-cyan-600"]',
      'a[class~="bg-cyan-700"]',
      'button[class~="bg-cyan-600"]',
      'button[class~="bg-cyan-700"]',
    ]) {
      expect(corDe(s), s).toMatch(/^#fff(fff)?\s*!important$/i);
    }
  });

  it("mas o 400 e o 500 não: aí quem decide é o componente", () => {
    // Branco sobre eles dá 1,8:1 e 2,4:1, e os botões do backoffice com esses
    // fundos pedem `text-slate-950`. A regra larga passava-lhes por cima.
    for (const tom of ["400", "500"]) {
      expect(REGRAS).not.toContain(`[class~="bg-cyan-${tom}"]`);
      expect(REGRAS).not.toMatch(new RegExp(`(a|button)\\.bg-cyan-${tom}\\b`));
    }
  });

  it("e um fundo bg-cyan-50 continua com o texto na cor da marca", () => {
    for (const s of ['a[class~="bg-cyan-50"]', 'button[class~="bg-cyan-50"]', 'button[class~="bg-cyan-50"] span']) {
      expect(corDe(s), s).toMatch(/^var\(--color-acao\)\s*!important$/);
    }
  });

  it("as pílulas só levam a cor da marca nos tons que a substituem sobre claro", () => {
    // `.rounded-full[class*="text-cyan-"]` apanhava as pílulas do backoffice
    // escuro (`text-cyan-200`, `text-cyan-300`) e pintava-as de azul-petróleo
    // sobre preto.
    expect(REGRAS).not.toMatch(/\.rounded-full\[class\*="text-cyan-/);
    expect(corDe('.rounded-full[class~="text-cyan-700"]')).toMatch(/^var\(--color-acao\)/);
  });

  it("e um botão branco que pede a cor da marca fica com ela", () => {
    // Era a regra do `bg-cyan-50`, por pedaço de texto, que salvava o
    // `text-acao` dos «Simular orçamento» brancos — o `bg-white` pinta tudo de
    // escuro. Corrigida essa, o que era acaso ficou escrito.
    expect(corDe("a.bg-white.text-acao")).toMatch(/^var\(--color-acao\)\s*!important$/);
    expect(corDe("a.bg-white.text-acao svg")).toMatch(/^var\(--color-acao\)\s*!important$/);
  });
});
