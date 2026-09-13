import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CITIES, SERVICES } from "./seo-data";
import { cabeNoGoogle, tituloCompleto, tituloDaCidade, comExtra } from "./titulos-seo";

/**
 * OS TÍTULOS QUE O GOOGLE MOSTRA INTEIROS.
 *
 * A 13-09-2026, vinte e oito títulos do site passavam dos 60 caracteres e
 * nove escreviam « | CLYON» por cima do que o template do layout já
 * acrescentava — o Google mostrava «… | CLYON | CLYON». O de Lisboa ficava
 * cortado em «Recolha de Móveis em Lisboa — Hoje ou Amanhã, 40 – 120», um
 * intervalo sem unidade.
 *
 * Um título é a única frase que a maioria das pessoas lê antes de decidir se
 * clica. Estes testes são a trava: quem escrever um título comprido, ou
 * repetir a marca, chumba aqui e não no Google três semanas depois.
 */

const LIMITE = 60;
const SUFIXO = " | CLYON";

/** Todos os `page.tsx` debaixo de src/app. */
function paginas(dir: string, encontradas: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) paginas(caminho, encontradas);
    else if (entrada === "page.tsx") encontradas.push(caminho);
  }
  return encontradas;
}

/** Os títulos escritos à mão na metadata — `title: "…"` na margem. */
function titulosDe(ficheiro: string): string[] {
  const fonte = readFileSync(ficheiro, "utf8").replace(/\r\n/g, "\n");
  return [...fonte.matchAll(/^ {2}title: "([^"]+)",$/gm)].map((m) => m[1]);
}

const TODAS = paginas(join(process.cwd(), "src", "app"));

describe("nenhum título repete a marca", () => {
  it("o template do layout já põe « | CLYON» — escrevê-lo outra vez dá-o a dobrar", () => {
    const repetidos: string[] = [];
    for (const ficheiro of TODAS) {
      for (const t of titulosDe(ficheiro)) {
        if (t.trimEnd().endsWith(SUFIXO.trim()) || t.includes("| CLYON")) {
          repetidos.push(`${t}  (${ficheiro.split("src")[1]})`);
        }
      }
    }
    expect(repetidos).toEqual([]);
  });
});

describe("nenhum título é cortado pelo Google", () => {
  it("cabem todos em 60 caracteres, marca incluída", () => {
    const compridos: string[] = [];
    for (const ficheiro of TODAS) {
      for (const t of titulosDe(ficheiro)) {
        const completo = tituloCompleto(t);
        if ([...completo].length > LIMITE) {
          compridos.push(`${[...completo].length}  ${completo}`);
        }
      }
    }
    expect(compridos).toEqual([]);
  });
});

describe("as páginas de cidade cabem, todas, sem excepção", () => {
  it("nenhuma das combinações cidade × serviço passa do limite", () => {
    const compridos: string[] = [];
    for (const city of CITIES) {
      for (const service of SERVICES) {
        const t = tituloDaCidade(service.name, city.name, service.slug, city.slug);
        if (!cabeNoGoogle(t)) compridos.push(`${[...tituloCompleto(t)].length}  ${t}`);
      }
    }
    expect(compridos).toEqual([]);
  });

  it("e nenhuma perde o serviço nem o nome da terra", () => {
    for (const city of CITIES) {
      const t = tituloDaCidade("Recolha de Móveis", city.name, "recolha-moveis", city.slug);
      expect(t).toContain(city.name);
      expect(t).toContain("Recolha de Móveis");
    }
  });
});

describe("comExtra deita fora o dispensável, não o essencial", () => {
  it("com espaço, o extra fica", () => {
    expect(comExtra("Recolha de Móveis em Lisboa", "Hoje")).toBe(
      "Recolha de Móveis em Lisboa — Hoje",
    );
  });

  it("sem espaço, sobra a base inteira", () => {
    const base = "Recolha de Móveis em Vila Nova de Famalicão do Norte";
    expect(comExtra(base, "40 – 120 €")).toBe(base);
  });
});
