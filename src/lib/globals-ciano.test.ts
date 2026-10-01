import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
 * passaram a escrever o ciano em hexadecimal. Os botões dos Profissionais
 * (`bg-[#0891B2]`) passaram depois a `bg-acao`, com os outros (lá em baixo); a
 * agenda ficou em hexadecimal, que lá continua a ser preciso — os blocos claros
 * querem texto escuro, e a regra da marca pinta, de propósito, o texto de
 * qualquer botão `bg-cyan-50`.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

// Os comentários do globals.css citam os selectores antigos para explicar
// porque saíram — só conta o que o browser lê. Só os que começam a linha, como
// em todos os testes (`tirar-comentarios-sem-comer-codigo.test.ts`); os de
// meio de linha, como o `/* icones */`, ficam, e se um dia citarem um selector
// proibido o teste chumba alto em vez de passar calado.
const REGRAS = CSS.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "");

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

  // O `text-acao` dos «Simular orçamento» brancos teve aqui uma excepção
  // escrita (`a.bg-white.text-acao`), porque a regra do `bg-white` pintava tudo
  // de escuro com `!important`. Essa regra passou para a camada `base` sem
  // `!important`, e o utilitário ganha-lhe sozinho — quem o guarda agora é o
  // `globals-bg-white.test.ts`.
});

/** Todos os .tsx de src/. */
function componentes(dir = join(process.cwd(), "src"), acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) componentes(caminho, acc);
    else if (nome.endsWith(".tsx")) acc.push(caminho);
  }
  return acc;
}

describe("⚠️ texto branco não vai sobre ciano claro", () => {
  it("nenhum componente junta text-white a bg-cyan-400, 500 ou 600 — nem no hover", () => {
    /*
     * Branco sobre `cyan-400` dá 1,8:1, sobre `cyan-500` 2,4:1 e sobre
     * `cyan-600` 3,6:1 — todos abaixo dos 4,5:1, e o próprio @theme do
     * globals.css conta que foi por isso que a marca passou a ter uma cor de
     * acção. A 01-10-2026 sobravam 43 botões assim (os «Pedir orçamento»
     * do fim das páginas, «Entrar» do profissional, «Aceitar pedido», o
     * «Enviar convite» — este com o 600 escrito em hexadecimal, `#0891B2`);
     * passaram a `bg-acao` e `hover:bg-acao-hover`, 5,04:1 e 6,9:1.
     *
     * Conta a classe sozinha e com `hover:`/`active:` (um hover que clareava
     * para o 500 deixava o botão ilegível no instante em que o dedo lá está).
     * `bg-cyan-500/20` é outra coisa. Linhas de comentário não contam.
     */
    const fundo = /(^|[\s"'`]|hover:|active:)bg-(cyan-(400|500|600)|\[#0891B2\])(?=[\s"'`]|$)/i;
    const branco = /(^|[\s"'`])text-white(?=[\s"'`]|$)/;
    const maus: string[] = [];
    for (const f of componentes()) {
      readFileSync(f, "utf8")
        .split(/\r?\n/)
        .forEach((linha, i) => {
          if (/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(linha)) return;
          if (fundo.test(linha) && branco.test(linha)) maus.push(`${relative(process.cwd(), f)}:${i + 1}`);
        });
    }
    expect(maus).toEqual([]);
  });
});
