import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Metadata } from "next";

/**
 * OS METADADOS DE TODAS AS PÁGINAS PÚBLICAS, LIDOS COMO O NEXT OS LÊ.
 *
 * Os outros testes de SEO deste repositório lêem o código como texto, e isso
 * não chega para metadados: o título de uma página de cidade é montado por
 * uma função, a description leva preços e prazos de constantes, e o que o
 * Google recebe é o resultado. A 29-09-2026 havia duas páginas com o mesmo
 * título palavra por palavra (/recolha-de-monos e /recolha-monos-lisboa),
 * treze com a marca duas vezes («… | CLYON | CLYON») e 144 descriptions
 * acima do que o Google mostra — nenhuma delas visível a ler o ficheiro.
 *
 * Aqui importa-se cada página pública (as geradas também, pelos
 * `generateStaticParams`) e mede-se o que ela declara.
 */

const APP = join(process.cwd(), "src", "app");

/**
 * Áreas que não são para o Google: backoffice, rotas de API, a conta e as
 * entradas, os links com token e o que está atrás do portão do MVP. O perfil
 * público de um profissional vem da base e tem os seus próprios testes.
 */
const PRIVADAS = ["admin", "api", "auth", "conta", "entrar", "orcamento", "pedido", "plataforma", "profissionais"];

/** Todos os page.tsx públicos, como caminhos relativos a src/app. */
function paginasPublicas(dir = APP, achadas: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (dir === APP && PRIVADAS.includes(nome)) continue;
      paginasPublicas(caminho, achadas);
    } else if (nome === "page.tsx") {
      achadas.push(relative(APP, caminho).split(sep).join("/"));
    }
  }
  return achadas;
}

type Entrada = { rota: string; meta: Metadata };

/** O endereço de uma página, com os parâmetros de `generateStaticParams`. */
function rotaDe(ficheiro: string, params: Record<string, string | string[]>): string {
  const segmentos = ficheiro.replace(/(^|\/)page\.tsx$/, "").split("/").filter(Boolean);
  const partes = segmentos.map((s) => {
    const catchAll = s.match(/^\[\.\.\.(\w+)\]$/);
    if (catchAll) return ([] as string[]).concat(params[catchAll[1]]).join("/");
    const dinamico = s.match(/^\[(\w+)\]$/);
    if (dinamico) return String(params[dinamico[1]]);
    return s;
  });
  return `/${partes.join("/")}`;
}

/** O título tal como sai no <title>, com o template do layout. */
function tituloFinal(t: Metadata["title"]): string {
  if (!t) return "";
  if (typeof t === "string") return `${t} | CLYON`;
  if ("absolute" in t && t.absolute) return t.absolute;
  if ("default" in t && t.default) return `${t.default} | CLYON`;
  return "";
}

const indexavel = (m: Metadata) => {
  const r = m.robots;
  if (!r) return true;
  if (typeof r === "string") return !r.includes("noindex");
  return r.index !== false;
};

let PAGINAS: Entrada[] = [];

beforeAll(async () => {
  const entradas: Entrada[] = [];
  for (const ficheiro of paginasPublicas()) {
    const mod = await import(/* @vite-ignore */ join(APP, ficheiro));
    const temMeta = typeof mod.generateMetadata === "function" || mod.metadata;
    if (!temMeta) continue; // páginas que só redireccionam
    const dinamica = ficheiro.includes("[");
    const lista: Array<Record<string, string | string[]>> = dinamica
      ? typeof mod.generateStaticParams === "function"
        ? await mod.generateStaticParams()
        : []
      : [{}];
    for (const params of lista) {
      const meta: Metadata =
        typeof mod.generateMetadata === "function"
          ? await mod.generateMetadata({ params: Promise.resolve(params) }, Promise.resolve({}))
          : mod.metadata;
      if (indexavel(meta)) entradas.push({ rota: rotaDe(ficheiro, params), meta });
    }
  }
  PAGINAS = entradas;
}, 120_000);

describe("os títulos", () => {
  it("encontra as páginas todas — as fixas e as geradas", () => {
    const rotas = PAGINAS.map((p) => p.rota);
    expect(rotas).toContain("/");
    expect(rotas).toContain("/recolha-de-monos");
    expect(rotas).toContain("/recolha-monos-lisboa");
    expect(rotas).toContain("/mudancas/sintra");
    expect(rotas).toContain("/regioes/margem-sul");
    expect(PAGINAS.length).toBeGreaterThan(150);
  });

  it("não há duas páginas com o mesmo título", () => {
    /*
     * /recolha-de-monos e /recolha-monos-lisboa diziam as duas «Recolha de
     * Monos em Lisboa — Sem Esperar a Câmara». Com o mesmo título para a
     * mesma pesquisa, o Google indexa uma e deixa a outra de fora — e os
     * sinais das duas ficam divididos.
     */
    const porTitulo = new Map<string, string[]>();
    for (const { rota, meta } of PAGINAS) {
      const t = tituloFinal(meta.title);
      porTitulo.set(t, [...(porTitulo.get(t) ?? []), rota]);
    }
    const repetidos = [...porTitulo.entries()].filter(([, rotas]) => rotas.length > 1);
    expect(repetidos).toEqual([]);
  });

  it("nenhum título leva a marca duas vezes", () => {
    // O template do layout acrescenta « | CLYON». Um título que já acabava
    // em «— CLYON» ou «| CLYON» saía no Google com a marca a dobrar.
    const dobrados = PAGINAS.map(({ rota, meta }) => ({ rota, t: tituloFinal(meta.title) })).filter(
      ({ t }) => /CLYON\s*(\|\s*CLYON)$/.test(t) || /(—|-|\|)\s*CLYON\s*\|\s*CLYON$/.test(t),
    );
    expect(dobrados).toEqual([]);
  });
});
