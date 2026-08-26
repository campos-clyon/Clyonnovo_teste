import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O Feed, e o «novo» que se apaga sozinho.
 *
 * "Vamos mudar o nome da primeira opção de Novos para Feed. Os pedidos novos
 * ainda não abertos devem ter uma cor e efeito especial, só muda quando for
 * aberto. Outra coisa: os pedidos estão todos a mostrar novo, mas novo deve ser
 * apenas os 5 recentes ainda não abertos."
 *
 * O distintivo estava em todos os cartões, para sempre. Não era um erro de
 * cálculo: «novo» queria dizer «está no separador dos novos», e um trabalho
 * fica lá até ele responder. Um aviso que nunca se apaga passa a fazer parte
 * do fundo — e a coisa que ele devia destacar, o que chegou desde a última
 * vez, deixa de se ver.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const LIMPO = semComentarios(TRABALHOS);
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/profissionais/abrir/route.ts");
const API = ler("src/app/api/profissionais/meus-pedidos/route.ts");

describe("o separador", () => {
  it("chama-se Feed", () => {
    expect(LIMPO).toContain('{ id: "novos", rotulo: "Feed" }');
    expect(LIMPO).not.toContain('rotulo: "Novos"');
  });
});

describe("saber que ele abriu", () => {
  it("a coluna existe, por profissional", () => {
    // Vive na negociação porque é isso que ela é: o par (pedido, profissional).
    // O mesmo pedido pode estar por abrir para um e lido há dias para outro.
    expect(DB).toContain("ADD COLUMN abertoProfissionalEm DATETIME NULL DEFAULT NULL");
    expect(DB).toContain("n.abertoProfissionalEm,");
  });

  it("grava só a PRIMEIRA abertura", () => {
    const i = DB.indexOf("export async function marcarTrabalhoComoAberto(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    // Reescrever a data a cada abertura faria um trabalho lido há uma semana
    // parecer acabado de ler.
    expect(corpo).toContain("abertoProfissionalEm IS NULL");
    // E o providerId no WHERE: sem ele, um id adivinhado marcava como visto o
    // trabalho de outra pessoa.
    expect(corpo).toContain("providerId = ?");
  });

  it("a rota exige sessão e falha em silêncio", () => {
    expect(ROTA).toContain("verificarSessaoDoProfissional");
    expect(ROTA).toContain("sessao.providerId");
    // Abrir o trabalho nunca pode ficar à espera de um registo de leitura.
    expect(ROTA).toMatch(/catch[\s\S]*?ok: true, marcou: false/);
  });

  it("o painel recebe a data", () => {
    expect(API).toContain("abertoEm: l.abertoProfissionalEm ?? null");
  });
});

describe("o distintivo «novo»", () => {
  it("são os cinco mais recentes por abrir, e não o separador inteiro", () => {
    expect(LIMPO).toContain("const novo = porAbrir.has(p.negociacaoId);");
    expect(LIMPO).not.toContain('const novo = separadorDe(p) === "novos";');
    expect(LIMPO).toContain(".slice(0, 5)");
    expect(LIMPO).toContain("!p.abertoEm");
  });

  it("o conjunto calcula-se sobre a lista toda, e não cartão a cartão", () => {
    // «Os cinco mais recentes» é uma propriedade do conjunto — os que estão no
    // ecrã e os que ficaram por baixo — e não de cada cartão sozinho.
    expect(LIMPO).toContain("const porAbrir = useMemo(");
  });

  it("apaga-se no toque, sem esperar pela rede", () => {
    expect(LIMPO).toContain("setLidosAgora((antes) => new Set(antes).add(p.negociacaoId));");
    expect(LIMPO).toContain("lidosAgora.has(p.negociacaoId)");
    expect(LIMPO).toContain('fetch("/api/profissionais/abrir"');
  });

  it("não volta a gravar o que já estava aberto", () => {
    expect(LIMPO).toContain("if (p.abertoEm) return;");
  });
});

describe("o realce dos que ainda não abriu", () => {
  it("tem cor, anel e fundo próprios", () => {
    expect(LIMPO).toContain("bg-cyan-50/40");
    expect(LIMPO).toContain("ring-1 ring-[#00B4CC]/15");
    expect(LIMPO).toContain("border-l-[#00B4CC]");
  });

  it("o ponto respira, e pára para quem pediu menos movimento", () => {
    expect(LIMPO).toContain("animate-pulse motion-reduce:animate-none");
  });

  it("o realce cai quando o cartão é aberto — está preso ao mesmo sinal", () => {
    // `novo` decide as três coisas: o distintivo, a borda e o fundo. Se
    // vivessem em condições separadas, uma delas ficava para trás.
    const i = LIMPO.indexOf("const novo = porAbrir.has(p.negociacaoId);");
    const cartao = LIMPO.slice(i, i + 4000);
    expect(cartao).toContain(": novo");
    expect(cartao).toContain("{novo && (");
  });
});
