import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import sitemap from "@/app/sitemap";
import { FORA_DO_PLANO, PAGINAS_FORA_DO_PLANO, SERVICE_CATEGORIES, SERVICOS_PUBLICOS } from "./service-categories";
import { servicoDaLigacao } from "./servico-na-ligacao";
import { servicosDoPerfil } from "./servicos-do-perfil";

/**
 * OS SERVIÇOS FORA DO PLANO SAEM DO GOOGLE E DO SIMULADOR — 25-10-2026.
 *
 * Por agora a CLYON fica com recolhas, esvaziamentos e mudanças. A montagem
 * de móveis e a jardinagem e limpeza de quintais saem dos menus, da página
 * inicial, do simulador, das inscrições e do sitemap, e as páginas deles
 * ficam com noindex — mas continuam a abrir.
 *
 * A MANUTENÇÃO DA CASA VOLTOU no mesmo dia («a manutenção da casa volta»,
 * com reparações e remodelações — o dono): está na lista pública, no
 * sitemap, no Google, no simulador e nos perfis.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const indexavel = (m: Metadata) => {
  const r = m.robots;
  if (!r) return true;
  if (typeof r === "string") return !r.includes("noindex");
  return r.index !== false;
};

describe("a lista pública e a lista inteira", () => {
  it("os dois ficam fora da pública, e continuam na inteira (os pedidos antigos têm nome)", () => {
    expect([...FORA_DO_PLANO].sort()).toEqual(["jardinagem", "montagem_moveis"]);
    for (const id of FORA_DO_PLANO) {
      expect(SERVICOS_PUBLICOS.some((c) => c.id === id), id).toBe(false);
      expect(SERVICE_CATEGORIES.some((c) => c.id === id), id).toBe(true);
    }
    expect(SERVICOS_PUBLICOS.map((c) => c.id)).toEqual([
      "recolha_moveis",
      "recolha_monos",
      "recolha_entulho",
      "esvaziamento_casa",
      "esvaziamento_apartamento",
      // A garagem, o sótão e a cave (29-10-2026).
      "esvaziamento_garagem",
      "esvaziamento_sotao",
      "esvaziamento_cave",
      "mudanca",
      "manutencao_casa",
      "outro",
    ]);
  });

  it("as páginas deles são estas duas", () => {
    expect([...PAGINAS_FORA_DO_PLANO].sort()).toEqual(["/limpeza-de-quintais", "/servicos/montagem-moveis"]);
  });
});

/*
 * Importar uma página custa: sozinho são 2 a 4 s, mas no meio da suite inteira
 * passou dos 5 s do prazo de omissão. O prazo é largo de propósito, como no
 * teste dos metadados — chumbar por lentidão da máquina não diz nada.
 */
const PRAZO_DE_IMPORTAR = 120_000;

describe("fora do Google", () => {
  it("nenhuma está no sitemap", async () => {
    const caminhos = (await sitemap()).map((e) => new URL(e.url).pathname);
    for (const p of PAGINAS_FORA_DO_PLANO) expect(caminhos, p).not.toContain(p);
  }, PRAZO_DE_IMPORTAR);

  it("a da montagem tem noindex, e a do esvaziamento e a da manutenção não", async () => {
    const mod = await import("@/app/servicos/[slug]/page");
    const meta = (slug: string) => mod.generateMetadata({ params: Promise.resolve({ slug }) });
    expect(indexavel(await meta("montagem-moveis"))).toBe(false);
    expect(indexavel(await meta("manutencao-casa"))).toBe(true);
    expect(indexavel(await meta("esvaziamento-apartamento"))).toBe(true);
    // E continuam a abrir: a rota gera-as na mesma.
    expect(mod.generateStaticParams().map((p: { slug: string }) => p.slug)).toEqual(
      expect.arrayContaining(["montagem-moveis", "manutencao-casa"]),
    );
  }, PRAZO_DE_IMPORTAR);

  it("a dos quintais tem noindex", async () => {
    const mod = await import("@/app/limpeza-de-quintais/page");
    expect(indexavel(mod.metadata)).toBe(false);
  }, PRAZO_DE_IMPORTAR);
});

describe("fora do que o site oferece", () => {
  it("o menu, a página inicial, o simulador, o formulário e as inscrições usam a lista pública", () => {
    for (const f of [
      "src/components/Header.tsx",
      "src/app/page.tsx",
      "src/app/simulador/SimulatorThreePhaseForm.tsx",
      "src/app/plataforma/pedir/FormularioDePedido.tsx",
      "src/app/profissionais/InscricaoForm.tsx",
      "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx",
    ]) {
      const s = ler(f);
      // As inscrições lêem a lista única (`CATEGORIAS_DOS_PROFISSIONAIS`, 29-10-2026), que deriva dela.
      expect(s, f).toMatch(/SERVICOS_PUBLICOS|CATEGORIAS_DOS_PROFISSIONAIS/);
      expect(s, f).not.toContain("SERVICE_CATEGORIES");
    }
  });

  it("o simulador por ?servico= não os escolhe", () => {
    for (const v of ["montagem-moveis", "montagem_moveis", "jardinagem"]) {
      expect(servicoDaLigacao(`?servico=${v}`), v).toBeNull();
    }
    expect(servicoDaLigacao("?servico=mudanca")).toBe("mudanca");
  });

  it("o perfil público de um profissional não os anuncia", () => {
    expect(servicosDoPerfil(["montagem_moveis", "jardinagem"], null)).toEqual([]);
  });

  it("nenhuma página pública liga a elas", () => {
    // Fora: o backoffice, a API, o painel do profissional e as próprias páginas.
    const FORA = /[\\/](api|admin)[\\/]|[\\/]profissionais[\\/]painel[\\/]|limpeza-de-quintais|servicos[\\/]\[slug\]/;
    const ficheiros: string[] = [];
    const andar = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) andar(p);
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n) && !FORA.test(p)) ficheiros.push(p);
      }
    };
    andar(join(process.cwd(), "src", "app"));
    andar(join(process.cwd(), "src", "components"));
    const ligacoes = ficheiros.flatMap((f) =>
      PAGINAS_FORA_DO_PLANO.filter((p) => readFileSync(f, "utf8").includes(`"${p}"`) || readFileSync(f, "utf8").includes(`\`${p}`)).map(
        (p) => `${f.replace(process.cwd(), "")} → ${p}`,
      ),
    );
    expect(ligacoes).toEqual([]);
  });
});

describe("a manutenção da casa voltou ao plano (25-10-2026, à noite)", () => {
  it("está na lista pública e não na de fora", () => {
    expect(FORA_DO_PLANO.has("manutencao_casa")).toBe(false);
    expect(SERVICOS_PUBLICOS.some((c) => c.id === "manutencao_casa")).toBe(true);
    expect(PAGINAS_FORA_DO_PLANO).not.toContain("/servicos/manutencao-casa");
  });

  it("está no sitemap", async () => {
    const caminhos = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(caminhos).toContain("/servicos/manutencao-casa");
  }, PRAZO_DE_IMPORTAR);

  it("o simulador abre nela por ?servico=, pelo slug e pelo id", () => {
    expect(servicoDaLigacao("?servico=manutencao-casa")).toBe("manutencao_casa");
    expect(servicoDaLigacao("?servico=manutencao_casa")).toBe("manutencao_casa");
  });

  it("o perfil público de quem a faz anuncia-a, com a página dela", () => {
    const lista = servicosDoPerfil(["manutencao_casa"], null);
    expect(lista.map((s) => [s.categoria, s.href])).toEqual([["manutencao_casa", "/servicos/manutencao-casa"]]);
  });
});
