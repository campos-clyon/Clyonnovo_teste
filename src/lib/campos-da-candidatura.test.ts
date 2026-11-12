import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «FALTA: …» JUNTO AO BOTÃO, E OS ERROS SEM SÍTIO COMO MENSAGEM GERAL —
 * 12-11-2026 (decisão d9, parte 1).
 *
 * O que estes testes guardam:
 *   1. sem fotografia, o aviso por baixo do botão diz «Falta: fotografia da
 *      carrinha», e o ecrã desce até ao campo e foca-o;
 *   2. a rota manda como mensagem geral (`error`) um erro de um campo que o
 *      ecrã não conhece — com e sem o cabeçalho da app.
 */

vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/candidaturas", () => ({
  guardarCandidatura: vi.fn(async () => ({ id: 1, repetida: false, orfas: [] as string[] })),
}));
vi.mock("@/lib/db", () => ({
  apagarFotosDoBlob: vi.fn(async (urls: string[]) => urls.length),
}));

import { POST } from "@/app/api/parceiros/candidatura/route";
import { MENSAGEM_SEM_FOTOGRAFIA, MENSAGEM_SEM_FOTOGRAFIA_NA_APP } from "./fotografias-da-carrinha";
import {
  CAMPOS_DA_CANDIDATURA,
  camposComErro,
  idDoCampo,
  resumoDoQueFalta,
  separarErrosDaCandidatura,
} from "./campos-da-candidatura";

const LOJA = "loja1abc.public.blob.vercel-storage.com";
const foto = `https://${LOJA}/candidaturas/00000001-aaaa-bbbb-cccc-dddddddddddd.jpg`;

const CORPO = {
  nome: "Transportes e Mudanças, Lda.",
  email: "candidato@exemplo.pt",
  telefone: "912345678",
  cidade: "Seixal",
  tipoVeiculo: "carrinha_media",
  servicos: ["recolhas"],
  mensagem: null,
};

function pedido(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new NextRequest("https://clyon.pt/api/parceiros/candidatura", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLYON_BLOB_HOST", LOJA);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("1. sem fotografia, «Falta: fotografia da carrinha» junto ao botão", () => {
  it("o resumo diz o nome do campo", () => {
    expect(resumoDoQueFalta([{ campo: "fotografias", mensagem: MENSAGEM_SEM_FOTOGRAFIA }])).toBe(
      "Falta: fotografia da carrinha.",
    );
  });

  it("com vários, diz todos pela ordem do formulário, e ignora a mensagem geral", () => {
    const erros = [
      { campo: "servicos", mensagem: "x" },
      { campo: "geral", mensagem: "y" },
      { campo: "nome", mensagem: "z" },
      { campo: "fotografias", mensagem: "w" },
    ];
    expect(resumoDoQueFalta(erros)).toBe("Falta: nome ou empresa, fotografia da carrinha, o que faz.");
    expect(camposComErro(erros)[0]).toBe("nome");
    expect(resumoDoQueFalta([{ campo: "geral", mensagem: "y" }])).toBeNull();
    expect(resumoDoQueFalta([])).toBeNull();
  });

  it("o formulário recusa sem fotografia, pede o foco, e o aviso está por baixo do botão", () => {
    const FORM = semNotas(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));
    // Sem fotografia: recusa sem enviar, e pede o foco.
    expect(FORM).toMatch(
      /if \(fotografias\.length === 0\) \{\s*recusar\(\[\{ campo: "fotografias", mensagem: MENSAGEM_SEM_FOTOGRAFIA \}\]\);\s*return;/,
    );
    expect(FORM).toMatch(/function recusar\([^)]*\) \{\s*setErros\(lista\);\s*setPedidoDeFoco\(/);
    // O resumo vem DEPOIS do botão de enviar, e o texto antigo saiu.
    const botao = FORM.indexOf("Enviar candidatura");
    const resumo = FORM.indexOf("{resumoDoQueFalta(erros)}");
    expect(botao).toBeGreaterThan(-1);
    expect(resumo).toBeGreaterThan(botao);
    expect(FORM).not.toContain("Falta preencher o que está assinalado");
  });

  it("o ecrã desce até ao primeiro campo com erro e foca-o, só depois de um envio recusado", () => {
    const FORM = semNotas(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));
    const efeito = FORM.slice(FORM.indexOf("useEffect(() => {"));
    expect(efeito).toMatch(/if \(pedidoDeFoco === 0\) return;/);
    expect(efeito).toContain("camposComErro(erros)[0]");
    expect(efeito).toContain("scrollIntoView(");
    expect(efeito).toMatch(/\.focus\(/);
    expect(efeito).toMatch(/\}, \[pedidoDeFoco\]\);/);
  });

  it("cada campo da lista tem o seu id no formulário", () => {
    const FORM = semNotas(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));
    for (const c of CAMPOS_DA_CANDIDATURA) {
      expect(FORM, c.campo).toContain(`id={idDoCampo("${c.campo}")}`);
    }
    expect(idDoCampo("fotografias")).toBe("candidatura-fotografias");
  });

  it("os campos da lista são os que a rota valida", () => {
    const ROTA = semNotas(ler("src/app/api/parceiros/candidatura/route.ts"));
    const daRota = new Set([...ROTA.matchAll(/campo: "(\w+)"/g)].map((m) => m[1]));
    expect(daRota.size).toBeGreaterThan(0);
    for (const c of daRota) {
      expect(CAMPOS_DA_CANDIDATURA.map((x) => x.campo as string), c).toContain(c);
    }
  });
});

