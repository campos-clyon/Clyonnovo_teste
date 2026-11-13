import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { COOKIE_SESSAO_PROFISSIONAL } from "./profissional-auth";
import { NOVO_MODELO_DESDE, NOVO_MODELO_DESDE_POR_EXTENSO, VERSAO_DOS_TERMOS, VERSAO_DOS_TERMOS_POR_EXTENSO } from "./novo-modelo";
import { TEXTOS_DA_ACEITACAO, eAVersaoEmVigor, precisaDeAceitar } from "./aceitacao-dos-termos";

/*
 * A ACEITAÇÃO DOS TERMOS DE 15-11-2026 — d20 (CEO e dono, 13-11-2026).
 * A versão nasce da data do modelo; a caixa nunca vem marcada; grava-se a versão,
 * o instante e a origem; e não bloqueia (está por confirmar).
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

let agora = new Date("2026-11-16T10:00:00Z");
vi.mock("@/lib/relogio-do-modelo", () => ({ agoraDoModelo: () => agora }));

// O profissional de teste, autenticado pela sessão.
const PROFISSIONAL_DE_TESTE = 9001;
vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: async (t: string | null) =>
    t ? { providerId: PROFISSIONAL_DE_TESTE, nome: "Profissional de teste" } : null,
}));

// Uma base em memória, só com a tabela das aceitações.
type Linha = { providerId: number; versao: string; em: string; origem: string };
const tabela: Linha[] = [];
const consultas: string[] = [];
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getPool: async () => ({
    execute: async (sql: string, args: unknown[] = []) => {
      consultas.push(sql);
      if (/^\s*CREATE TABLE/i.test(sql)) return [[]];
      if (/^INSERT IGNORE INTO aceitacoesDosTermos/.test(sql)) {
        const [providerId, versao, em, origem] = args as [number, string, string, string];
        if (!tabela.some((l) => l.providerId === providerId && l.versao === versao)) {
          tabela.push({ providerId, versao, em, origem });
        }
        return [{ affectedRows: 1 }];
      }
      if (/^SELECT versao, em, origem FROM aceitacoesDosTermos/.test(sql)) {
        const [providerId, versao] = args as [number, string];
        return [tabela.filter((l) => l.providerId === providerId && l.versao === versao)];
      }
      throw new Error("consulta inesperada: " + sql);
    },
  }),
}));

const pedido = (metodo: "GET" | "POST", corpo?: unknown, daApp = false) =>
  new NextRequest("https://clyon.pt/api/profissionais/termos", {
    method: metodo,
    headers: {
      "content-type": "application/json",
      ...(daApp ? { authorization: "Bearer token-da-app" } : { cookie: `${COOKIE_SESSAO_PROFISSIONAL}=token-do-painel` }),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });

describe("a versão dos Termos nasce da data do modelo", () => {
  it("2026-11-15, «15 de novembro de 2026», e a caixa di-la", () => {
    expect(VERSAO_DOS_TERMOS).toBe("2026-11-15");
    expect(VERSAO_DOS_TERMOS).toBe(NOVO_MODELO_DESDE.toISOString().slice(0, 10));
    expect(VERSAO_DOS_TERMOS_POR_EXTENSO).toBe(NOVO_MODELO_DESDE_POR_EXTENSO);
    expect(TEXTOS_DA_ACEITACAO.caixa).toContain(`versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO}`);
    expect(TEXTOS_DA_ACEITACAO.caixaDaPalavraPasse).toContain(`versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO}`);
  });

  it("antes da data ninguém vê o ecrã; depois, só quem não aceitou esta versão", () => {
    expect(precisaDeAceitar(null, new Date("2026-11-14T23:59:59Z"))).toBe(false);
    expect(precisaDeAceitar(null, NOVO_MODELO_DESDE)).toBe(true);
    expect(precisaDeAceitar("2026-11-12", NOVO_MODELO_DESDE)).toBe(true);
    expect(precisaDeAceitar(VERSAO_DOS_TERMOS, NOVO_MODELO_DESDE)).toBe(false);
    expect(eAVersaoEmVigor("2026-11-15")).toBe(true);
    expect(eAVersaoEmVigor("2026-11-12")).toBe(false);
  });

  it("sem promessas por confirmar: nada de bloqueio no ecrã nem no texto", () => {
    const textos = Object.values(TEXTOS_DA_ACEITACAO).join(" ");
    expect(textos).not.toMatch(/não (pode )?aceitar nem propor/);
    expect(ler("src/lib/aceitacao-dos-termos.ts")).toContain("NÃO BLOQUEIA");
    // As portas de propor e aceitar não perguntam pela aceitação.
    for (const f of ["src/lib/novo-modelo-no-servidor.ts", "src/app/api/profissionais/negociacao/route.ts"]) {
      expect(ler(f), f).not.toContain("aceitacaoDoProfissional");
    }
  });
});

describe("a aceitação gravada num profissional de teste", () => {
  beforeEach(() => {
    tabela.length = 0;
    consultas.length = 0;
    agora = new Date("2026-11-16T10:00:00Z");
  });

  it("depois da data: pede, grava versão + instante + origem, e deixa de pedir", async () => {
    const rota = await import("@/app/api/profissionais/termos/route");

    const antes = await (await rota.GET(pedido("GET"))).json();
    expect(antes.precisaDeAceitar).toBe(true);
    expect(antes.versao).toBe(VERSAO_DOS_TERMOS);
    expect(antes.textos.titulo).toBe(TEXTOS_DA_ACEITACAO.titulo);

    // Sem a caixa marcada não grava.
    expect((await rota.POST(pedido("POST", { versao: VERSAO_DOS_TERMOS }))).status).toBe(400);
    // Uma versão que não é a em vigor também não.
    expect((await rota.POST(pedido("POST", { versao: "2026-11-12", aceito: true }))).status).toBe(409);
    expect(tabela).toHaveLength(0);

    const r = await rota.POST(pedido("POST", { versao: VERSAO_DOS_TERMOS, aceito: true }));
    expect(r.status).toBe(200);
    expect(tabela).toHaveLength(1);
    expect(tabela[0]).toMatchObject({ providerId: PROFISSIONAL_DE_TESTE, versao: "2026-11-15", origem: "painel" });
    expect(tabela[0].em).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const depois = await (await rota.GET(pedido("GET"))).json();
    expect(depois.precisaDeAceitar).toBe(false);
    expect(depois.aceiteEm).not.toBeNull();

    // A segunda vez (agora pela app) não reescreve a primeira.
    await rota.POST(pedido("POST", { versao: VERSAO_DOS_TERMOS, aceito: true }, true));
    expect(tabela).toHaveLength(1);
    expect(tabela[0].origem).toBe("painel");
  });

  it("pela app, a origem é «app» (vem da sessão, não do corpo)", async () => {
    const rota = await import("@/app/api/profissionais/termos/route");
    await rota.POST(pedido("POST", { versao: VERSAO_DOS_TERMOS, aceito: true, origem: "painel" }, true));
    expect(tabela[0].origem).toBe("app");
  });

  it("antes da data: não pede e não grava, sem ir à tabela", async () => {
    agora = new Date("2026-11-14T12:00:00Z");
    const rota = await import("@/app/api/profissionais/termos/route");
    const e = await (await rota.GET(pedido("GET"))).json();
    expect(e.precisaDeAceitar).toBe(false);
    expect(e.emVigor).toBe(false);
    expect((await rota.POST(pedido("POST", { versao: VERSAO_DOS_TERMOS, aceito: true }))).status).toBe(409);
    expect(tabela).toHaveLength(0);
    expect(consultas.filter((c) => /aceitacoesDosTermos/.test(c) && !/CREATE/.test(c))).toHaveLength(0);
  });

  it("sem sessão: o GET dá só a parte pública (d18, a caixa do definir-senha da app) e o POST 401", async () => {
    const rota = await import("@/app/api/profissionais/termos/route");
    const r = await rota.GET(new NextRequest("https://clyon.pt/api/profissionais/termos"));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.precisaDeAceitar).toBe(false);
    expect(d.aceiteEm).toBeNull();
    expect(typeof d.emVigor).toBe("boolean");
    expect(Object.keys(d).sort()).toEqual(["aceiteEm", "emVigor", "precisaDeAceitar", "textos", "versao", "versaoPorExtenso"]);
    const post = await rota.POST(new NextRequest("https://clyon.pt/api/profissionais/termos", { method: "POST", body: JSON.stringify({ aceito: true }) }));
    expect(post.status).toBe(401);
  });
});

describe("as caixas nunca vêm marcadas", () => {
  it("o ecrã do painel e o criar da palavra-passe começam desmarcados", () => {
    expect(ler("src/app/profissionais/painel/AceitarOsTermos.tsx")).toContain("const [marcada, setMarcada] = useState(false);");
    expect(ler("src/app/profissionais/painel/AceitarOsTermos.tsx")).toContain("disabled={!marcada || aGravar}");
    const f = ler("src/app/profissionais/definir-senha/[token]/DefinirSenhaForm.tsx");
    expect(f).toContain("const [aceitaTermos, setAceitaTermos] = useState(false);");
    expect(f).toContain("pedirTermos && aceitaTermos ? { aceitaTermos: VERSAO_DOS_TERMOS }");
    const rota = ler("src/app/api/profissionais/definir-senha/route.ts");
    expect(rota).toContain("eAVersaoEmVigor(corpo.aceitaTermos) && novoModeloEmVigor(agoraDoModelo())");
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain("<AceitarOsTermos />");
  });
});
