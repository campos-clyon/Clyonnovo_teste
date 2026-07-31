import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escaparHtml, jsonParaScript } from "./escapar-html";

describe("escaparHtml", () => {
  it("fecha os cinco caracteres que quebram HTML", () => {
    expect(escaparHtml("<script>")).toBe("&lt;script&gt;");
    expect(escaparHtml('a"b')).toBe("a&quot;b");
    expect(escaparHtml("a'b")).toBe("a&#39;b");
    expect(escaparHtml("Pais & Filhos")).toBe("Pais &amp; Filhos");
  });

  it("escapa o & primeiro, para não escapar duas vezes", () => {
    // Se o & fosse tratado depois do <, saía "&amp;lt;" em vez de "&lt;"
    expect(escaparHtml("<")).toBe("&lt;");
    expect(escaparHtml("&lt;")).toBe("&amp;lt;");
  });

  /**
   * O caso real: alguém preenche o formulário de contacto com um botão que
   * aponta para outro sítio. Sem escapar, a CLYON envia esse botão num email
   * seu, de noreply@clyon.pt, com o aspecto dos nossos.
   */
  it("um botão de phishing no campo do nome sai como texto", () => {
    const ataque = '<a href="https://sitio-falso">Confirmar pagamento</a>';
    const saida = escaparHtml(ataque);
    // O texto "href=" continua lá — como TEXTO, que é o que se quer. O que
    // não pode existir é uma etiqueta viva: sem "<a", o cliente de email
    // mostra os caracteres em vez de desenhar um link.
    expect(saida).not.toContain("<a ");
    expect(saida).not.toContain("</a>");
    expect(saida).toContain("&lt;a href=&quot;");
  });

  it("fechar uma etiqueta a meio deixa de ser possível", () => {
    expect(escaparHtml('"><img src=x onerror=alert(1)>')).not.toContain("<img");
  });

  it("nulos não viram a palavra undefined no meio da frase", () => {
    expect(escaparHtml(null)).toBe("");
    expect(escaparHtml(undefined)).toBe("");
    expect(escaparHtml(0)).toBe("0");
    expect(escaparHtml(false)).toBe("false");
  });

  it("texto normal com acentos não é tocado", () => {
    expect(escaparHtml("Mudança de casa — Almada, 3º andar")).toBe("Mudança de casa — Almada, 3º andar");
  });
});

describe("jsonParaScript", () => {
  it("um </script> lá dentro deixa de fechar a etiqueta", () => {
    const saida = jsonParaScript({ nome: "</script><script>alert(1)</script>" });
    expect(saida).not.toContain("</script>");
    expect(saida).toContain("\\u003c");
  });

  it("continua a ser JSON válido depois de escapado", () => {
    const dados = { a: "<b>", c: "x & y", d: [1, 2] };
    expect(JSON.parse(jsonParaScript(dados))).toEqual(dados);
  });
});

/**
 * Os templates de email são montados com template strings. Um `${...}` cru,
 * sem passar pelo escape, é uma porta aberta — e é fácil de reintroduzir sem
 * ninguém reparar, porque o email continua a chegar bem.
 */
describe("os templates de email escapam o que vem de fora", () => {
  const ficheiros = [
    "src/app/api/contact/route.ts",
    "src/lib/email-orcamento.ts",
    "src/lib/email-status.ts",
    "src/lib/email-avaliacao.ts",
  ];

  it.each(ficheiros)("%s importa o escape", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    expect(src).toContain("escapar-html");
  });
});
