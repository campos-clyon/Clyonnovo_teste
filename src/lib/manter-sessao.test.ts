import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_A_LEMBRAR,
  HORAS_SEM_LEMBRAR,
  LEMBRAR_POR_OMISSAO,
  SEGUNDOS_A_LEMBRAR,
  SEGUNDOS_SEM_LEMBRAR,
  devePrologar,
  duracaoDaSessao,
  lerLembrar,
  maxAgeDoCookie,
} from "./manter-sessao";

/**
 * MANTER-ME LIGADO.
 *
 * "Crie a opção manter-me conectado, e garanta que funcione para eles não
 * terem de entrar com senha várias vezes ao dia." — 15-09-2026.
 *
 * O QUE MUDOU O DESENHO: a sessão já durava trinta dias, com cookie
 * persistente e `httpOnly`, escrito igual nos três sítios que o escrevem. Uma
 * caixa por cima disso era um enfeite a prometer o que já acontecia.
 *
 * Então a caixa ganha o significado que faltava — quem a DESLIGA está a dizer
 * «este computador não é meu» — e junta-se o que faltava mesmo: a renovação.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AUTH = ler("src/lib/profissional-auth.ts");
const ENTRAR = ler("src/app/api/profissionais/entrar/route.ts");
const FORM = ler("src/app/profissionais/entrar/EntrarForm.tsx");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");

describe("as duas durações", () => {
  it("lembrado são trinta dias; não lembrado, um dia de trabalho", () => {
    expect(DIAS_A_LEMBRAR).toBe(30);
    expect(HORAS_SEM_LEMBRAR).toBe(12);
    expect(duracaoDaSessao(true)).toBe(SEGUNDOS_A_LEMBRAR);
    expect(duracaoDaSessao(false)).toBe(SEGUNDOS_SEM_LEMBRAR);
  });

  it("sem lembrar, o cookie morre com o browser — e NÃO é maxAge zero", () => {
    /*
     * A distinção que parece um detalhe e não é: `maxAge: 0` APAGA o cookie,
     * que é como se faz o sair. Trocar um pelo outro dava uma sessão que
     * terminava no instante em que começava, e só a quem desmarcasse a caixa.
     */
    expect(maxAgeDoCookie(false)).toBeUndefined();
    expect(maxAgeDoCookie(false)).not.toBe(0);
    expect(maxAgeDoCookie(true)).toBe(SEGUNDOS_A_LEMBRAR);
  });
});

describe("a caixa vem marcada", () => {
  it("por omissão, e é uma decisão", () => {
    // É o que ele quer em quase todos os casos, e é o que o sistema já fazia.
    expect(LEMBRAR_POR_OMISSAO).toBe(true);
    expect(lerLembrar(undefined)).toBe(true);
    expect(lerLembrar(null)).toBe(true);
  });

  it("só um «não» explícito a desliga", () => {
    expect(lerLembrar(false)).toBe(false);
    expect(lerLembrar("false")).toBe(false);
    expect(lerLembrar(true)).toBe(true);
    // Lixo no corpo do pedido não deve deitar ninguém fora.
    expect(lerLembrar("talvez")).toBe(true);
  });
});

describe("a renovação — o que ele pediu de verdade", () => {
  const agora = new Date("2026-09-15T12:00:00Z");
  const daquiA = (segundos: number) => Math.floor(agora.getTime() / 1000) + segundos;

  it("não se renova enquanto sobra mais de metade do prazo", () => {
    /*
     * Renovar a cada pedido escrevia um Set-Cookie em todas as respostas do
     * painel — que se recarrega de minuto a minuto — para não mudar nada nas
     * primeiras duas semanas.
     */
    expect(devePrologar(daquiA(SEGUNDOS_A_LEMBRAR), true, agora)).toBe(false);
    expect(devePrologar(daquiA(SEGUNDOS_A_LEMBRAR / 2 + 60), true, agora)).toBe(false);
  });

  it("renova-se passada metade — e é isso que o mantém ligado para sempre", () => {
    // Enquanto ele for usando o painel, o prazo conta-se sempre da última vez
    // que cá esteve. Nunca é posto fora.
    expect(devePrologar(daquiA(SEGUNDOS_A_LEMBRAR / 2 - 60), true, agora)).toBe(true);
    expect(devePrologar(daquiA(60), true, agora)).toBe(true);
  });

  it("um token JÁ expirado não se renova", () => {
    // Renovar um token morto era emitir uma sessão a partir de nada.
    expect(devePrologar(daquiA(-1), true, agora)).toBe(false);
    expect(devePrologar(daquiA(0), true, agora)).toBe(false);
  });

  it("quem DESMARCOU a caixa nunca é renovado", () => {
    /*
     * Renovar-lhe a sessão era desfazer pelas costas a escolha que ele fez à
     * frente — e num computador emprestado isso é deixar a conta dele aberta
     * a quem vier a seguir.
     */
    expect(devePrologar(daquiA(60), false, agora)).toBe(false);
    expect(devePrologar(daquiA(SEGUNDOS_SEM_LEMBRAR / 2 - 1), false, agora)).toBe(false);
  });

  it("sem validade conhecida, não se inventa uma", () => {
    expect(devePrologar(null, true, agora)).toBe(false);
    expect(devePrologar(undefined, true, agora)).toBe(false);
    expect(devePrologar(NaN, true, agora)).toBe(false);
  });
});

describe("as ligações", () => {
  it("o cookie escreve-se num sítio só", () => {
    /*
     * Eram três rotas com cinco opções copiadas à mão. Uma que um dia fica
     * diferente das outras é sempre a que ninguém olha: um `httpOnly`
     * esquecido abre a sessão ao JavaScript da página.
     */
    expect(AUTH).toContain("export function porSessaoNaResposta");
    expect(AUTH).toContain("httpOnly: true");
    expect(AUTH).toContain("maxAge: maxAgeDoCookie(lembrar)");
    expect(ENTRAR).toContain("porSessaoNaResposta(resposta, token, lembrar)");
  });

  it("o prazo do token sai da MESMA função que o do cookie", () => {
    /*
     * Eram dois números a ter de concordar, e o dia em que discordassem dava
     * um token vivo dentro de um cookie morto — ou uma sessão que o browser
     * guarda e o servidor recusa.
     */
    expect(AUTH).toContain("duracaoDaSessao(lembrar)");
  });

  it("a escolha chega do formulário ao token", () => {
    expect(FORM).toContain("JSON.stringify({ email, palavraPasse, lembrar })");
    expect(ENTRAR).toContain("lerLembrar(corpo.lembrar)");
  });

  it("e a renovação corre na rota que o painel pede SEMPRE", () => {
    // Ao abrir e de minuto a minuto: é a única que se pode prometer que corre
    // em todas as visitas.
    expect(PERFIL).toContain("renovarSessaoSePreciso(resposta, sessao)");
  });

  it("falhar a renovar não impede a resposta de sair", () => {
    // A sessão fica como estava, e ainda tem quinze dias pela frente.
    const i = AUTH.indexOf("export async function renovarSessaoSePreciso");
    const corpo = AUTH.slice(i);
    expect(corpo).toContain("catch");
    expect(corpo).toContain("return false;");
  });

  it("o ecrã diz o prazo em vez de prometer «para sempre»", () => {
    // Um número é uma promessa que se pode cumprir.
    expect(FORM).toContain("Manter-me ligado");
    expect(FORM).toContain("${DIAS_A_LEMBRAR} dias");
    expect(FORM).toContain("Termina quando fechar o browser");
  });
});
