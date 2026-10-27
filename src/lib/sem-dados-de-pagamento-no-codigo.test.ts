import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

const PASTAS_DE_FORA = new Set(["node_modules", ".git", ".next", ".expo", "dist", "build", "coverage", ".vercel", ".turbo"]);
const TEXTO = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|txt|sql|yml|yaml|html|css|example|env|svg|webmanifest)$/i;

function ficheiros(pasta: string, saida: string[] = []): string[] {
  let nomes: string[];
  try {
    nomes = readdirSync(pasta);
  } catch {
    return saida;
  }
  for (const nome of nomes) {
    if (PASTAS_DE_FORA.has(nome)) continue;
    const caminho = join(pasta, nome);
    let s;
    try {
      s = statSync(caminho);
    } catch {
      continue;
    }
    if (s.isDirectory()) ficheiros(caminho, saida);
    else if (TEXTO.test(nome) && s.size < 3_000_000) saida.push(caminho);
  }
  return saida;
}

// As pastas do repositório; a `.claude/` local (fora do git) não conta.
const PASTAS = ["src", "app-pro", "ponte-whatsapp", "scripts", "docs", "data", "drizzle", "public", ".github"];
const TODOS = [
  ...PASTAS.flatMap((p) => ficheiros(join(RAIZ, p))),
  ...readdirSync(RAIZ)
    .filter((n) => TEXTO.test(n) || n === ".env.example")
    .map((n) => join(RAIZ, n))
    .filter((c) => statSync(c).isFile()),
]
  .map((c) => ({ caminho: relative(RAIZ, c).split(sep).join("/"), c }))
  .filter((f) => f.caminho !== ESTE);

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
