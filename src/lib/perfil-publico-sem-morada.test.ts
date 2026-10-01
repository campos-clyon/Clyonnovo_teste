import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cidadePublica, localidadeConhecida, zonasPublicas } from "./localidade-publica";
import { eContaDeTeste } from "./perfil-publico-do-profissional";
import { validarInscricao, temSinaisDeHtml } from "./inscricao-profissional";

/**
 * A PÁGINA PÚBLICA DO PROFISSIONAL PUBLICAVA A MORADA DE CASA DELE.
 *
 * A coluna `city` guarda a morada da base — é o que mede as distâncias — e a
 * página usava-a tal como estava: «R. dos Jasmins 3, Amora» no título, no
 * JSON-LD e no corpo, indexado pelo Google ao lado do nome. E uma conta de
 * teste («Fred Teste») tinha página, sitemap e cartão nas cidades.
 */

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

describe("a cidade pública é uma terra que conhecemos, ou nada", () => {
  it("de uma morada, fica só a terra", () => {
    expect(localidadeConhecida("R. dos Jasmins 3, Amora")).toBe("Amora");
    expect(localidadeConhecida("Rua de Lisboa 5, Almada")).toBe("Almada");
    expect(localidadeConhecida("Fernão Ferro")).toBe("Fernão Ferro");
  });

  it("escrita de qualquer maneira, sai com o nome certo", () => {
    expect(localidadeConhecida("SETUBAL")).toBe("Setúbal");
    expect(localidadeConhecida("costa da caparica")).toBe("Costa da Caparica");
  });

  it("uma morada sem terra conhecida não dá cidade nenhuma", () => {
    expect(localidadeConhecida("Rua da liberdade 61")).toBeNull();
    expect(localidadeConhecida("")).toBeNull();
    expect(localidadeConhecida(null)).toBeNull();
  });

  it("palavras inteiras: as Amoreiras não são a Amora", () => {
    expect(localidadeConhecida("Amoreiras")).toBeNull();
  });

  it("sem terra na base, tenta as zonas; sem nenhuma, fica sem cidade", () => {
    expect(cidadePublica("Rua da liberdade 61", ["Rua da liberdade 61", "Seixal"])).toBe("Seixal");
    expect(cidadePublica("Rua da liberdade 61", ["Rua da liberdade 61"])).toBeNull();
    expect(cidadePublica(null, [])).toBeNull();
  });

  it("as zonas perdem o que parece morada, e não repetem", () => {
    expect(
      zonasPublicas([
        "R. dos Jasmins 3, Amora",
        "Seixal",
        "amora",
        "Quinta do Conde",
        "Rua da liberdade 61",
        "Rua das Flores",
        "2845-513",
      ]),
    ).toEqual(["Amora", "Seixal", "Quinta do Conde"]);
  });

  it("a biblioteca do perfil usa-as nos dois sítios de onde a página bebe", () => {
    const LIB = lerNu("src/lib/perfil-publico-do-profissional.ts");
    const umPerfil = LIB.slice(
      LIB.indexOf("export async function perfilPublicoDoProfissional"),
      LIB.indexOf("export async function perfilPublicoPorSlug"),
    );
    const aLista = LIB.slice(LIB.indexOf("export async function profissionaisComPagina"));
    for (const bloco of [umPerfil, aLista]) {
      expect(bloco.length).toBeGreaterThan(0);
      expect(bloco).toContain("cidadePublica(");
      expect(bloco).toContain("zonasPublicas(");
      expect(bloco).not.toMatch(/cidade:\s*typeof \w+\.city === "string" && \w+\.city \? \w+\.city/);
    }
  });

  it("o título e a descrição dizem a cidade pública, e não a primeira zona à mão", () => {
    const PAGINA = lerNu("src/app/profissionais/[slug]/page.tsx");
    expect(PAGINA).toContain("const onde = p.cidade;");
    expect(PAGINA).not.toContain("p.zonas[0]");
  });
});

describe("as contas de teste não aparecem ao público", () => {
  it("reconhece-as pelo nome, como palavra inteira", () => {
    expect(eContaDeTeste("Fred Teste")).toBe(true);
    expect(eContaDeTeste("teste")).toBe(true);
    expect(eContaDeTeste("Conta Test")).toBe(true);
    expect(eContaDeTeste("Testemunhas Transportes")).toBe(false);
    expect(eContaDeTeste("Mudanças Contest")).toBe(false);
    expect(eContaDeTeste("Transportes Silva")).toBe(false);
    expect(eContaDeTeste(null)).toBe(false);
  });

  it("a página dá 404, e a lista (sitemap e blocos) deixa-as de fora", () => {
    const LIB = lerNu("src/lib/perfil-publico-do-profissional.ts");
    const porSlug = LIB.slice(LIB.indexOf("export async function perfilPublicoPorSlug"));
    expect(porSlug).toMatch(/eContaDeTeste\(linha\.name\)\)\s*return null/);
    const aLista = LIB.slice(LIB.indexOf("export async function profissionaisComPagina"));
    expect(aLista).toContain("!eContaDeTeste(");
    // O sitemap e o bloco das páginas de cidade saem desta lista.
    expect(lerNu("src/app/sitemap.ts")).toContain("slugsDosProfissionais");
    expect(lerNu("src/components/ProfissionaisComPagina.tsx")).toContain("profissionaisComPagina()");
  });
});

describe("o título não repete a marca", () => {
  it("o template do layout já põe « | CLYON»", () => {
    const PAGINA = lerNu("src/app/profissionais/[slug]/page.tsx");
    const principal = PAGINA.match(/^ {4}title: `(.*)`,\r?$/m);
    expect(principal).not.toBeNull();
    expect(principal![1]).not.toContain("CLYON");
    expect(PAGINA).not.toContain('"Profissional não encontrado | CLYON"');
  });
});

describe("o nome e a cidade não aceitam < nem >", () => {
  const base = {
    nome: "Transportes Silva",
    email: "silva@exemplo.pt",
    telefone: "912345678",
    cidade: "Almada",
    categorias: ["recolha_moveis"],
    raioKm: 30,
    tipoVeiculo: "carrinha_media",
  };

  it("reconhece os sinais", () => {
    expect(temSinaisDeHtml("</script><script>")).toBe(true);
    expect(temSinaisDeHtml("Mudanças & Filhos")).toBe(false);
  });

  it("a inscrição recusa-os no nome, na cidade e nas zonas", () => {
    expect(validarInscricao(base).ok).toBe(true);
    for (const [campo, corpo] of [
      ["nome", { ...base, nome: "</script><script>alert(1)" }],
      ["cidade", { ...base, cidade: "Almada<b>" }],
      ["zonas", { ...base, zonas: ["Seixal", "<img>"] }],
    ] as const) {
      const r = validarInscricao(corpo);
      expect(r.ok, campo).toBe(false);
      if (!r.ok) expect(r.erros.map((e) => e.campo)).toContain(campo);
    }
  });

  it("o painel do profissional e a candidatura também", () => {
    const PERFIL = lerNu("src/app/api/profissionais/perfil/route.ts");
    expect(PERFIL).toContain("temSinaisDeHtml(nome)");
    expect(PERFIL).toContain("temSinaisDeHtml(c)");
    expect(PERFIL).toContain("lista(corpo.zonas).some(temSinaisDeHtml)");
    const CANDIDATURA = lerNu("src/app/api/parceiros/candidatura/route.ts");
    expect(CANDIDATURA).toContain("temSinaisDeHtml(nome)");
    expect(CANDIDATURA).toContain("temSinaisDeHtml(cidade)");
  });
});
