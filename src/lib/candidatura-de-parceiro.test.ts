import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A candidatura de quem se quer tornar parceiro.
 *
 * "Esse botão Tornar-me parceiro não deve jogar para o nosso WhatsApp: deve
 * abrir o formulário para o candidato preencher e vir para a nossa admin para
 * aprovação." — 10-09-2026.
 *
 * O que estes testes guardam não é o desenho: é a promessa. Que o botão não
 * volta a mandar para uma caixa de mensagens, que a rota pública não inscreve
 * ninguém, e que aprovar passa pelo convite de sempre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const HOME = ler("src/app/page.tsx");
const LANDING = ler("src/app/profissionais/page.tsx");
const ROTA_PUBLICA = ler("src/app/api/parceiros/candidatura/route.ts");
const ROTA_ADMIN = ler("src/app/api/admin/candidaturas/route.ts");
const LIB = ler("src/lib/candidaturas.ts");
const PAINEL = ler("src/components/admin/AdminCandidaturasPanel.tsx");
const CONVITES = ler("src/components/admin/AdminConvitesPanel.tsx");

describe("o botão deixa de mandar para o WhatsApp", () => {
  it("«Tornar-me parceiro» abre o formulário", () => {
    const i = HOME.indexOf("Tornar-me parceiro");
    expect(i).toBeGreaterThan(0);
    // Os 900 caracteres antes do rótulo são o elemento que o embrulha.
    const antes = HOME.slice(Math.max(0, i - 900), i);
    expect(antes).toContain('href="/quero-ser-parceiro"');
    expect(antes).not.toContain("wa.me/");
  });

  it("a landing dos profissionais também, em vez do formulário de clientes", () => {
    const i = LANDING.indexOf("Quero receber o convite");
    expect(i).toBeGreaterThan(0);
    expect(LANDING.slice(Math.max(0, i - 400), i)).toContain('href="/quero-ser-parceiro"');
  });
});

describe("a rota pública recebe, e não inscreve", () => {
  it("tem limite por IP — é a única escrita sem sessão nem convite", () => {
    expect(ROTA_PUBLICA).toContain("limitarRotaPublica");
  });

  it("não cria profissional nenhum: só guarda a candidatura", () => {
    expect(ROTA_PUBLICA).toContain("guardarCandidatura");
    expect(ROTA_PUBLICA).not.toContain("criarProfissional");
    expect(ROTA_PUBLICA).not.toContain("criarConvite");
  });

  it("valida o email e o telefone com as mesmas regras da inscrição", () => {
    expect(ROTA_PUBLICA).toContain("emailValido");
    expect(ROTA_PUBLICA).toContain("telefoneValido");
    expect(ROTA_PUBLICA).toContain("CATEGORIAS_VALIDAS");
  });

  it("responde o mesmo a quem se candidata duas vezes", () => {
    /*
     * Dizer "já se tinha candidatado" conta a quem sonda quais os emails que
     * já cá estão. A resposta é igual nos dois casos.
     */
    expect(LIB).toContain("repetida");
    expect(ROTA_PUBLICA).toContain("ok: true, repetida");
  });
});

describe("aprovar passa pelo convite de sempre", () => {
  it("cria o convite com o mesmo token e a mesma validade", () => {
    expect(ROTA_ADMIN).toContain("criarConvite");
    expect(ROTA_ADMIN).toContain("DIAS_DE_VALIDADE_DO_CONVITE");
    expect(ROTA_ADMIN).toContain("enviarConviteAoProfissional");
  });

  it("não convida duas vezes o mesmo email", () => {
    expect(ROTA_ADMIN).toContain("profissionalPorEmail");
    expect(ROTA_ADMIN).toContain("convitePorEmail");
  });

  it("sem email, devolve o link para se mandar à mão", () => {
    // Senão a candidatura morre por causa de um servidor de email em baixo.
    expect(ROTA_ADMIN).toContain("link: enviado ? null : comChave(");
  });

  it("só o admin ou um assistente com a secção dos profissionais lá chega", () => {
    expect(ROTA_ADMIN).toContain("requireAdmin");
    const PAPEL = ler("src/lib/papel-do-painel.ts");
    expect(PAPEL).toContain('"/api/admin/candidaturas"');
    expect(PAPEL).toContain('{ prefixo: "/api/admin/candidaturas", seccoes: ["profissionais"] }');
  });
});

describe("a candidatura aparece a quem a tem de ler", () => {
  it("o painel dos convites mostra-a por cima", () => {
    expect(CONVITES).toContain("<AdminCandidaturasPanel />");
  });

  it("distingue as por tratar das já tratadas", () => {
    expect(PAINEL).toContain('c.estado === "nova"');
    expect(PAINEL).toContain("verTratadas");
  });
});
