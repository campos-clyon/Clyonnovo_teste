import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { destinoInterno, eCaminhoInterno, redireccionamentoDepoisDeEntrar } from "./destino-seguro";

/**
 * Depois de entrar, só se volta para dentro do site.
 *
 * Um destino vindo do endereço que não se verifica é um link com o nosso
 * domínio que acaba noutro sítio — depois de a pessoa ter escrito a
 * palavra-passe no nosso ecrã.
 */

const BASE = "https://clyon.pt";
const BARRA_INVERTIDA = String.fromCharCode(92);
const TAB = String.fromCharCode(9);

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

describe("eCaminhoInterno", () => {
  it("aceita caminhos do site", () => {
    expect(eCaminhoInterno("/conta")).toBe(true);
    expect(eCaminhoInterno("/admin/pedidos?estado=novo#topo")).toBe(true);
  });

  it("recusa o que o browser lê como outro site", () => {
    expect(eCaminhoInterno("//outro.com")).toBe(false);
    expect(eCaminhoInterno(`/${BARRA_INVERTIDA}outro.com`)).toBe(false);
    expect(eCaminhoInterno("https://outro.com")).toBe(false);
    expect(eCaminhoInterno(`/${TAB}/outro.com`)).toBe(false);
    expect(eCaminhoInterno("")).toBe(false);
    expect(eCaminhoInterno(null)).toBe(false);
  });
});

describe("destinoInterno — as entradas do backoffice e dos testes", () => {
  it("devolve o caminho quando é do site", () => {
    expect(destinoInterno("/admin/pedidos?x=1#y", BASE, "/admin")).toBe("/admin/pedidos?x=1#y");
  });

  it("cai no de omissão em tudo o resto", () => {
    for (const mau of [
      "//outro.com",
      `/${BARRA_INVERTIDA}outro.com`,
      "https://outro.com/admin",
      "javascript:alert(1)",
      `/${TAB}/outro.com`,
      null,
      undefined,
    ]) {
      expect(destinoInterno(mau, BASE, "/admin"), String(mau)).toBe("/admin");
    }
  });
});

describe("redireccionamentoDepoisDeEntrar — o callback do NextAuth", () => {
  it("um caminho do site vai para o site", () => {
    expect(redireccionamentoDepoisDeEntrar("/conta/pedidos", BASE)).toBe(`${BASE}/conta/pedidos`);
  });

  it("um endereço completo só passa se for da mesma origem", () => {
    expect(redireccionamentoDepoisDeEntrar(`${BASE}/conta`, BASE)).toBe(`${BASE}/conta`);
    // Os dois que o startsWith deixava passar:
    expect(redireccionamentoDepoisDeEntrar("https://clyon.pt.outro.com/x", BASE)).toBe(`${BASE}/conta`);
    expect(redireccionamentoDepoisDeEntrar("https://clyon.pt@outro.com/x", BASE)).toBe(`${BASE}/conta`);
  });

  it("e os caminhos que o browser lê como outro site também não", () => {
    expect(redireccionamentoDepoisDeEntrar("//outro.com", BASE)).toBe(`${BASE}/conta`);
    expect(redireccionamentoDepoisDeEntrar(`/${BARRA_INVERTIDA}outro.com`, BASE)).toBe(`${BASE}/conta`);
    expect(redireccionamentoDepoisDeEntrar("lixo", BASE)).toBe(`${BASE}/conta`);
  });
});

describe("as três entradas usam-no", () => {
  it("o NextAuth deixou de comparar o texto do endereço", () => {
    const AUTH = lerNu("src/auth.ts");
    expect(AUTH).toContain("redireccionamentoDepoisDeEntrar(url, baseUrl)");
    expect(AUTH).not.toContain("url.startsWith(baseUrl)");
  });

  it("o login do backoffice e a entrada dos testes passam pelo destinoInterno", () => {
    expect(lerNu("src/app/admin/login/page.tsx")).toContain("destinoInterno(");
    const TESTES = lerNu("src/app/plataforma/entrar/EntradaDeTeste.tsx");
    expect(TESTES).toContain("destinoInterno(");
    expect(TESTES).not.toContain('proximo.startsWith("/") ? proximo');
  });
});
