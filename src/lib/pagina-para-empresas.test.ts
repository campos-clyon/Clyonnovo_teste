import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * /EMPRESAS — 14-10-2026 (auditoria de SEO). Só diz o que o resto do site já
 * confirma, e pelas mesmas constantes: a factura, o registo na APA, os preços
 * com o IVA ao lado.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("a página para empresas", () => {
  const P = ler("src/app/empresas/page.tsx");

  it("diz a fatura, o registo na APA e a e-GAR pelas constantes do site", () => {
    expect(P).toContain("{FACTURA_EM_PALAVRAS}");
    expect(P).toContain("{IDENTIFICACAO.codigoAPA}");
    expect(P).toContain("e-GAR");
    expect(P).not.toMatch(/APA\d{6,}/);
  });

  it("os preços vão com o IVA ao lado", () => {
    expect(P).toContain("maisIva(PRECOS.recolha_entulho.etiqueta)");
    expect(P).toContain("Valores de referência, sem IVA. Na proposta, o preço já vem com IVA incluído.");
  });

  it("está no sitemap, no rodapé e em /sobre-nos", () => {
    expect(ler("src/app/sitemap.ts")).toContain("url: `${SITE_URL}/empresas`");
    expect(ler("src/components/Footer.tsx")).toContain('{ href: "/empresas", texto: "Para empresas" }');
    expect(ler("src/app/sobre-nos/page.tsx")).toContain('href="/empresas"');
  });

  it("e /sobre-nos diz quem passa a fatura", () => {
    expect(ler("src/app/sobre-nos/page.tsx")).toContain("{QUEM_FACTURA_EM_PALAVRAS} Há fatura em todas as vendas.");
  });

  /*
   * A MANUTENÇÃO DA CASA TAMBÉM — 28-10-2026 (d1). Voltou a 25/10, com
   * reparações e remodelações, e /empresas só falava de recolhas,
   * esvaziamentos e mudanças.
   */
  it("fala da manutenção da casa, com o nome de NOMES_DOS_SERVICOS, a página dela e o preço da fonte", async () => {
    expect(P).toContain("const MANUTENCAO = NOMES_DOS_SERVICOS.manutencao_casa;");
    expect(P).toContain('href: "/servicos/manutencao-casa"');
    expect(P).toContain("maisIva(PRECOS.manutencao_casa.etiqueta)");
    const React = await import("react");
    (globalThis as { React?: unknown }).React = React;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { NOMES_DOS_SERVICOS } = await import("./service-categories");
    const { PRECOS, maisIva } = await import("./precos-publicos");
    const mod = await import("@/app/empresas/page");
    const html = renderToStaticMarkup(React.createElement(mod.default)).replace(/<!-- -->/g, "");
    expect(html).toContain(`${NOMES_DOS_SERVICOS.manutencao_casa} (reparações e remodelações)`);
    expect(html).toContain(`a ${NOMES_DOS_SERVICOS.manutencao_casa.toLowerCase()}, com`);
    expect(html).toContain('href="/servicos/manutencao-casa"');
    expect(html).toContain(maisIva(PRECOS.manutencao_casa.etiqueta));
  }, 120_000);
});

describe("a morada da CLYON é uma só (d1, 28-10-2026)", () => {
  it("a etiqueta das páginas diz a mesma morada dos Termos", async () => {
    const { BUSINESS_ADDRESS } = await import("./seo-data");
    const { IDENTIFICACAO, MORADA_DA_CLYON } = await import("./identificacao-legal");
    expect(BUSINESS_ADDRESS).toBe(IDENTIFICACAO.morada);
    expect(IDENTIFICACAO.morada).toBe("Belverde, Amora, 2845-513 Seixal, Portugal");
    expect(MORADA_DA_CLYON.codigoPostal).toBe("2845-513");
  });

  it("o schema.org e a página de contactos lêem as partes, e não as escrevem à mão", () => {
    const layout = ler("src/app/layout.tsx");
    expect(layout).toContain("streetAddress: MORADA_DA_CLYON.rua,");
    expect(layout).toContain("addressLocality: MORADA_DA_CLYON.localidade,");
    expect(layout).toContain("postalCode: MORADA_DA_CLYON.codigoPostal,");
    expect(layout).toContain('<meta name="address" content={BUSINESS_ADDRESS} />');
    expect(layout).not.toContain('"2845-513"');
    const contactos = ler("src/app/contactos/ContactosClient.tsx");
    expect(contactos).toContain("{MORADA_DA_CLYON.codigoPostal}");
    expect(contactos).not.toContain("2845-513");
  });
});
