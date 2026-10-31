import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDENTIFICACAO } from "./identificacao-legal";

/**
 * SEM DADOS DE PAGAMENTO NO CÓDIGO — 27-10-2026.
 *
 * O repositório é público. Os métodos de pagamento da adjudicação escrevem-se
 * nas Configurações do backoffice e guardam-se na base
 * (`metodos-de-pagamento.ts`); no código não entra um IBAN, um número de
 * MB WAY, um link do Revolut, nem o nome do titular.
 *
 * O nome do titular só pode estar em `identificacao-legal.ts`: é a
 * identificação legal que a lei obriga a publicar (DL 7/2004, art. 10.º), e
 * o resto do site lê-o de lá.
 */

const RAIZ = process.cwd();
const ESTE = "src/lib/sem-dados-de-pagamento-no-codigo.test.ts";

/**
 * O REPOSITÓRIO INTEIRO, PELO GIT — 31-10-2026 (d1). Lia uma lista fixa de
 * pastas (sem a app-cliente/) e lia também ficheiros que não estão no git
 * (neste PC chumbava por um relatório local que nunca foi publicado). Agora
 * lê o que o git guarda (`git ls-files`) — o que vai para o GitHub — e
 * deixa os binários de fora pelo conteúdo.
 */
const TODOS = execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0")
  .filter(Boolean)
  .filter((caminho) => caminho !== ESTE)
  .map((caminho) => ({ caminho, c: join(RAIZ, caminho) }))
  .filter(({ c }) => {
    try {
      const b = readFileSync(c);
      return b.length < 3_000_000 && !b.subarray(0, 8000).includes(0);
    } catch {
      return false; // apagado na árvore de trabalho e ainda no índice
    }
  });

const ler = (c: string) => readFileSync(c, "utf8");

/**
 * Os valores claramente falsos que os testes e os campos de exemplo usam: o
 * IBAN de exemplo publicado (com o dígito certo e o errado), IBANs só de
 * zeros, e os telemóveis de exemplo. Nada disto é a conta de ninguém.
 */
const IBANS_FALSOS = new Set(["PT50000201231234567890154", "PT50000201231234567890155"]);
const TELEMOVEIS_FALSOS = new Set(["912345678", "900000000"]);
const soDigitos = (s: string) => s.replace(/[^0-9A-Z]/gi, "").toUpperCase();
const ibanFalso = (m: string) => IBANS_FALSOS.has(soDigitos(m)) || /^(PT|LT)\d{2}0+$/.test(soDigitos(m));
const telemovelFalso = (m: string) => TELEMOVEIS_FALSOS.has(soDigitos(m).slice(-9));

const REGRA_IBAN = /\b(?:PT|LT)\d{2}(?:[ .-]?\d{4}){3}(?:[ .-]?\d{1,4}){0,4}/gi;
const REGRA_MBWAY = /MB\s?WAY\W{0,6}(?:\+?351\s?)?9\d{2}\s?\d{3}\s?\d{3}/gi;
/** Um BIC/SWIFT escrito a seguir ao rótulo: 4 letras do banco, 2 do país, 2 do local, e 3 da agência ou não. */
const REGRA_BIC = /\b(?:BIC|SWIFT)(?:\s?\/\s?SWIFT)?\W{0,6}[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g;
/** Os de exemplo: com X no lugar do banco. */
const bicFalso = (m: string) => /XXXX/.test(m);

/** Os achados, como «ficheiro:linha», tirando o que `falso` diz ser inventado. */
function onde(
  regra: RegExp,
  excepto: (caminho: string) => boolean = () => false,
  falso: (achado: string) => boolean = () => false,
): string[] {
  const global = new RegExp(regra.source, regra.flags.includes("g") ? regra.flags : regra.flags + "g");
  const achados: string[] = [];
  for (const f of TODOS) {
    if (excepto(f.caminho)) continue;
    const linhas = ler(f.c).split(/\r?\n/);
    linhas.forEach((l, i) => {
      for (const m of l.matchAll(global)) {
        if (!falso(m[0])) achados.push(`${f.caminho}:${i + 1}`);
      }
    });
  }
  return achados;
}

describe("dados de pagamento fora do código", () => {
  it("lê os ficheiros do repositório (a guarda não está a olhar para o vazio)", () => {
    expect(TODOS.length).toBeGreaterThan(500);
    expect(TODOS.some((f) => f.caminho === "src/lib/mensagem-de-adjudicacao.ts")).toBe(true);
    // A app de cliente também (31-10-2026), e nada que o git não guarde.
    expect(TODOS.some((f) => f.caminho.startsWith("app-cliente/"))).toBe(true);
    expect(TODOS.some((f) => f.caminho.endsWith("pente-fino.json"))).toBe(false);
  });

  it("nenhum BIC/SWIFT de uma conta", () => {
    expect(onde(REGRA_BIC, undefined, bicFalso)).toEqual([]);
    // A regra apanha um montado aqui, e deixa passar os de exemplo.
    const bic = ["BIC", ": ", "ZZZZ", "PT", "PL"].join("");
    expect(bic.match(new RegExp(REGRA_BIC.source))).not.toBeNull();
    expect(bicFalso(bic)).toBe(false);
    expect(bicFalso("BIC: XXXXPTPL")).toBe(true);
  });

  it("nenhum IBAN português ou lituano", () => {
    expect(onde(REGRA_IBAN, undefined, ibanFalso)).toEqual([]);
  });

  it("nenhum número de telemóvel a seguir a «MB WAY»", () => {
    expect(onde(REGRA_MBWAY, undefined, telemovelFalso)).toEqual([]);
  });

  it("nenhum link do Revolut", () => {
    expect(onde(/revolut\.me\//i)).toEqual([]);
  });

  it("o nome do titular só na identificação legal", () => {
    const nome = IDENTIFICACAO.nomeLegal;
    expect(nome.split(" ").length).toBeGreaterThan(1);
    const regra = new RegExp(nome.replace(/\s+/g, "\\s+"), "i");
    expect(onde(regra, (c) => c === "src/lib/identificacao-legal.ts")).toEqual([]);
  });

  it("a regra apanha o que deve (com valores inventados)", () => {
    // Montados aqui, para não ficarem escritos inteiros neste ficheiro.
    const iban = ["PT", "00", " 1111", " 2222", " 3333", " 4444", " 5"].join("");
    const lt = ["LT", "00", " 1111", " 2222", " 3333", " 4444"].join("");
    const mbway = ["MB", " WAY: ", "911", " 111", " 111"].join("");
    for (const [regra, texto] of [[REGRA_IBAN, iban], [REGRA_IBAN, lt], [REGRA_MBWAY, mbway]] as const) {
      const m = texto.match(new RegExp(regra.source, "i"));
      expect(m, texto).not.toBeNull();
    }
    expect(ibanFalso(iban)).toBe(false);
    expect(telemovelFalso(mbway)).toBe(false);
    // E os de exemplo passam.
    expect(ibanFalso("PT50 0002 0123 1234 5678 9015 4")).toBe(true);
    expect(telemovelFalso("MB WAY: 912 345 678")).toBe(true);
  });
});
