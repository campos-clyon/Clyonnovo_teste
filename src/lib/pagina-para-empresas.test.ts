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

  it("diz a factura, o registo na APA e a e-GAR pelas constantes do site", () => {
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

  it("e /sobre-nos diz quem passa a factura", () => {
    expect(ler("src/app/sobre-nos/page.tsx")).toContain("{QUEM_FACTURA_EM_PALAVRAS} Há factura em todas as vendas.");
  });
});
