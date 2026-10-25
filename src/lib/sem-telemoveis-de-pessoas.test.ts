import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

/**
 * NENHUM TELEMÓVEL DE UMA PESSOA NO CÓDIGO — 25-10-2026.
 *
 * O repositório é público. Os testes e os comentários contavam casos reais
 * com o número de quem escreveu, e um número no GitHub fica lá para sempre.
 * Nos exemplos usam-se números inventados: o 912 345 678, os da forma
 * 9x0 000 xxx, ou nove algarismos iguais depois do 9. O único verdadeiro que
 * pode aparecer é o da CLYON.
 */

const RAIZ = join(process.cwd(), "src");
const EXTENSOES = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".md"]);

/** Um telemóvel português: 9 seguido de 1, 2, 3 ou 6, com ou sem indicativo e espaços. */
const TELEMOVEL = /(?<!\d|\d\.)(?:(?:\+|00)?351[\s-]?)?(9[1236]\d(?:[\s-]?\d{3}){2})(?!\d|\.\d)/g;

const DA_CLYON = "931632622";
const EXEMPLO = "912345678";
const permitido = (n: string) =>
  n === DA_CLYON || n === EXEMPLO || /^9[1236]0000\d{3}$/.test(n) || /^9(\d)\1{7}$/.test(n);

function ficheiros(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(p, out);
    else if (EXTENSOES.has(extname(nome))) out.push(p);
  }
  return out;
}

function telemoveisEm(texto: string): string[] {
  return [...texto.matchAll(TELEMOVEL)].map((m) => m[1].replace(/\D/g, ""));
}

describe("telemóveis no código", () => {
  it("a regra apanha as formas em que um número se escreve", () => {
    for (const escrito of ["913 000 001", "913000001", "+351 913 000 001", "351913000001", "00351913000001", "913-000-001"]) {
      expect(telemoveisEm(`ligue para ${escrito}.`), escrito).toEqual(["913000001"]);
    }
    // Um fixo não é telemóvel, e um pedaço de um número maior também não.
    expect(telemoveisEm("213 000 001")).toEqual([]);
    expect(telemoveisEm("12913000001")).toEqual([]);
    // Nem as coordenadas de um ícone.
    expect(telemoveisEm('d="M21 13.255A23.931 23.931 0 0112 15"')).toEqual([]);
  });

  it("os inventados e o da CLYON passam; um a sério não", () => {
    expect(permitido("912345678")).toBe(true);
    expect(permitido("931632622")).toBe(true);
    expect(permitido("960000556")).toBe(true);
    expect(permitido("911111111")).toBe(true);
    expect(permitido("913000001")).toBe(false);
  });

  it("nenhum ficheiro de src/ tem o telemóvel de uma pessoa", () => {
    const achados: string[] = [];
    // Este ficheiro fica de fora: o número inventado que a regra tem de recusar está escrito aqui em cima.
    const esteFicheiro = join(RAIZ, "lib", "sem-telemoveis-de-pessoas.test.ts");
    for (const f of ficheiros(RAIZ).filter((f) => f !== esteFicheiro)) {
      const linhas = readFileSync(f, "utf8").split(/\r?\n/);
      linhas.forEach((linha, i) => {
        for (const n of telemoveisEm(linha)) {
          if (!permitido(n)) achados.push(`${relative(process.cwd(), f).replace(/\\/g, "/")}:${i + 1} ${n}`);
        }
      });
    }
    expect(achados).toEqual([]);
  });
});
