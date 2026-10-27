import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pedirNoSimulador } from "./servico-na-ligacao";
import { O_QUE_PODE_FAZER } from "./voz-da-vitoria";

/*
 * UMA SÓ PROMESSA — 27-10-2026.
 *
 * O «mesmo dia» responde-se sempre com NO_MESMO_DIA (promessas-publicas.ts) e
 * «próprio dia» não aparece em texto público. Os botões de orçamento levam ao
 * simulador. As páginas dos serviços fora do plano dizem que a CLYON não os
 * faz, sem preço e sem botão.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const semComentarios = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** As páginas públicas e o que elas lêem: fora o backoffice, a API, o painel do pro e os testes. */
function ficheirosPublicos(): string[] {
  const FORA = /[\\/](api|admin)[\\/]|[\\/]profissionais[\\/]painel[\\/]|[\\/]components[\\/]admin[\\/]/;
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n) && !FORA.test(p)) saida.push(p);
    }
  };
  andar(join(RAIZ, "src", "app"));
  andar(join(RAIZ, "src", "components"));
  return [
    ...saida,
    ...[
      "src/lib/city-content.ts",
      "src/lib/cidades-local.ts",
      "src/lib/blog-data.ts",
      "src/lib/seo-data.ts",
      "src/lib/promessas-publicas.ts",
      "src/lib/mudancas-cidades.ts",
      "src/lib/quanto-custa.ts",
      "src/lib/tipos-de-mudanca.ts",
    ].map((f) => join(RAIZ, f)),
  ];
}

describe("o mesmo dia diz-se de uma só maneira", () => {
  it("«próprio dia» não aparece em texto público (fora dos comentários)", () => {
    const achados = ficheirosPublicos().filter((f) =>
      /pr[óo]prio dia/i.test(semComentarios(readFileSync(f, "utf8"))),
    );
    expect(achados.map((f) => f.replace(RAIZ, ""))).toEqual([]);
  });

  it("nenhuma lista de keywords promete o mesmo dia", () => {
    const achados: string[] = [];
    for (const f of ficheirosPublicos()) {
      const s = semComentarios(readFileSync(f, "utf8"));
      for (const m of s.matchAll(/keywords:\s*\[([\s\S]*?)\]/g)) {
        if (/mesmo dia|pr[óo]prio dia/i.test(m[1])) achados.push(f.replace(RAIZ, ""));
      }
    }
    expect(achados).toEqual([]);
  });

  it("a FAQ responde ao «mesmo dia» com NO_MESMO_DIA", () => {
    const faq = semComentarios(ler("src/app/faq/page.tsx"));
    expect(faq).toContain('from "@/lib/promessas-publicas"');
    const i = faq.indexOf("no mesmo dia?");
    expect(i).toBeGreaterThan(-1);
    expect(faq.slice(i, i + 200)).toMatch(/a:\s*NO_MESMO_DIA/);
  });
});

describe("os botões de orçamento levam ao simulador", () => {
  it("o atalho escolhe o serviço quando o sabe, e só os do plano", () => {
    expect(pedirNoSimulador("recolha-moveis")).toBe("/simulador?servico=recolha_moveis");
    expect(pedirNoSimulador("recolha-monos")).toBe("/simulador?servico=recolha_monos");
    expect(pedirNoSimulador("recolha-entulho")).toBe("/simulador?servico=recolha_entulho");
    expect(pedirNoSimulador("esvaziamento-casas")).toBe("/simulador?servico=esvaziamento_casa");
    expect(pedirNoSimulador("mudancas")).toBe("/simulador?servico=mudanca");
    expect(pedirNoSimulador("montagem-moveis")).toBe("/simulador");
    expect(pedirNoSimulador(null)).toBe("/simulador");
  });

  it("o CTABlock, por omissão, vai ao /simulador", () => {
    expect(ler("src/components/CTABlock.tsx")).toMatch(/primaryHref\s*=\s*"\/simulador"/);
  });

  it("o botão «Pedir Orçamento Grátis» das páginas de cidade vai ao simulador", () => {
    const s = semComentarios(ler("src/app/[...slug]/page.tsx"));
    const i = s.indexOf("Pedir Orçamento Grátis");
    expect(i).toBeGreaterThan(-1);
    const link = s.slice(s.lastIndexOf("<Link", i), i);
    expect(link).toContain("href={pedirNoSimulador(service.slug)}");
  });

  it("nenhum botão de orçamento público vai para /contactos", () => {
    const achados: string[] = [];
    for (const f of ficheirosPublicos()) {
      const s = semComentarios(readFileSync(f, "utf8"));
      if (/primaryHref=["{]\s*"?\/contactos/.test(s)) achados.push(f.replace(RAIZ, ""));
      for (const m of s.matchAll(/<Link\s+href="\/contactos"[^>]*>[\s\S]{0,200}?<\/Link>/g)) {
        if (/or[çc]amento/i.test(m[0])) achados.push(f.replace(RAIZ, ""));
      }
    }
    expect(achados).toEqual([]);
  });
});

describe("as páginas dos serviços fora do plano", () => {
  const COMPONENTE = semComentarios(ler("src/components/ServicoForaDoPlano.tsx"));
  const QUINTAIS = semComentarios(ler("src/app/limpeza-de-quintais/page.tsx"));
  const SERVICO = semComentarios(ler("src/app/servicos/[slug]/page.tsx"));

  it("dizem no topo que a CLYON não faz o serviço, e o que se pode pedir", () => {
    expect(COMPONENTE).toContain('"De momento a CLYON não faz este serviço."');
    expect(COMPONENTE).toContain("O_QUE_PODE_FAZER");
    expect(O_QUE_PODE_FAZER).not.toMatch(/montagem|jardin|quinta/);
    expect(QUINTAIS).toContain("<ServicoForaDoPlano");
    expect(SERVICO).toMatch(/if \(FORA_DO_PLANO\.has\(cat\.id\)\) return <ServicoForaDoPlano/);
  });

  it("sem preço e sem botão para o simulador", () => {
    for (const [nome, s] of [["componente", COMPONENTE], ["quintais", QUINTAIS]] as const) {
      expect(s, nome).not.toContain("/simulador");
      expect(s, nome).not.toMatch(/PRECOS|precos-publicos|€/);
      expect(s, nome).not.toContain("CTABlock");
    }
  });

  it("e continuam fora do Google", () => {
    expect(QUINTAIS).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(SERVICO).toMatch(/foraDoPlano \? \{ robots: \{ index: false/);
  });
});
