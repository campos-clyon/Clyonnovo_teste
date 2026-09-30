import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O TOKEN ANTIGO DO ORÇAMENTO, COM DUAS TRAVAS.
 *
 * /orcamento/<token> vive com o token em claro e sem prazo, e ainda é gerado
 * pela aprovação no backoffice. Até passar para hash e prazo, como o acesso
 * ao pedido, fica com limite por IP e sem consultas por textos que não têm a
 * forma de um token nosso.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ROTA = semComentarios(ler("src/app/api/orcamento/[token]/route.ts"));
const DB = semComentarios(ler("src/lib/db.ts"));

function funcao(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}`);
  expect(i, nome).toBeGreaterThan(-1);
  return fonte.slice(i, fonte.indexOf("export async function", i + 10));
}

describe("a rota pública do orçamento", () => {
  it("tem limite por IP a ler e a agir", () => {
    expect(funcao(ROTA, "GET")).toContain('limitarRotaPublica(req, "orcamento-token-ler"');
    expect(funcao(ROTA, "POST")).toContain('limitarRotaPublica(req, "orcamento-token-agir"');
  });
});

describe("a base só é perguntada por um token com forma de token", () => {
  it("getOrderByToken recusa antes de consultar", () => {
    const f = funcao(DB, "getOrderByToken");
    const recusa = f.indexOf("FORMA_DO_TOKEN_DE_ORCAMENTO.test(token)");
    expect(recusa).toBeGreaterThan(-1);
    expect(recusa).toBeLessThan(f.indexOf("pool.execute"));
    expect(DB).toContain("const FORMA_DO_TOKEN_DE_ORCAMENTO = /^[a-f0-9]{64}$/;");
  });

  it("a forma é a do gerador — se um mudar, o outro tem de mudar", () => {
    expect(funcao(DB, "setOrcamentoToken")).toContain('randomBytes(32).toString("hex")');
  });
});
