import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FRASE_DO_ESQUECI,
  FRASE_DO_REGISTO,
  HORAS_DA_CONFIRMACAO,
  HORAS_DO_REPOR,
  nomeDoRegisto,
  pareceUmTokenDaConta,
} from "./palavra-passe-do-cliente";

/*
 * A CONTA DE CLIENTE COM PALAVRA-PASSE — 01-11-2026.
 *
 * A regra que guarda: os pedidos juntam-se à conta pelo email, por isso
 * NENHUMA sessão se abre e NENHUMA palavra-passe passa para a conta antes de o
 * email estar provado (o link do email, ou uma sessão que já o provou).
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const REGISTO = ler("src/app/api/entrada/registo/route.ts");
const ENTRAR = ler("src/app/api/entrada/palavra-passe/route.ts");
const ESQUECI = ler("src/app/api/entrada/esqueci/route.ts");
const CONFIRMAR = ler("src/app/api/entrada/confirmar/route.ts");
const REPOR = ler("src/app/api/entrada/repor/route.ts");
const CONTA = ler("src/app/api/conta/palavra-passe/route.ts");
const BASE = ler("src/lib/conta-com-palavra-passe.ts");
const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");

describe("o registo não abre nada antes de o email ser confirmado", () => {
  it("não grava palavra-passe na conta nem abre sessão", () => {
    expect(REGISTO).not.toContain("gravarPalavraPasseDoCliente");
    expect(REGISTO).not.toContain("porSessaoDoClienteNoSite");
    expect(REGISTO).not.toContain("assinarSessaoDoCliente");
    expect(REGISTO).not.toContain("contaConfirmada");
  });
  it("a palavra-passe escolhida fica à espera, junto do link de registo", () => {
    expect(REGISTO).toContain('criarLinkDaConta("registo", email, { nome, passwordHashPendente: hash })');
  });
  it("uma conta que já existe recebe o email de definir ou de «já tem», nunca uma segunda conta", () => {
    expect(REGISTO).toContain('criarLinkDaConta("definir", email)');
    expect(REGISTO).toContain('criarLinkDaConta("repor", email)');
  });
  it("a resposta é sempre a mesma frase", () => {
    expect(REGISTO).toContain("NextResponse.json({ ok: true, mensagem: FRASE_DO_REGISTO })");
    expect(REGISTO.match(/return sempreOMesmo;/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("só o link do email passa a palavra-passe para a conta", () => {
  it("a confirmação gasta só links de registo, e só ela usa o hash pendente", () => {
    expect(CONFIRMAR).toContain('gastarLinkDaConta(corpo?.token, ["registo"])');
    expect(CONFIRMAR).toContain("gravarPalavraPasseDoCliente(userId, passwordHashPendente)");
    for (const f of [REGISTO, ENTRAR, ESQUECI, REPOR, CONTA]) {
      expect(f).not.toMatch(/gravarPalavraPasseDoCliente\([^)]*Pendente/);
    }
  });
  it("o repor só aceita links de definir e de repor", () => {
    expect(REPOR).toContain('const TIPOS: readonly TipoDoLink[] = ["definir", "repor"];');
  });
  it("os links gastam-se num só UPDATE com o uso único e o prazo lá dentro", () => {
    expect(BASE).toMatch(/SET usadoEm = NOW\(\)\s+WHERE tokenHash = \? AND usadoEm IS NULL AND expiraEm > NOW\(\)/);
  });
  it("na base fica o hash do token, nunca o token", () => {
    expect(BASE).toContain("hashDoTokenDaConta(token)");
    expect(BASE).not.toMatch(/INSERT INTO clienteLinksDaConta[^;]*\btoken\b,/);
  });
});

describe("a entrada", () => {
  it("o erro é sempre o mesmo, e há travão por endereço e por email", () => {
    expect(ENTRAR).toContain("ERRO_DE_ENTRADA");
    expect(ENTRAR).toContain('limitarRotaPublica(req, "entrada-palavra-passe-ip", 10, 600)');
    expect(ENTRAR).toContain('limitarPorConta("entrada-palavra-passe-email", email, 5, 900)');
  });
  it("«por confirmar» só depois de a palavra-passe conferir com a do registo", () => {
    const i = ENTRAR.indexOf('codigo: "por-confirmar"');
    const j = ENTRAR.indexOf("palavraPasseConfere(palavraPasse, pendente.passwordHashPendente)");
    expect(j).toBeGreaterThan(-1);
    expect(i).toBeGreaterThan(j);
  });
  it("a app recebe o mesmo formato da entrada com o Google", () => {
    expect(ENTRAR).toContain('assinarSessaoDoCliente(email, "palavra-passe")');
    expect(ENTRAR).toContain('entrada: "palavra-passe"');
  });
  it("alterar com palavra-passe já definida pede a actual", () => {
    expect(CONTA).toContain("palavraPasseConfere(actual, conta.passwordHash)");
  });
});

describe("a palavra-passe não vive em users", () => {
  it("nenhuma coluna nova em users (lida com SELECT * e devolvida ao browser)", () => {
    const i = DB.indexOf("export async function ensureUsersSchema");
    const fim = DB.indexOf("// ─── Providers", i);
    expect(DB.slice(i, fim)).not.toMatch(/passwordHash|palavraPasse/i);
  });
  it("apagar a conta apaga a palavra-passe e os links", () => {
    const i = DB.indexOf("export async function apagarContaDeCliente(");
    const corpo = DB.slice(i, DB.indexOf("export async function apagarFotosDoBlob", i));
    expect(corpo).toContain("DELETE FROM clientePalavrasPasse WHERE userId IN");
    expect(corpo).toContain("DELETE FROM clienteLinksDaConta WHERE email = ?");
  });
});

describe("as regras puras", () => {
  it("prazos: 24 h para confirmar, 1 h para repor", () => {
    expect(HORAS_DA_CONFIRMACAO).toBe(24);
    expect(HORAS_DO_REPOR).toBe(1);
    expect(FRASE_DO_REGISTO).toContain("24 horas");
    expect(FRASE_DO_ESQUECI).toContain("1 hora");
  });
  it("o token tem a forma de 32 bytes em base64url", () => {
    expect(pareceUmTokenDaConta("a".repeat(43))).toBe(true);
    expect(pareceUmTokenDaConta("a".repeat(42))).toBe(false);
    expect(pareceUmTokenDaConta("a".repeat(42) + "!")).toBe(false);
    expect(pareceUmTokenDaConta(undefined)).toBe(false);
  });
  it("o nome do registo", () => {
    expect(nomeDoRegisto("  Ana   Maria ")).toBe("Ana Maria");
    expect(nomeDoRegisto("A")).toBeNull();
    expect(nomeDoRegisto(42)).toBeNull();
    expect(nomeDoRegisto("x".repeat(121))).toBeNull();
  });
});
