import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chaveDoEmail,
  emailsDaListaColada,
  estadoDeUso,
  montarQuadro,
  telefoneParaLigar,
  type PessoaDoTeste,
} from "./quem-conta-para-os-12";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-17T12:00:00Z");
const DIAS = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);

function pessoa(p: Partial<PessoaDoTeste> & { id: string }): PessoaDoTeste {
  return {
    nome: p.id,
    emails: [],
    telefone: null,
    abertaEm: null,
    versao: null,
    temAvisosDaApp: false,
    porque: "Aprovado",
    contaDeTeste: false,
    ...p,
  };
}

describe("estadoDeUso", () => {
  it("usa = abriu nos últimos 14 dias; parou = antes; nunca = sem sinal", () => {
    expect(estadoDeUso(DIAS(0), AGORA)).toBe("usa");
    expect(estadoDeUso(DIAS(14), AGORA)).toBe("usa");
    expect(estadoDeUso(DIAS(14.01), AGORA)).toBe("parou");
    expect(estadoDeUso(null, AGORA)).toBe("nunca");
  });
  it("os avisos ligados sem abertura gravada contam como parou, nunca como usa", () => {
    expect(estadoDeUso(null, AGORA, true)).toBe("parou");
    expect(estadoDeUso(DIAS(1), AGORA, true)).toBe("usa");
  });
});

describe("a lista colada da Play", () => {
  it("aceita vírgulas, linhas e pontos e vírgulas, em minúsculas e sem repetidos", () => {
    const t = "Ana.Teste@gmail.com, bruno.exemplo@gmail.com\n\nana.teste@gmail.com; outro@exemplo.pt\nnão é email";
    expect(emailsDaListaColada(t)).toEqual(["ana.teste@gmail.com", "bruno.exemplo@gmail.com", "outro@exemplo.pt"]);
  });
  it("num Gmail os pontos e o +etiqueta não contam (como no Google)", () => {
    expect(chaveDoEmail("Ana.Teste+play@googlemail.com")).toBe("anateste@gmail.com");
    expect(chaveDoEmail("ana.teste@exemplo.pt")).toBe("ana.teste@exemplo.pt");
    expect(emailsDaListaColada("ana.teste@gmail.com anateste@gmail.com")).toHaveLength(1);
  });
  it("lixo não rebenta", () => {
    expect(emailsDaListaColada(undefined)).toEqual([]);
    expect(emailsDaListaColada(42)).toEqual([]);
  });
});

describe("montarQuadro", () => {
  const pessoas = [
    pessoa({ id: "p1", emails: ["um.exemplo@gmail.com"], abertaEm: DIAS(2).toISOString() }),
    pessoa({ id: "p2", emails: ["dois@exemplo.pt", "dois.exemplo@gmail.com"], abertaEm: DIAS(30).toISOString() }),
    pessoa({ id: "p3", emails: ["tres@exemplo.pt"] }),
  ];

  it("sem lista: totais por estado, «Usa» primeiro, e o email que não é Gmail assinalado", () => {
    const q = montarQuadro(pessoas, null, AGORA);
    expect(q.totais).toEqual({ usa: 1, parou: 1, nunca: 1 });
    expect(q.linhas.map((l) => l.id)).toEqual(["p1", "p2", "p3"]);
    expect(q.listaColada).toBe(false);
    expect(q.usaNaPlay).toBeNull();
    expect(q.linhas.find((l) => l.id === "p2")?.naoGmail).toBe(false); // tem um Gmail
    expect(q.linhas.find((l) => l.id === "p3")?.naoGmail).toBe(true);
    expect(q.linhas.every((l) => !l.foraDaPlay)).toBe(true);
  });

  it("com lista: quem está fora, os emails da Play sem conta, e os «Usa» que estão na Play", () => {
    const lista = emailsDaListaColada("UmExemplo@gmail.com, dois.exemplo@gmail.com, perdido.exemplo@gmail.com, alguem@exemplo.pt");
    const q = montarQuadro(pessoas, lista, AGORA);
    const p = (id: string) => q.linhas.find((l) => l.id === id)!;
    expect(p("p1").emailNaPlay).toBe("umexemplo@gmail.com");
    expect(p("p2").emailNaPlay).toBe("dois.exemplo@gmail.com");
    expect(p("p3").foraDaPlay).toBe(true);
    expect(q.usaNaPlay).toBe(1);
    expect(q.semConta).toEqual([
      { email: "perdido.exemplo@gmail.com", gmail: true },
      { email: "alguem@exemplo.pt", gmail: false },
    ]);
  });
});

describe("telefoneParaLigar", () => {
  it("só com nove algarismos ou mais", () => {
    expect(telefoneParaLigar("+351 912 345 678")).toBe("+351912345678");
    expect(telefoneParaLigar("12")).toBeNull();
    expect(telefoneParaLigar(null)).toBeNull();
  });
});

describe("as peças à volta", () => {
  it("a rota é só do administrador", () => {
    const R = ler("src/app/api/admin/quem-conta-para-os-12/route.ts");
    expect(R.match(/requireAdminGeral\(req\)/g)?.length).toBe(2);
    expect(R).not.toMatch(/requireAdmin\(req\)/);
  });

  it("entrar pela app grava a abertura (Pro e cliente), não só renovar a sessão", () => {
    expect(ler("src/app/api/profissionais/entrar/route.ts")).toMatch(/paraApp === true\) \{[\s\S]{0,400}registarAppAberta\(p\.id/);
    expect(ler("src/app/api/profissionais/definir-senha/route.ts")).toMatch(/paraApp === true\) \{[\s\S]{0,300}registarAppAberta\(linha\.id/);
    expect(ler("src/app/api/cliente/entrar/route.ts")).toContain("registarAppDoClienteAberta(email,");
    expect(ler("src/app/api/entrada/palavra-passe/route.ts")).toMatch(/if \(paraApp\) \{[\s\S]{0,400}registarAppDoClienteAberta\(email,/);
    expect(ler("src/app/api/profissionais/sessao/route.ts")).toContain("registarAppAberta(sessao.providerId");
    expect(ler("src/app/api/cliente/sessao/route.ts")).toContain("registarAppDoClienteAberta(sessao.email");
  });

  it("o quadro aparece nas duas secções, e na dos profissionais só para o administrador", () => {
    const S = ler("src/components/admin/AdminProfissionaisSeccao.tsx");
    expect(S).toMatch(/eAdministrador\s*\?\s*\[\{ id: "quem"/);
    expect(S).toContain('<QuemContaParaOs12 app="pro" tema="escuro" />');
    const L = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(L).toMatch(/papel === "admin" && separadorDasContas === "programa"[\s\S]{0,400}<QuemContaParaOs12 app="cliente" tema="claro" \/>/);
  });
});
