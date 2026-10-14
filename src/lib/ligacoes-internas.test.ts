import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * AS LIGAÇÕES INTERNAS QUE FALTAVAM — 14-10-2026 (auditoria de SEO, 30 dias).
 *
 * O hub de monos não ligava às páginas de monos, o de esvaziamento só à da
 * Amadora, as páginas de cidade cortavam as vizinhas, as terras da página
 * inicial eram texto, e o menu «Soluções» só existia depois de aberto.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("os hubs ligam às páginas de cada cidade", () => {
  it("o componente lista todas as terras, com o nome do serviço na âncora", () => {
    const C = ler("src/components/CidadesDoServico.tsx");
    expect(C).toContain("CITIES.filter((c) => c.regionLabel === regiao)");
    expect(C).toContain("href={caminhoDoServicoNaCidade(servico, cidade.slug)}");
    expect(C).toContain("{nome} {emTerra(cidade.name)}");
  });

  it("monos e esvaziamento usam-no", () => {
    expect(ler("src/app/recolha-de-monos/page.tsx")).toContain('servico="recolha-monos"');
    expect(ler("src/app/esvaziamento-de-casas/page.tsx")).toContain('servico="esvaziamento-casas"');
  });

  it("as páginas de monos ligam ao hub delas", () => {
    expect(ler("src/app/[...slug]/page.tsx")).toContain('"recolha-monos": { href: "/recolha-de-monos"');
  });
});

describe("as páginas de cidade ligam às vizinhas", () => {
  it("num bloco seu, e não atrás das ligações de apoio, onde o corte as tirava", () => {
    const P = ler("src/app/[...slug]/page.tsx");
    expect(P).not.toContain("[...supportLinks, ...nearbyLinks].slice(0, 6)");
    expect(P).toContain("{nearbyLinks.map((item) => (");
  });
});

describe("a página inicial liga às terras", () => {
  it("as 26 etiquetas são ligações", () => {
    const I = ler("src/app/page.tsx");
    expect(I).toContain('href={caminhoDoServicoNaCidade("recolha-moveis", city.slug)}');
    expect(I).toContain("{emTerra(c.nome).slice(0, -c.nome.length)}");
  });
});

describe("o menu «Soluções» está no HTML", () => {
  it("escondido até se abrir, e não criado só quando se abre", () => {
    const H = ler("src/components/Header.tsx");
    expect(H).not.toContain("{solucoesOpen && (");
    expect(H).toMatch(/id="menu-solucoes"\s+hidden=\{!solucoesOpen\}/);
  });
});
