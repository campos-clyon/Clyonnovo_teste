import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eGmail } from "./gmail-do-telemovel";
import { validarGmail } from "./app-pro-no-telemovel";
import { LINK_DO_TESTE_DA_APP_CLIENTE, LINK_DO_TESTE_DA_APP_PRO } from "./links-da-app";

/**
 * A ADESÃO ÀS APPS EM PASSOS — 17-11-2026 (d61).
 *
 * Uma empresa convidada para o teste da CLYON Pro criou uma conta de cliente
 * no topo da página que lhe mandámos (o que servia para a app estava no fim) e
 * usou um email que não era Gmail. Estes testes guardam o que o resolveu.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários (só os que começam a linha), para não contar o que é nota. */
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

const COMPONENTE = semNotas(ler("src/components/AdesaoDaApp.tsx"));
const PRO = semNotas(ler("src/app/app-pro/page.tsx"));
const CLIENTE = semNotas(ler("src/app/app-cliente/page.tsx"));

describe("o Gmail do telemóvel", () => {
  it("é @gmail.com ou @googlemail.com, e mais nada", () => {
    expect(eGmail(" Nome.Apelido@Gmail.com ")).toBe(true);
    expect(eGmail("nome@googlemail.com")).toBe(true);
    expect(eGmail("geral@mudancas-exemplo.pt")).toBe(false);
    expect(eGmail("nome@hotmail.com")).toBe(false);
    expect(eGmail("a@gmail.com.pt")).toBe(false);
    expect(eGmail("")).toBe(false);
    expect(eGmail(null)).toBe(false);
  });

  it("o servidor do profissional aceita o mesmo", () => {
    expect(validarGmail("nome@googlemail.com")).toEqual({ ok: true, gmail: "nome@googlemail.com" });
    expect(validarGmail("geral@mudancas-exemplo.pt").ok).toBe(false);
  });
});

describe("um ecrã de cada vez", () => {
  it("barra do progresso, «Continuar», «Voltar» e o foco no título do passo", () => {
    expect(COMPONENTE).toContain('role="progressbar"');
    expect(COMPONENTE).toContain("aria-valuenow={passo + 1}");
    expect(COMPONENTE).toContain("Continuar");
    expect(COMPONENTE).toContain("Voltar");
    expect(COMPONENTE).toContain("titulo.current?.focus()");
  });

  it("sem JavaScript, os quatro passos aparecem em lista", () => {
    expect(COMPONENTE).toContain("if (!pronto) {");
    expect(COMPONENTE).toContain('<ol className="mt-6 space-y-6">');
  });

  it("o email que não é Gmail leva um aviso e deixa continuar", () => {
    expect(COMPONENTE).toContain("textos.gmail.avisoNaoGmail");
    expect(COMPONENTE).toContain("Continuar mesmo assim");
  });

  it("grava onde já se gravava: providers.gmailDoTeste e o programa do cliente, sem tabela nova", () => {
    expect(COMPONENTE).toContain('fetch("/api/profissionais/gmail-do-teste", {');
    expect(COMPONENTE).toContain('fetch("/api/conta/programa-da-app", {');
    expect(COMPONENTE).toContain("consentimento: true");
    expect(COMPONENTE).not.toMatch(/CREATE TABLE/i);
  });
});

describe("/app-pro e /app-cliente", () => {
  it("abrem sem o cabeçalho do site (sem a conta de cliente no topo)", () => {
    const chrome = ler("src/components/SiteChrome.tsx");
    expect(chrome).toContain('const BARE_ROUTES = ["/orcamento-recolha-lisboa", "/admin", "/app-pro", "/app-cliente"];');
  });

  it("a /app-pro leva ao link do teste e à Play, e manda o cliente para a app dele", () => {
    expect(LINK_DO_TESTE_DA_APP_PRO).toBe("https://play.google.com/apps/testing/pt.clyon.pro");
    expect(PRO).toContain("linkDoTeste={LINK_DO_TESTE_DA_APP_PRO}");
    expect(PRO).toContain("linkDaLoja={APP_PRO_NA_PLAY}");
    expect(PRO).toContain('href: "/app-cliente"');
    expect(PRO).toContain("«Tornar-me testador»");
    expect(PRO).not.toContain('"/entrar"');
    expect(PRO).toContain("index: false");
  });

  it("a /app-cliente diz «parceiro», não cria conta, e o link vem do backoffice", () => {
    expect(LINK_DO_TESTE_DA_APP_CLIENTE).toBe("https://play.google.com/apps/testing/pt.clyon.cliente");
    expect(CLIENTE).toContain("linkDeAdesaoGuardado()");
    expect(CLIENTE).toContain('href: "/app-pro"');
    expect(CLIENTE).toContain("parceiro");
    expect(CLIENTE).not.toMatch(/profission/i);
    expect(CLIENTE).not.toContain("PremiumLoginCard");
    expect(CLIENTE).toContain("consentimento: TEXTOS_DO_CONVITE_NO_SITE.consentimento");
  });
});

describe("onde o profissional adere não aparece a conta de cliente", () => {
  it("o cabeçalho esconde a conta de cliente na /quero-ser-parceiro", () => {
    expect(ler("src/components/Header.tsx")).toContain('pathname === "/quero-ser-parceiro"');
  });

  it("a candidatura e o painel levam aos 4 passos", () => {
    expect(ler("src/app/quero-ser-parceiro/page.tsx")).toContain('href="/app-pro"');
    expect(ler("src/app/profissionais/painel/ConviteDaAppPro.tsx")).toContain('href="/app-pro"');
  });
});
