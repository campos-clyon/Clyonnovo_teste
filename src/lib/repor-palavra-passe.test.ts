import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { montarHtmlDeRepor } from "./email-repor-palavra-passe";
import { HORAS_DO_LINK_DE_REPOR, DIAS_DO_LINK_DE_SENHA } from "./convite-profissional";

/*
 * REPOR A PALAVRA-PASSE DE UM PROFISSIONAL — 01-10-2026.
 *
 * «Esse profissional não consegue acessar a conta pois perdeu sua senha, e no
 * login também não tem essa função.» Havia o link de uso único do convite, mas
 * só saía ao aprovar alguém sem palavra-passe: quem a perdesse ficava fora da
 * conta e do saldo. Agora pede-se na página de entrada e no «Editar perfil» do
 * backoffice — e vai SÓ POR EMAIL, como o dono escolheu.
 *
 * ⚠️ Grande parte disto lê o código: as rotas precisam de base e de sessão.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha (`tirar-comentarios-sem-comer-codigo`).
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const ESQUECI = semNotas(ler("src/app/api/profissionais/esqueci-palavra-passe/route.ts"));
const ADMIN = semNotas(ler("src/app/api/admin/profissionais/[id]/route.ts"));
const REPOR = semNotas(ler("src/lib/repor-palavra-passe.ts"));
const ENTRAR = semNotas(ler("src/app/profissionais/entrar/EntrarForm.tsx"));
const PAINEL = semNotas(ler("src/components/admin/AdminProfissionaisPanel.tsx"));
const MIDDLEWARE = semNotas(ler("src/middleware.ts"));

describe("na página de entrada: «Esqueci-me da palavra-passe»", () => {
  it("o formulário tem o pedido, e chama a rota", () => {
    expect(ENTRAR).toContain("Esqueci-me da palavra-passe");
    expect(ENTRAR).toContain('fetch("/api/profissionais/esqueci-palavra-passe"');
    // Quem nunca criou a palavra-passe também pede um link, em vez de ir
    // procurar os contactos.
    expect(ENTRAR).toContain("peça um link novo");
  });

  it("fica no mesmo ecrã: é a única porta de /profissionais aberta sem a chave", () => {
    // Uma página à parte (`/profissionais/entrar/esqueci`) dava 404 a quem não
    // tem a chave do MVP — que é quem perdeu o acesso.
    expect(ENTRAR).toContain('if (modo === "repor")');
    expect(MIDDLEWARE).toContain('caminho === "/profissionais/entrar"');
    // E a rota não está atrás da chave: o portão só apanha a inscrição.
    expect(MIDDLEWARE).not.toContain("/api/profissionais/esqueci");
  });

  it("a resposta é sempre a mesma — não diz quem está inscrito", () => {
    const i = ESQUECI.indexOf("const sempreOMesmo");
    expect(i).toBeGreaterThan(-1);
    const retornos = [...ESQUECI.slice(i).matchAll(/return\s+([^;]+);/g)].map((m) => m[1].trim());
    expect(retornos.length).toBeGreaterThan(2);
    for (const r of retornos) expect(r).toBe("sempreOMesmo");
  });

  it("travada por IP e por endereço, e só para contas que podem entrar", () => {
    expect(ESQUECI).toContain("limitarRotaPublica(req,");
    expect(ESQUECI).toContain("limitarPorConta(");
    expect(ESQUECI).toContain("contaPodeEntrarNoPainel(p)");
    expect(ESQUECI).toContain('pedidoPor: "proprio"');
  });
});

describe("no backoffice: «Enviar link para repor»", () => {
  const inicio = ADMIN.indexOf("corpo.reporPalavraPasse === true");
  const fim = ADMIN.indexOf("let conviteEnviado", inicio);
  const BLOCO = ADMIN.slice(inicio, fim);

  it("existe, e sai pelo mesmo emissor", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    expect(BLOCO).toContain("emitirLinkDeRepor(");
    expect(BLOCO).toContain('pedidoPor: "clyon"');
  });

  it("SÓ POR EMAIL: o link nunca vem na resposta", () => {
    // O emissor devolve se o email saiu — e não o token.
    expect(REPOR).toContain("): Promise<boolean> {");
    expect(BLOCO).not.toContain("definir-senha");
    expect(BLOCO).not.toMatch(/\btoken\b/);
    // E o painel não tem onde o mostrar.
    expect(PAINEL).toContain("reporPalavraPasse: true");
    expect(PAINEL).not.toContain("linkDeReporUrl");
  });

  it("não manda o link a uma conta que não pode entrar", () => {
    expect(BLOCO).toContain("contaPodeEntrarNoPainel(p)");
  });
});

describe("o link", () => {
  it("dura horas, não dias — menos do que o do convite", () => {
    expect(HORAS_DO_LINK_DE_REPOR).toBeGreaterThan(0);
    expect(HORAS_DO_LINK_DE_REPOR).toBeLessThanOrEqual(24);
    expect(HORAS_DO_LINK_DE_REPOR).toBeLessThan(DIAS_DO_LINK_DE_SENHA * 24);
    expect(REPOR).toContain("HORAS_DO_LINK_DE_REPOR * 3600_000");
  });

  it("é o de definir a palavra-passe, de uso único, gravado só em hash", () => {
    expect(REPOR).toContain("guardarTokenDePalavraPasse(p.providerId, acesso.hash, expira)");
    const html = montarHtmlDeRepor({
      para: "a@b.pt",
      nome: "Jorge Mudança",
      token: "TOKEN-DE-TESTE",
      baseUrl: "https://clyon.pt",
      horasDeValidade: HORAS_DO_LINK_DE_REPOR,
      pedidoPor: "proprio",
    });
    expect(html).toContain("https://clyon.pt/profissionais/definir-senha/TOKEN-DE-TESTE");
    expect(html).toContain(`expira em ${HORAS_DO_LINK_DE_REPOR} horas`);
    expect(html).toContain("Jorge, escolha uma palavra-passe nova");
  });

  it("o email diz quem o pediu, e que a palavra-passe actual continua a valer", () => {
    const base = {
      para: "a@b.pt",
      nome: "Jorge",
      token: "t",
      baseUrl: "https://clyon.pt",
      horasDeValidade: 24,
    };
    expect(montarHtmlDeRepor({ ...base, pedidoPor: "proprio" })).toContain("Recebemos um pedido");
    expect(montarHtmlDeRepor({ ...base, pedidoPor: "clyon" })).toContain("A equipa da CLYON");
    expect(montarHtmlDeRepor({ ...base, pedidoPor: "clyon" })).toContain("continua a");
  });

  it("o nome vai escapado — vem da base, e foi escrito por alguém", () => {
    const html = montarHtmlDeRepor({
      para: "a@b.pt",
      nome: "<b>Zé</b>",
      token: "t",
      horasDeValidade: 24,
      pedidoPor: "proprio",
    });
    expect(html).not.toContain("<b>Zé</b>");
    expect(html).toContain("&lt;b&gt;Zé&lt;/b&gt;");
  });
});

describe("a página onde se escolhe", () => {
  it("diz «Escolha», que serve a quem cria e a quem repõe", () => {
    const FORM = ler("src/app/profissionais/definir-senha/[token]/DefinirSenhaForm.tsx");
    expect(FORM).toContain("Escolha a sua palavra-passe");
    expect(semNotas(FORM)).not.toContain("Crie a sua palavra-passe");
  });
});
