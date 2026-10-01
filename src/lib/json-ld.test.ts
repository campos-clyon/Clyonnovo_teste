import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { jsonLd } from "./json-ld";

/**
 * Os dados estruturados não podem fechar a etiqueta onde vivem.
 *
 * A página de cada profissional põe no JSON-LD o nome e a cidade que ele
 * próprio escreve no painel. Com `JSON.stringify`, um nome com `</script>`
 * fechava a etiqueta e o resto passava a ser HTML da página pública.
 */

describe("jsonLd", () => {
  it("um </script> lá dentro deixa de fechar a etiqueta", () => {
    expect(jsonLd("</script><script>")).not.toContain("</script>");
    const saida = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(saida).not.toContain("</script>");
    expect(saida).not.toContain("<");
    expect(saida).not.toContain(">");
    expect(saida).toContain("\\u003c/script\\u003e");
  });

  it("escapa também o & e os dois separadores de linha do JavaScript", () => {
    const saida = jsonLd({ a: "x & y", b: "linha\u2028outra\u2029fim" });
    expect(saida).not.toContain("&");
    expect(saida).not.toContain("\u2028");
    expect(saida).not.toContain("\u2029");
    expect(saida).toContain("\\u0026");
    expect(saida).toContain("\\u2028");
    expect(saida).toContain("\\u2029");
  });

  it("continua a ser JSON válido, e igual ao original depois de lido", () => {
    const dados = {
      "@type": "LocalBusiness",
      name: "Mudanças <Silva> & Filhos",
      nota: 4.8,
      zonas: ["Almada", "Seixal"],
      estranho: "a\u2028b",
    };
    expect(JSON.parse(jsonLd(dados))).toEqual(dados);
  });
});

/**
 * Todas as páginas, e não só a do profissional.
 *
 * Uma regra com excepções é uma regra que alguém copia do sítio errado: a
 * próxima página com dados vindos da base nasce a partir de uma destas.
 */
describe("nenhum application/ld+json usa JSON.stringify directo", () => {
  const RAIZ = join(process.cwd(), "src");

  function ficheiros(pasta: string): string[] {
    const saida: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
    }
    return saida;
  }

  const semComentarios = (f: string) =>
    f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

  const COM_JSON_LD = [...ficheiros(join(RAIZ, "app")), ...ficheiros(join(RAIZ, "components"))]
    .map((caminho) => ({ caminho, codigo: semComentarios(readFileSync(caminho, "utf8")) }))
    .filter((f) => f.codigo.includes("application/ld+json"));

  it("há páginas que chegue para o teste valer alguma coisa", () => {
    expect(COM_JSON_LD.length).toBeGreaterThanOrEqual(25);
  });

  it("cada uma passa pelo jsonLd", () => {
    for (const { caminho, codigo } of COM_JSON_LD) {
      expect(codigo, caminho).not.toMatch(/__html:\s*JSON\.stringify\(/);
      expect(codigo, caminho).toMatch(/from "@\/lib\/json-ld"/);
    }
  });
});
