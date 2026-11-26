import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * O SITE FALA EM «VOCÊ», E ESCREVE «FATURA» — d4 (26-11-2026).
 *
 * Às pessoas trata-se por você: «Descreva, receba, escolha, peça». Havia
 * páginas públicas em «tu» («Descreve o que precisa, recebe propostas,
 * escolhe») ao lado das outras em «você», e «factura» no texto de uma página.
 * Este teste guarda as duas regras no texto das páginas públicas (sem os
 * comentários, onde a história das mudanças continua a poder dizê-lo).
 */

const RAIZ = join(process.cwd(), "src");

// Fora: o backoffice, a API, as áreas de conta/entrada e o painel do profissional.
const FORA = /^(app\/(api|admin|conta|entrar|profissionais\/(painel|pedidos))|components\/admin)(\/|$)/;
// Textos públicos que vivem em lib.
const LIB_PUBLICA = ["lib/city-content.ts", "lib/blog-data.ts", "lib/perguntas-frequentes.ts"];

function ficheiros(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) ficheiros(caminho, acc);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

function semComentarios(codigo: string): string {
  return codigo
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

const PUBLICOS = ficheiros(RAIZ)
  .map((f) => relative(RAIZ, f).replace(/\\/g, "/"))
  .filter((r) => (/^(app|components)\//.test(r) && !FORA.test(r)) || LIB_PUBLICA.includes(r));

const EM_TU = [
  /\bDescreves?\s+(o|a|os|as|um|uma)\b/,
  /\bdescreve\s+(o|a|os|as|um|uma)\s[^.`"]{0,40}\s(e|,)\s*recebe\b/,
  /\bEscolhe\s+(a|o|que|como|,)/,
  /\bEscolhe,\s+ou\b/,
  /\bPede,\s+recebe\b/,
  /,\s*recebe propostas/,
  /\bRecebe\s+(propostas|as propostas|em menos)\b/,
  /\bVê o nome\b/,
];
const FACTURA = /(?<![\w$.-])[Ff]actura(s|ção)?(?![\w-])/;

describe("as páginas públicas", () => {
  it("há páginas a vigiar", () => {
    expect(PUBLICOS.length).toBeGreaterThan(50);
  });

  it("falam em «você», nunca em «tu» (Descreva, Receba, Escolha, Peça)", () => {
    const achados: string[] = [];
    for (const r of PUBLICOS) {
      const linhas = semComentarios(readFileSync(join(RAIZ, r), "utf8")).split("\n");
      linhas.forEach((l, i) => {
        for (const re of EM_TU) {
          // «o pedido chega a parceiros …, e recebe propostas» é o pedido a receber: fica.
          if (re.test(l) && !/(concelho|Queijas|Abraão), e recebe propostas/.test(l)) {
            achados.push(`${r}:${i + 1}: ${l.trim().slice(0, 90)}`);
            break;
          }
        }
      });
    }
    expect(achados).toEqual([]);
  });

  it("escrevem «fatura», não «factura»", () => {
    const achados: string[] = [];
    for (const r of PUBLICOS) {
      const linhas = semComentarios(readFileSync(join(RAIZ, r), "utf8")).split("\n");
      linhas.forEach((l, i) => {
        if (FACTURA.test(l)) achados.push(`${r}:${i + 1}: ${l.trim().slice(0, 90)}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
