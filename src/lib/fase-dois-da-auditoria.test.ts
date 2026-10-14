import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { DATAS_DAS_PAGINAS, dataDaPagina } from "./conteudo-datas.generated";

/*
 * AUDITORIA DE SEO, 30 DIAS — 14-10-2026: formulários com menos obrigações,
 * sitemap com a data de cada página, e o negócio ligado aos seus perfis.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("menos campos obrigatórios", () => {
  it("o apelido da página inicial é opcional, no formulário e na rota", () => {
    expect(ler("src/components/HeroQuoteForm.tsx")).toContain("Apelido (opcional)");
    expect(ler("src/components/HeroQuoteForm.tsx")).not.toContain('e.ultimoNome   = "Mínimo 2 caracteres"');
    expect(ler("src/app/api/hero-quote/route.ts")).toMatch(/ultimoNome:\s+z\.string\(\)\.max\(60[^)]*\)\.optional\(\)\.default\(""\)/);
  });

  it("o email dos contactos é opcional", () => {
    const C = ler("src/app/contactos/ContactosClient.tsx");
    expect(C).toContain('field("email", "Email (opcional)", "email", "ana@exemplo.com", "", false)');
    expect(C).toContain("required={obrigatorio}");
  });

  it("o NIF na factura vem marcado «não»", () => {
    const S = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(S).toContain("useState<FormState>({ precisaFatura: false })");
    expect(S).toContain("setFormData({ precisaFatura: false });");
  });
});

describe("o sitemap diz quando cada página mudou", () => {
  it("as páginas estáticas têm datas suas, e não uma só para todas", async () => {
    const entradas = await sitemap();
    const estaticas = entradas.filter((e) => !/\/(blog|profissionais|mudancas|regioes)\//.test(e.url));
    const datas = new Set(estaticas.map((e) => new Date(e.lastModified as Date).toISOString().slice(0, 10)));
    // Hoje (14-10-2026) há páginas mudadas a 30-09, 01-10, 09-10 e 14-10: mais
    // de uma data, que era o que faltava — antes eram todas a do grupo.
    expect(datas.size).toBeGreaterThan(2);
    expect(Object.keys(DATAS_DAS_PAGINAS).length).toBeGreaterThan(25);
    expect(dataDaPagina("/")).toBeInstanceOf(Date);
    expect(dataDaPagina("/nao-existe")).toBeNull();
  }, 30_000);

  it("os perfis levam a última mudança na base, e não a hora do pedido", () => {
    const S = ler("src/app/sitemap.ts");
    expect(S).toContain("lastModified: ultimaMudanca ?? now,");
    expect(ler("src/lib/perfil-publico-do-profissional.ts")).toContain(
      "GREATEST(p.updatedAt, COALESCE(MAX(n.confirmadoEm), p.updatedAt)) AS ultimaMudanca",
    );
  });
});

describe("o negócio nos dados estruturados", () => {
  it("tem logótipo com pelo menos 112 px, coordenadas e os dois perfis", () => {
    const L = ler("src/app/layout.tsx");
    expect(L).toContain("const LOGO_DO_NEGOCIO = `${SITE_URL}/logo-clyon-icon.png`;");
    expect(L).toContain('"https://www.google.com/maps?cid=6227316191619861484"');
    expect(L).toContain("AVALIACOES.fixandoUrl");
    expect(L).toContain("sameAs: PERFIS_DO_NEGOCIO,");
    expect(L).toContain('geo: { "@type": "GeoCoordinates"');
    // O PNG tem 896×251: os dois lados acima dos 112 px que o Google pede.
    const png = readFileSync(join(process.cwd(), "public/logo-clyon-icon.png"));
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(112);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(112);
  });
});
