import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import nextConfig from "../../next.config";
import { getAllCidadeSlugs } from "./mudancas-cidades";
import {
  REGIONS,
  SERVICES,
  caminhoDoServicoNaCidade,
  getAllCityServiceSlugs,
  getRegionCities,
} from "./seo-data";

/**
 * SEO TÉCNICO — o que a revisão de 29-09-2026 corrigiu, e aqui fica preso.
 *
 * Cada bloco é um problema que o Google estava a ver: um redirect que
 * acabava em 404, um link interno que passava por um redirect, duas páginas
 * a disputar a mesma pesquisa. Nenhum deles dá erro no build — compilam,
 * respondem, e só se vêem no Search Console semanas depois.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** O código sem comentários: a explicação de porque é que algo saiu contém-no. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Onde o middleware manda um endereço — `null` se o deixa seguir. */
async function destinoNoMiddleware(caminho: string): Promise<{ status: number; para: string } | null> {
  const resposta = await middleware(new NextRequest(`https://clyon.pt${caminho}`));
  const para = resposta.headers.get("location");
  if (!para) return null;
  return { status: resposta.status, para: new URL(para).pathname };
}

/** As páginas que existem de facto (as geradas, as de mudanças e o balcão). */
const PAGINAS_DE_CIDADE = new Set([
  ...getAllCityServiceSlugs().map((e) => `/${e.slug.join("/")}`),
  ...getAllCidadeSlugs().map((c) => `/mudancas/${c}`),
  "/mudancas",
]);

describe("mudanças: nenhum redirect acaba num 404", () => {
  it("o middleware lê as cidades da fonte — não há lista escrita à mão", () => {
    // Eram dezanove cidades escritas no middleware contra treze páginas: seis
    // redirects para 404 (almada, cascais, amadora, seixal, moita, setubal).
    const codigo = semComentarios(ler("src/middleware.ts"));
    expect(codigo).toContain('import { getAllCidadeSlugs } from "@/lib/mudancas-cidades"');
    expect(codigo).toContain("const MUDANCAS_CITIES_WITH_PAGE = getAllCidadeSlugs()");
    expect(codigo).not.toMatch(/"almada",\s*\r?\n/);
  });

  it("uma cidade sem página vai ao balcão geral, e não a /mudancas/<cidade>", async () => {
    for (const cidade of ["almada", "cascais", "amadora", "seixal", "moita", "setubal"]) {
      expect(getAllCidadeSlugs(), cidade).not.toContain(cidade);
      expect(await destinoNoMiddleware(`/mudancas-${cidade}`), cidade).toEqual({
        status: 301,
        para: "/mudancas",
      });
    }
  });

  it("uma cidade com página vai direita a ela", async () => {
    for (const cidade of getAllCidadeSlugs()) {
      expect(await destinoNoMiddleware(`/mudancas-${cidade}`), cidade).toEqual({
        status: 301,
        para: `/mudancas/${cidade}`,
      });
    }
  });

  it("o next.config também só redirecciona as cidades que têm página", async () => {
    const config = ler("next.config.ts");
    expect(config).toContain('...paraAsCidades("/mudancas-")');
    expect(config).not.toContain('source: "/mudancas-lisboa"');
    // A regra que importa: nenhum redirect aponta para uma página de cidade
    // que não existe — seja de que família for.
    const redirects = await nextConfig.redirects!();
    const paraCidades = redirects.filter((r) => r.destination.startsWith("/mudancas/"));
    expect(paraCidades.length).toBeGreaterThan(0);
    for (const r of paraCidades) {
      expect(PAGINAS_DE_CIDADE.has(r.destination), `${r.source} → ${r.destination}`).toBe(true);
    }
  });

  it("os links de serviço por região levam todos a uma página que existe", () => {
    // O cartão «Mudanças» da Margem Sul ligava a /mudancas-almada, e o de
    // Setúbal a /mudancas-setubal — dois 404 atrás de um redirect.
    for (const regiao of REGIONS) {
      const primeira = getRegionCities(regiao.slug)[0]?.slug ?? "lisboa";
      for (const servico of SERVICES) {
        const caminho = caminhoDoServicoNaCidade(servico.slug, primeira);
        expect(PAGINAS_DE_CIDADE.has(caminho), `${regiao.slug} · ${servico.slug} → ${caminho}`).toBe(true);
      }
    }
    expect(caminhoDoServicoNaCidade("mudancas", "almada")).toBe("/mudancas");
    expect(caminhoDoServicoNaCidade("mudancas", "lisboa")).toBe("/mudancas/lisboa");
  });

  it("a página da região não monta o endereço à mão", () => {
    const regiao = semComentarios(ler("src/app/regioes/[region]/page.tsx"));
    expect(regiao).not.toContain("`/${service.slug}-${");
    expect(regiao).toContain("caminhoDoServicoNaCidade(service.slug,");
  });
});

describe("redirects coerentes", () => {
  it("quem escreve «monos» vai à página dos monos, e não à dos móveis", async () => {
    const redirects = await nextConfig.redirects!();
    for (const origem of ["/monos", "/recolha-monos"]) {
      const r = redirects.find((x) => x.source === origem);
      expect(r?.destination, origem).toBe("/recolha-de-monos");
    }
  });

  it("/contacto é só o redirect do next.config — a página morta saiu", async () => {
    // Uma page.tsx com redirect("/contactos") que nunca corria: o redirect do
    // next.config vem primeiro. Era código a manter sem nada a fazer.
    expect(() => ler("src/app/contacto/page.tsx")).toThrow();
    const redirects = await nextConfig.redirects!();
    expect(redirects.find((x) => x.source === "/contacto")?.destination).toBe("/contactos");
  });
});
