import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textoDaApp, validarGmail, versaoDoCabecalho } from "./app-pro-no-telemovel";

/*
 * QUEM TEM A APP CLYON PRO — 27-10-2026.
 *
 * A rota da sessão grava quando a app abriu e com que versão; o backoffice
 * mostra-o na lista dos profissionais; o convite do painel deixa escrever
 * outro Gmail, e a secção Profissionais mostra a lista para o teste.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("as colunas nascem sem apagar nada", () => {
  const DB = ler("src/lib/db.ts");
  it("quatro colunas novas em providers, por ALTER TABLE ADD COLUMN", () => {
    for (const c of ["appAbertaEm DATETIME", "appVersao VARCHAR(40)", "gmailDoTeste VARCHAR(120)", "gmailDoTesteEm DATETIME"]) {
      expect(DB).toContain(`ALTER TABLE providers ADD COLUMN ${c} NULL DEFAULT NULL`);
    }
  });

  it("a versão das migrações subiu, para os processos quentes as criarem", () => {
    expect(DB).toMatch(/const VERSAO_DOS_PROFISSIONAIS = ([5-9]|\d{2,});/);
  });

  it("o Gmail sai quando a conta é apagada", () => {
    const i = DB.indexOf("SET name = 'Profissional removido'");
    expect(DB.slice(i, DB.indexOf("WHERE id = ?", i))).toContain("gmailDoTeste = NULL");
  });

  it("um Gmail novo acende o selo da secção Profissionais", () => {
    expect(DB).toContain("SELECT COUNT(*) AS n FROM providers WHERE gmailDoTesteEm > ?");
  });
});

describe("a rota da sessão grava a abertura da app", () => {
  const S = ler("src/app/api/profissionais/sessao/route.ts");
  it("depois de renovar, com a versão do cabeçalho", () => {
    const renova = S.indexOf("await assinarSessaoDoProfissional(");
    const grava = S.indexOf("await registarAppAberta(sessao.providerId, versao)");
    expect(renova).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(renova);
    expect(S).toContain("CABECALHOS_DA_VERSAO");
  });

  it("a versão do cabeçalho é limpa, e vazia se não vier", () => {
    expect(versaoDoCabecalho("1.0.3")).toBe("1.0.3");
    expect(versaoDoCabecalho(" 1.0.3 (11) ")).toBe("1.0.3 (11)");
    expect(versaoDoCabecalho(null)).toBe("");
    expect(versaoDoCabecalho("<script>")).toBe("");
  });
});

describe("o que o backoffice mostra", () => {
  it("«App: sim, aberta a {data} · {versão}» em hora de Lisboa, ou «sem app»", () => {
    // 27/10/2026 já é Inverno: Lisboa = UTC.
    expect(textoDaApp(new Date("2026-10-27T13:05:00Z"), "1.0.3")).toBe("App: sim, aberta a 27/10/2026 · 13:05 · 1.0.3");
    expect(textoDaApp(new Date("2026-10-27T13:05:00Z"), "")).toBe("App: sim, aberta a 27/10/2026 · 13:05");
    expect(textoDaApp(null)).toBe("sem app");
  });

  it("a lista dos profissionais leva o texto, e não o Gmail", () => {
    const R = ler("src/app/api/admin/profissionais/route.ts");
    expect(R).toContain("appAbertaEm, appVersao,");
    expect(R).toContain("app: textoDaApp(");
    expect(R).not.toContain("gmailDoTeste");
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain("{p.app}");
  });

  it("os Gmails têm rota própria, debaixo de /api/admin/profissionais/ (só a secção Profissionais)", () => {
    const R = ler("src/app/api/admin/profissionais/gmails-do-teste/route.ts");
    expect(R).toContain("await requireAdmin(req)");
    const PAPEL = readFileSync(join(process.cwd(), "src/lib/papel-do-painel.ts"), "utf8");
    expect(PAPEL).toContain('{ prefixo: "/api/admin/profissionais", seccoes: ["profissionais"] }');
    expect(ler("src/components/admin/AdminProfissionaisSeccao.tsx")).toContain("<AdminGmailsDoTestePanel");
  });
});

describe("o convite do painel", () => {
  it("valida um @gmail.com, e só esse", () => {
    expect(validarGmail(" Nome.Apelido@Gmail.com ")).toEqual({ ok: true, gmail: "nome.apelido@gmail.com" });
    expect(validarGmail("nome@hotmail.com").ok).toBe(false);
    expect(validarGmail("").ok).toBe(false);
    expect(validarGmail("a@gmail.com.pt").ok).toBe(false);
  });

  it("tem «O Gmail do meu telemóvel é outro» e grava pela rota, com a conta da sessão", () => {
    const C = ler("src/app/profissionais/painel/ConviteDaAppPro.tsx");
    expect(C).toContain("O Gmail do meu telemóvel é outro");
    expect(C).toContain('fetch("/api/profissionais/gmail-do-teste"');
    const R = ler("src/app/api/profissionais/gmail-do-teste/route.ts");
    expect(R).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(R).toContain("validarGmail(corpo.gmail)");
    expect(R).toContain("guardarGmailDoTeste(sessao.providerId, v.gmail)");
  });
});
