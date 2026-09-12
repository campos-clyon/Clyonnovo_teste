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
    // O botão chamava-se «Quero receber o convite» e abria uma candidatura.
    // "Se ele preencheu um formulário, ele não é um convidado." — 12-09-2026.
    const i = LANDING.indexOf("Quero candidatar-me");
    expect(i).toBeGreaterThan(0);
    expect(LANDING.slice(Math.max(0, i - 400), i)).toContain('href="/quero-ser-parceiro"');
  });
});

describe("não se promete um convite a quem se está a candidatar", () => {
  /*
   * Duas coisas desencontradas, apanhadas pelo dono a 12-09-2026 no ecrã que
   * o candidato vê depois de submeter:
   *
   *   1. o texto prometia «o link para completar o registo» — e esse
   *      formulário deixou de existir a 11-09, quando aprovar passou a criar
   *      a conta. O que lhe chega é o link da palavra-passe;
   *   2. dizia-se-lhe «a entrada é por convite» logo a seguir a ele ter
   *      preenchido um formulário. Convidámo-lo a candidatar-se e, no fim,
   *      dissemos-lhe que só se entra por convite.
   */
  const PAGINA = ler("src/app/quero-ser-parceiro/page.tsx");
  const FORM = ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");

  /*
   * Sem comentários e com o espaço normalizado.
   *
   * Uma frase escrita em JSX parte-se onde a linha acaba — «uma pessoa que lê
   * cada\n candidatura» — e um teste que procure a frase inteira chumba por
   * causa de uma mudança de linha que não mudou nada. O que se quer guardar é
   * o que se lê no ecrã, e no ecrã não há quebras de linha nenhumas.
   */
  const semNotas = (f: string) =>
    f
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ");

  it("o ecrã de sucesso promete a palavra-passe, e não um segundo formulário", () => {
    const visivel = semNotas(FORM);
    expect(visivel).toContain("escolher a sua palavra-passe");
    expect(visivel).not.toContain("link para completar o registo");
  });

  it("nem a página nem o formulário falam de convite a quem se candidata", () => {
    expect(semNotas(PAGINA)).not.toContain("convite");
    expect(semNotas(FORM)).not.toContain("convite");
  });

  it("continua a dizer-se PORQUE é que não há inscrição automática", () => {
    // A frase do convite existia por uma razão boa: explicar ao cliente que
    // quem lhe aparece foi verificado. A razão fica; a palavra errada é que sai.
    expect(semNotas(PAGINA)).toContain("uma pessoa que lê cada candidatura");
    expect(semNotas(PAGINA)).toContain("foi verificado");
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

describe("aprovar cria a conta, e não um segundo formulário", () => {
  /*
   * ISTO MUDOU A 11-09-2026, e o teste mudou com ele.
   *
   * Aprovar criava um CONVITE para um formulário de dez campos onde metade era
   * a repetição do que o candidato acabara de escrever. «Porque é que pede para
   * enviar convite, se ele já preencheu tudo?» — e a pergunta estava certa.
   * Agora cria o profissional e manda o link da palavra-passe.
   */
  it("cria o profissional com o que ele escreveu na candidatura", () => {
    expect(ROTA_ADMIN).toContain("criarProfissional");
    expect(ROTA_ADMIN).toContain("slugLivreParaProfissional");
    // Os serviços que ele escolheu entram como categorias — se não entrassem,
    // ele não receberia pedido nenhum e ninguém saberia porquê.
    expect(ROTA_ADMIN).toContain("categorias: candidatura.servicos");
  });

  it("manda o link da palavra-passe, e não um convite", () => {
    expect(ROTA_ADMIN).toContain("guardarTokenDePalavraPasse");
    expect(ROTA_ADMIN).toContain("enviarEmailDeAprovacao");
    expect(ROTA_ADMIN).toContain("DIAS_DO_LINK_DE_SENHA");
    expect(ROTA_ADMIN).not.toContain("criarConvite(");
  });

  it("o que a candidatura não pergunta fica por preencher, e o painel pede-o", () => {
    // Não se inventam valores para o NIF nem para a morada fiscal: ficam nulos
    // e o cartão do perfil por completar mostra o triângulo em cada um.
    expect(ROTA_ADMIN).toContain("nif: null");
    expect(ROTA_ADMIN).toContain("moradaFiscal: null");
  });

  it("não cria uma segunda conta com o mesmo email", () => {
    expect(ROTA_ADMIN).toContain("profissionalPorEmail");
  });

  it("aprovar abre o painel e não a fila — a conta nasce pendente", () => {
    /*
     * São duas decisões diferentes: «este é quem diz ser» e «este pode ir a
     * casa de um cliente». `criarProfissional` grava sempre `pendente`, e
     * `avaliarElegibilidade` exige `aprovado` para distribuir.
     */
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function criarProfissional");
    expect(DB.slice(i, i + 2000)).toContain("pendente");
    expect(ler("src/lib/profissional-elegivel.ts")).toContain(
      'profissional.estado !== "aprovado"',
    );
  });

  it("quem está pendente consegue definir a palavra-passe", () => {
    // Sem isto, aprovar mandava um link que a própria rota recusava.
    const SENHA = ler("src/app/api/profissionais/definir-senha/route.ts");
    expect(SENHA).toContain('linha.estado !== "aprovado" && linha.estado !== "pendente"');
  });

  it("e consegue voltar a entrar depois de fechar o browser", () => {
    /*
     * A armadilha que esta mudança quase deixou: a entrada exigia `aprovado`.
     * Ele definia a palavra-passe, entrava com a sessão que o link lhe dava,
     * fechava o browser — e a partir daí a conta dele respondia «dados
     * errados» até alguém o aprovar. Passava dias convencido de que se tinha
     * enganado a escrever.
     */
    const ENTRAR = ler("src/app/api/profissionais/entrar/route.ts");
    expect(ENTRAR).toContain('p?.estado === "aprovado" || p?.estado === "pendente"');
    // E continua a barrar quem está suspenso, rejeitado ou desactivado.
    expect(ENTRAR).toContain("p.isActive !== 1");
  });

  it("sem email, devolve o link para se mandar à mão", () => {
    // Senão a candidatura morre por causa de um servidor de email em baixo.
    expect(ROTA_ADMIN).toContain("link: enviado");
    expect(ROTA_ADMIN).toContain("definir-senha");
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
