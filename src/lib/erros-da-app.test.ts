import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS ERROS DA APP CLYON PRO CHEGAM À EQUIPA — 25-10-2026.
 *
 * A rota grava a versão, o ecrã, uma mensagem curta e quando — e mais nada:
 * nem a conta, nem o endereço de quem mandou. A mensagem perde emails,
 * telefones e tokens antes de gravar. O backoffice conta os últimos 7 dias
 * na secção Profissionais, e os novos acendem o selo dela.
 */

vi.mock("@/lib/db", () => ({ registarErroDaApp: vi.fn(async () => {}) }));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import * as db from "@/lib/db";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { POST as erroDaApp } from "@/app/api/profissionais/erro-da-app/route";
import { DIAS_DOS_ERROS, MAXIMO_DA_MENSAGEM, lerErroDaApp, quandoDoErro, semDadosDePessoas } from "./erros-da-app";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const pedido = (corpo: unknown) =>
  new NextRequest("http://localhost/api/profissionais/erro-da-app", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a mensagem do erro não leva dados de pessoas", () => {
  it("tira emails, telefones, tokens, IBAN e o que vem depois do «?»", () => {
    const t = semDadosDePessoas(
      "Falhou para alguem@exemplo.pt (912 345 678) com Bearer eyJhbGciOi.abc.def e ExponentPushToken[AbCdEf123456] em https://clyon.pt/pedido/x?t=segredo IBAN PT50000000000000000000000",
    );
    expect(t).not.toContain("@");
    expect(t).not.toMatch(/912/);
    expect(t).not.toContain("eyJ");
    expect(t).not.toContain("ExponentPushToken[");
    expect(t).not.toContain("segredo");
    expect(t).not.toMatch(/PT50\d/);
    expect(t).toContain("[email]");
    expect(t).toContain("[número]");
  });

  it("os códigos compridos dos links também saem", () => {
    expect(semDadosDePessoas("definir-senha/AbCdEfGhIjKlMnOpQrStUvWxYz0123")).toBe("definir-senha/[código]");
  });

  it("uma mensagem normal fica como está", () => {
    expect(semDadosDePessoas("TypeError: Cannot read property 'id' of undefined")).toBe(
      "TypeError: Cannot read property 'id' of undefined",
    );
  });
});

describe("o que a app manda, lido", () => {
  const agora = new Date("2026-10-25T12:00:00Z");

  it("fica só com a versão, o ecrã, a mensagem e quando — o resto não passa", () => {
    const e = lerErroDaApp(
      { versao: "1.0.11", ecra: "trabalhos/[id]", mensagem: "Falhou", quando: "2026-10-25T11:59:00Z", email: "x@y.pt", providerId: 7 },
      agora,
    )!;
    expect(Object.keys(e).sort()).toEqual(["ecra", "mensagem", "quando", "versao"]);
    expect(e).toMatchObject({ versao: "1.0.11", ecra: "trabalhos/[id]", mensagem: "Falhou" });
    expect(e.quando.toISOString()).toBe("2026-10-25T11:59:00.000Z");
  });

  it("sem mensagem não há erro; a mensagem é curta", () => {
    expect(lerErroDaApp({ versao: "1.0.11" }, agora)).toBeNull();
    expect(lerErroDaApp(null, agora)).toBeNull();
    const longa = lerErroDaApp({ mensagem: "a ".repeat(400) }, agora)!;
    expect([...longa.mensagem].length).toBeLessThanOrEqual(MAXIMO_DA_MENSAGEM);
  });

  it("uma versão estranha fica «?», e uma data do futuro ou de há mais de 7 dias fica agora", () => {
    expect(lerErroDaApp({ mensagem: "x", versao: "<script>" }, agora)!.versao).toBe("?");
    expect(quandoDoErro("2026-11-30T00:00:00Z", agora)).toEqual(agora);
    expect(quandoDoErro(new Date(agora.getTime() - (DIAS_DOS_ERROS + 1) * 86400000).toISOString(), agora)).toEqual(agora);
    expect(quandoDoErro("lixo", agora)).toEqual(agora);
  });
});

describe("a rota POST /api/profissionais/erro-da-app", () => {
  it("grava o erro limpo, como sendo da app Pro, sem sessão", async () => {
    const r = await erroDaApp(pedido({ versao: "1.0.11", ecra: "entrar", mensagem: "Falhou para alguem@exemplo.pt" }));
    expect(r.status).toBe(200);
    expect(db.registarErroDaApp).toHaveBeenCalledTimes(1);
    const gravado = vi.mocked(db.registarErroDaApp).mock.calls[0][0];
    expect(gravado).toMatchObject({ app: "pro", versao: "1.0.11", ecra: "entrar", mensagem: "Falhou para [email]" });
  });

  it("tem limite de pedidos", async () => {
    await erroDaApp(pedido({ mensagem: "x" }));
    expect(limitarRotaPublica).toHaveBeenCalledWith(expect.anything(), "app-pro-erro", expect.any(Number), expect.any(Number));
  });

  it("recusa o que não é um erro: sem mensagem, JSON partido ou um corpo enorme", async () => {
    expect((await erroDaApp(pedido({ versao: "1" }))).status).toBe(400);
    expect((await erroDaApp(pedido("{partido"))).status).toBe(400);
    expect((await erroDaApp(pedido({ mensagem: "x".repeat(5000) }))).status).toBe(413);
    expect(db.registarErroDaApp).not.toHaveBeenCalled();
  });
});

describe("a tabela e a equipa", () => {
  const DB = ler("src/lib/db.ts");

  it("a tabela não tem colunas de pessoas", () => {
    const i = DB.indexOf("CREATE TABLE IF NOT EXISTS errosDaApp");
    expect(i).toBeGreaterThan(-1);
    const tabela = DB.slice(i, DB.indexOf(") ENGINE=InnoDB", i)).toLowerCase();
    for (const proibida of ["email", "nome", "telefone", "provider", "ip ", "morada", "token"]) {
      expect(tabela, proibida).not.toContain(proibida);
    }
    for (const coluna of ["versao", "ecra", "mensagem", "quando"]) expect(tabela).toContain(coluna);
  });

  it("os erros novos acendem o selo dos Profissionais", () => {
    const contar = DB.slice(DB.indexOf("export async function contarNovidades"));
    // As duas apps desde 28-10-2026 (S3).
    expect(contar).toMatch(/FROM errosDaApp WHERE app IN \('pro', 'cliente'\) AND recebidoEm > \?",\s*\[desde\.profissionais\]/);
  });

  it("o separador «Erros da app» está na secção Profissionais, com o número dos 7 dias", () => {
    const seccao = ler("src/components/admin/AdminProfissionaisSeccao.tsx");
    expect(seccao).toContain("<AdminErrosDaAppPanel onTotal={setErrosDaApp} />");
    expect(seccao).toMatch(/rotulo: "Erros da app"/);
    const painel = ler("src/components/admin/AdminErrosDaAppPanel.tsx");
    expect(painel).toContain('fetch("/api/admin/profissionais/erros-da-app"');
    expect(ler("src/app/api/admin/profissionais/erros-da-app/route.ts")).toContain("requireAdmin(req)");
  });
});