describe("2. a rota: um erro de um campo que o ecrã não conhece vai como mensagem geral", () => {
  it("separar: os conhecidos ficam, os outros juntam-se numa só mensagem", () => {
    expect(
      separarErrosDaCandidatura([
        { campo: "nome", mensagem: "a" },
        { campo: "matricula", mensagem: "b" },
        { campo: "seguro", mensagem: "c" },
      ]),
    ).toEqual({ porCampo: [{ campo: "nome", mensagem: "a" }], geral: "b c" });
    expect(separarErrosDaCandidatura([{ campo: "nome", mensagem: "a" }]).geral).toBeNull();
  });

  /*
   * Para pôr a rota a devolver um campo que ninguém conhece sem mexer nela,
   * a cidade passa a chegar como «base» à separação, só nestes testes: o erro
   * dela tem de sair em `error`.
   */
  for (const cabecalhos of [{}, { "x-app-versao": "0.1.0 (abc)" }] as Array<Record<string, string>>) {
    const com = "x-app-versao" in cabecalhos ? "com o cabeçalho da app" : "sem o cabeçalho";
    it(`${com}: um campo desconhecido sozinho → só \`error\``, async () => {
      vi.resetModules();
      vi.doMock("@/lib/campos-da-candidatura", async (original) => {
        const real = await original<typeof import("./campos-da-candidatura")>();
        return {
          ...real,
          separarErrosDaCandidatura: (erros: Array<{ campo: string; mensagem: string }>) =>
            real.separarErrosDaCandidatura(erros.map((e) => (e.campo === "cidade" ? { ...e, campo: "base" } : e))),
        };
      });
      const { POST: POST2 } = await import("@/app/api/parceiros/candidatura/route");
      const r = await POST2(pedido({ ...CORPO, cidade: "", fotografiasDoVeiculo: [foto] }, cabecalhos));
      expect(r.status).toBe(400);
      const d = await r.json();
      expect(typeof d.error).toBe("string");
      expect(d.error).toContain("de onde trabalha");
      expect(d.erros).toBeUndefined();
      vi.doUnmock("@/lib/campos-da-candidatura");
    });

    it(`${com}: um desconhecido ao lado de um conhecido → \`erros\` com o conhecido e \`error\` com o outro`, async () => {
      vi.resetModules();
      vi.doMock("@/lib/campos-da-candidatura", async (original) => {
        const real = await original<typeof import("./campos-da-candidatura")>();
        return {
          ...real,
          separarErrosDaCandidatura: (erros: Array<{ campo: string; mensagem: string }>) =>
            real.separarErrosDaCandidatura(erros.map((e) => (e.campo === "cidade" ? { ...e, campo: "base" } : e))),
        };
      });
      const { POST: POST2 } = await import("@/app/api/parceiros/candidatura/route");
      const r = await POST2(pedido({ ...CORPO, nome: "", cidade: "", fotografiasDoVeiculo: [foto] }, cabecalhos));
      expect(r.status).toBe(400);
      const d = await r.json();
      expect(d.erros.map((e: { campo: string }) => e.campo)).toEqual(["nome"]);
      expect(d.error).toContain("de onde trabalha");
      vi.doUnmock("@/lib/campos-da-candidatura");
    });
  }

  it("só com campos conhecidos, não há `error` a mais", async () => {
    const r = await POST(pedido({ ...CORPO, nome: "", fotografiasDoVeiculo: [foto] }));
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(d.erros).toEqual([{ campo: "nome", mensagem: "Indique o seu nome ou o da empresa." }]);
    expect(d.error).toBeUndefined();
  });

  it("a app sem fotografia continua a receber a mensagem geral de sempre", async () => {
    const r = await POST(pedido(CORPO, { "x-app-versao": "0.1.0 (abc)" }));
    const d = await r.json();
    expect(d.error).toBe(MENSAGEM_SEM_FOTOGRAFIA_NA_APP);
    expect(d.erros).toBeUndefined();
  });

  it("o formulário do site mostra a mensagem geral mesmo quando também há erros por campo", () => {
    const FORM = semNotas(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));
    const bloco = FORM.slice(FORM.indexOf("if (!res.ok) {"));
    expect(bloco).toContain("separarErrosDaCandidatura(");
    expect(bloco).toMatch(/typeof dados\.error === "string" \? dados\.error : null/);
    expect(bloco).toMatch(/campo: "geral"/);
  });
});
