import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/*
 * O MENU TRANSPARENTE NO TOPO — pedido de 01-10-2026, com a Toki como exemplo.
 *
 * No topo das páginas públicas o menu não tem fundo e vê-se por trás dele o
 * degradê do primeiro bloco; ao descer ganha o fundo branco e a linha. São três
 * peças que só funcionam juntas: o Header que muda com o scroll, o SiteChrome
 * que o liga só nas páginas públicas, e a classe `sob-o-menu` que faz o
 * primeiro bloco subir para trás dele.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const HEADER = ler("src/components/Header.tsx");
const CHROME = ler("src/components/SiteChrome.tsx");
const CSS = ler("src/app/globals.css");

function tsx(dir = join(process.cwd(), "src/app"), acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) tsx(caminho, acc);
    else if (nome.endsWith(".tsx")) acc.push(caminho);
  }
  return acc;
}

describe("o menu transparente no topo", () => {
  it("o Header muda com o scroll, e só quando lho pedem", () => {
    expect(HEADER).toMatch(/transparenteNoTopo = false/);
    expect(HEADER).toMatch(/window\.scrollY < DESCIDA_QUE_CONTA/);
    expect(HEADER).toMatch(/addEventListener\("scroll", ver, \{ passive: true \}\)/);
    expect(HEADER).toContain('"border-transparent bg-transparent shadow-none"');
    expect(HEADER).toContain('"border-slate-100 bg-white shadow-sm"');
  });

  it("só as páginas públicas o ligam — os painéis ficam com o menu branco", () => {
    // Num painel o topo é a barra da aplicação; sem fundo, desaparecia a
    // fronteira entre o menu e o conteúdo.
    expect(CHROME.match(/<Header transparenteNoTopo \/>/g)).toHaveLength(1);
    expect(CHROME.match(/<Header \/>/g)).toHaveLength(1);
    expect(CHROME.indexOf("<Header />")).toBeLessThan(CHROME.indexOf("<Header transparenteNoTopo />"));
    expect(CHROME.indexOf("if (isDashboard)")).toBeLessThan(CHROME.indexOf("<Header />"));
  });

  it("o padding do <main> e o `sob-o-menu` usam a mesma altura", () => {
    expect(CHROME.match(/pt-\(--altura-do-menu\)/g)).toHaveLength(2);
    expect(CHROME).not.toMatch(/pt-\[(53|61)px\]/);
    const regra = CSS.match(/\.sob-o-menu \{([^}]*)\}/)?.[1] ?? "";
    expect(regra).toMatch(/margin-top: calc\(-1 \* var\(--altura-do-menu\)\);/);
    expect(regra).toMatch(/padding-top: var\(--altura-do-menu\);/);
  });

  it("⚠️ um bloco com `sob-o-menu` não tem padding nem margem de cima próprios", () => {
    /*
     * A classe dá-lhe padding-top e margem negativa; um `pt-8` ou `py-12` no
     * mesmo elemento era pisado em silêncio, e o conteúdo subia para debaixo
     * do menu. Quem tinha padding passou-o para o contentor de dentro.
     */
    const maus: string[] = [];
    let vistos = 0;
    for (const f of tsx()) {
      ler(relative(process.cwd(), f)).split("\n").forEach((linha, i) => {
        if (/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(linha)) return;
        const classe = linha.match(/className="([^"]*\bsob-o-menu\b[^"]*)"/)?.[1];
        if (!classe) return;
        vistos++;
        if (/(^|\s)([a-z]+:)*-?(p|pt|py|m|mt|my)-/.test(classe)) maus.push(`${relative(process.cwd(), f)}:${i + 1}`);
      });
    }
    // Eram 24 a 01-10-2026; se cair para zero, foi a procura que se partiu.
    expect(vistos).toBeGreaterThan(20);
    expect(maus).toEqual([]);
  });
});
