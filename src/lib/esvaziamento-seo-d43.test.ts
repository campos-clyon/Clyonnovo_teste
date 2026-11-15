import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../../next.config";
import { GERADAS_COM_PAGINA_ESTATICA } from "./paginas-consolidadas";
import { SERVICE_CATEGORIES } from "./service-categories";
import { ACTUALIZADO_EM } from "./datas-das-paginas";
import { artigosPublicados } from "./artigos-do-blog";
import { DEPOIS_DO_MODELO, comORelogioEm } from "./relogio-dos-testes";

/*
 * d43 — 15-11-2026, a parte do SEO: os redirects, «recheio» na principal, as
 * ligações das cidades e do blog, e a página dos armazéns, escritórios e lojas.
 */
const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

describe("d43 — os redireccionamentos", () => {
  it("/esvaziamento-casas → /esvaziamento-de-casas em 301, no next.config (a página que redireccionava saiu)", async () => {
    const r = await nextConfig.redirects!();
    expect(r).toContainEqual({ source: "/esvaziamento-casas", destination: "/esvaziamento-de-casas", statusCode: 301 });
    expect(existsSync(join(RAIZ, "src/app/esvaziamento-casas/page.tsx"))).toBe(false);
  });

  it("a Amadora fica como estava: a gerada vai para a escrita à mão (consolidação de 29-09-2026)", () => {
    // O Marketing pediu o contrário; a escrita à mão é a que está no sitemap e a que o Google escolheu.
    expect(GERADAS_COM_PAGINA_ESTATICA["esvaziamento-casas-amadora"]).toBe("/esvaziamento-de-casas-amadora");
  });
});

describe("d43 — a principal e as ligações para ela", () => {
  it("«recheio» no título (≤ 60 com a marca) e no H1", async () => {
    const { metadata } = await import("@/app/esvaziamento-de-casas/page");
    expect(metadata.title).toBe("Esvaziamento de Casas e Recheios — Heranças");
    expect(`${metadata.title} | CLYON`.length).toBeLessThanOrEqual(60);
    expect(ler("src/app/esvaziamento-de-casas/page.tsx")).toContain("Esvaziamento de Casas e Recheios — Heranças e Mudanças em Lisboa, Margem Sul e Setúbal");
  }, 120_000);

  it("as páginas /esvaziamento-casas-<cidade> ligam à principal com as palavras dela", () => {
    expect(ler("src/app/[...slug]/page.tsx")).toContain(
      '"esvaziamento-casas": { href: "/esvaziamento-de-casas", label: "Esvaziamento de casas e recheios: heranças e mudanças" }',
    );
  });

  it("os dois artigos do recheio e do familiar ligam à principal", () => {
    const corpo = (slug: string) => JSON.stringify(artigosPublicados().find((a) => a.slug === slug));
    expect(corpo("esvaziamento-de-casas-com-recheio")).toContain("](/esvaziamento-de-casas)");
    expect(corpo("esvaziar-a-casa-de-um-familiar")).toContain("](/esvaziamento-de-casas)");
  });
});

describe("d43 — a página dos armazéns, escritórios e lojas", () => {
  // A frase da fatura segue a data do modelo (pagamentoDasEmpresas): o relógio no modelo de 15-11.
  comORelogioEm(DEPOIS_DO_MODELO);
  const P = ler("src/app/esvaziamento-de-armazens-e-escritorios/page.tsx");

  it("título ≤ 60, descrição ≤ 155, canónico próprio", async () => {
    const { metadata } = await import("@/app/esvaziamento-de-armazens-e-escritorios/page");
    expect(`${metadata.title} | CLYON`.length).toBeLessThanOrEqual(60);
    expect([...String(metadata.description)].length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toBe("https://clyon.pt/esvaziamento-de-armazens-e-escritorios");
  }, 120_000);

  it("voz de plataforma: «parceiro», fatura com NIF, guia a pedido, fora de horas, 3 passos e o simulador no tipo empresa", () => {
    expect(P).toMatch(/parceiros? da zona/);
    expect(P).not.toMatch(/verificad/);
    expect(P).not.toMatch(/profissiona|próprio dia|contentor|big ?bag/i);
    expect(P).toContain("pagamentoDasEmpresas(agoraDoModelo())");
    expect(P).toContain("Guia de transporte (e-GAR), a pedido");
    expect(P).toContain("Fora de horas, a pedido");
    expect(P).toContain("Como funciona, em 3 passos");
    expect(P).toContain("href={pedirNoSimulador(ESVAZIAMENTO_DE_EMPRESA)}");
  });

  it("ligada a partir de /empresas e da principal; o tipo aponta para ela; no sitemap e com data", () => {
    expect(ler("src/app/empresas/page.tsx")).toContain('href: "/esvaziamento-de-armazens-e-escritorios"');
    expect(ler("src/app/esvaziamento-de-casas/page.tsx")).toContain('href="/esvaziamento-de-armazens-e-escritorios"');
    expect(SERVICE_CATEGORIES.find((c) => c.id === "esvaziamento_empresa")!.href).toBe("/esvaziamento-de-armazens-e-escritorios");
    expect(ler("src/app/sitemap.ts")).toContain("/esvaziamento-de-armazens-e-escritorios`");
    expect(ACTUALIZADO_EM["/esvaziamento-de-armazens-e-escritorios"]).toBe("2026-11-15");
  });
});
