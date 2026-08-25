import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A porta de entrada do profissional — curta, aberta e sem chave.
 *
 * O link que se dava a um profissional era
 * `/profissionais/entrar?chave=vUyd...` — impossível de ditar ao telefone e
 * partido ao fim de 30 dias, quando o cookie da chave expirava. E quem
 * reabria o email de aprovação depois de já ter criado a palavra-passe levava
 * "Link inválido." sem caminho nenhum.
 *
 * O desenho novo: a página de login fica FORA do portão do MVP (as
 * credenciais do profissional são o portão), `/profissionais/login` é o
 * endereço que se dita, e a sessão dele vale como passagem na camada da
 * chave — senão entrava-se para um 404. Tudo o resto do MVP continua a
 * responder 404 ao público.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const MIDDLEWARE = ler("src/middleware.ts");
const CONVITES = ler("src/app/api/admin/convites/route.ts");
const FORM_SENHA = ler("src/app/profissionais/definir-senha/[token]/DefinirSenhaForm.tsx");
const FOOTER = ler("src/components/Footer.tsx");
const API_ENTRAR = ler("src/app/api/profissionais/entrar/route.ts");

/** O corpo de uma função do middleware, sem os comentários que a explicam. */
function corpoDe(nome: string): string {
  const i = MIDDLEWARE.indexOf(`function ${nome}(`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const fim = MIDDLEWARE.indexOf("\n}", i);
  return MIDDLEWARE.slice(i, fim)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("a página de login está fora do portão", () => {
  it("entrar e login estão na porta aberta", () => {
    const porta = corpoDe("portaAberta");
    expect(porta).toContain('"/profissionais/entrar"');
    expect(porta).toContain('"/profissionais/login"');
  });

  it("/profissionais/login redireciona para a página de entrar", () => {
    expect(MIDDLEWARE).toMatch(
      /"\/profissionais\/login"\)\s*\{\s*\n\s*return NextResponse\.redirect\(new URL\("\/profissionais\/entrar"/,
    );
  });

  it("o resto do MVP continua atrás da chave — a landing e o painel incluídos", () => {
    const chave = corpoDe("exigeChave");
    expect(chave).toContain('"/profissionais"');
    expect(chave).toContain('"/profissionais/"');
    // E o painel continua a exigir a sessão DELE, portão à parte.
    expect(MIDDLEWARE).toContain('nextUrl.pathname.startsWith("/profissionais/painel")');
    expect(MIDDLEWARE).toContain("temSessaoDeProfissional(request)");
  });

  it("abrir a página só é seguro porque a rota de entrar trava a força bruta", () => {
    expect(API_ENTRAR).toContain("limitarRotaPublica");
  });
});

describe("a sessão do profissional vale como passagem", () => {
  it("sem chave nenhuma, uma sessão válida não leva 404 na camada da chave", () => {
    // A ordem importa: o 404 só sai DEPOIS de se tentar a conta.
    const bloco = MIDDLEWARE.slice(
      MIDDLEWARE.indexOf("const sabeOEndereco"),
      MIDDLEWARE.indexOf("A chave passa a cookie"),
    );
    expect(bloco).toContain("temSessaoDeProfissional(request)");
    expect(bloco).toContain("!precisaDeTestador");
  });

  it("a conta não abre a camada do testador — só a da chave", () => {
    // /plataforma continua a exigir chave + credenciais de testador; uma conta
    // de profissional não pode virar chave-mestra da bancada de testes.
    expect(MIDDLEWARE).toMatch(/!precisaDeTestador && \(await temSessaoDeProfissional/);
  });

  it("só se guarda em cookie uma chave que confere", () => {
    // Antes gravava-se o que viesse no endereço: um ?chave=errada pisava um
    // cookie válido e a pessoa passava a levar 404 em todo o lado.
    expect(MIDDLEWARE).toContain("if (chaveNoEndereco && chaveConfere(chaveNoEndereco))");
  });
});

describe("o link que se partilha", () => {
  it("o backoffice mostra o endereço curto, sem chave lá dentro", () => {
    expect(CONVITES).toContain("/profissionais/login`");
    expect(CONVITES).not.toContain("comChave(`${urlDeAccaoDoPedido(req.headers)}/profissionais/entrar`)");
  });

  it("o convite de inscrição continua a levar a chave — essa página vive atrás do portão", () => {
    expect(CONVITES).toContain("comChave(`${base}/profissionais/inscricao/");
  });

  it("o rodapé público leva os profissionais direto ao login", () => {
    expect(FOOTER).toContain('href="/profissionais/entrar"');
    expect(FOOTER).toContain("Sou profissional");
  });
});

describe("o email de aprovação reaberto", () => {
  it("um 403 no definir-senha mostra o caminho para o login", () => {
    expect(FORM_SENHA).toContain("res.status === 403");
    expect(FORM_SENHA).toContain('href="/profissionais/entrar"');
  });
});
