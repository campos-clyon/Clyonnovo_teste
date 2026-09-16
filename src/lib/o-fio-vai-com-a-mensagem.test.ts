import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O modelo lê a CONVERSA, e não uma frase solta.
 *
 * "não quero ficar criando palavras para ele, quero que garanta que o gemini
 * esteja analisando as conversas para responder de forma inteligente e precisa
 * sem esses erros" — 16-09-2026.
 *
 * Ler o fio inteiro já existia — `compreenderFio` —, mas só o backoffice o
 * usava, num botão manual. A conversa a sério mandava ao modelo a última
 * mensagem, os campos já sabidos e a pergunta pendente. Nada mais.
 *
 * Num só dia, isso deu: perguntar a morada que o cliente tinha acabado de dar;
 * ler «Quero retirar», a seguir a «estou com uns entulhos aqui na loja», como
 * «quero desistir do pedido» — e oferecer-se para apagar tudo; e responder
 * «Desculpe, não apanhei» a «Acredito que caiba tudo no elevador», que era a
 * resposta à pergunta anterior.
 *
 * Estes testes não prendem o texto das instruções, que há-de mudar. Prendem o
 * CAMINHO: que o fio é lido da base e que chega ao modelo. Foi o caminho que
 * faltou durante uma semana, não as palavras.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

describe("a conversa é lida da base antes de se responder", () => {
  it("o cérebro vai buscar as mensagens do número", () => {
    expect(CEREBRO).toContain("mensagensDoNumeroWhatsApp");
    expect(CEREBRO).toMatch(/const fio = await mensagensDoNumeroWhatsApp\(telefone, \d+\)/);
  });

  it("e uma base em baixo não cala o assistente — vai vazio", () => {
    expect(CEREBRO).toMatch(/mensagensDoNumeroWhatsApp\(telefone, \d+\)\.catch\(\(\) => \[\]\)/);
  });
});

describe("e chega ao modelo", () => {
  it("o fio viaja no mesmo pedido que a mensagem", () => {
    expect(CEREBRO).toContain("agora, pendente, fio)");
  });

  it("`compreender` recebe-o", () => {
    const i = COMPREENSAO.indexOf("export async function compreender(");
    expect(i).toBeGreaterThan(-1);
    const assinatura = COMPREENSAO.slice(i, COMPREENSAO.indexOf("{", i + 40));
    expect(assinatura).toContain("fio");
  });

  it("e as instruções escrevem-no com as duas vozes", () => {
    expect(COMPREENSAO).toContain("function fioEscrito");
    expect(COMPREENSAO).toContain('l.direccao === "out" ? "CLYON" : "cliente"');
  });

  it("sem conversa, o bloco não aparece — nem um cabeçalho vazio", () => {
    expect(COMPREENSAO).toContain("fio.length === 0");
  });
});

describe("as instruções dizem ao modelo o que fazer com o fio", () => {
  it("a última linha é a que se interpreta", () => {
    expect(COMPREENSAO).toContain("A ÚLTIMA linha do cliente é a que tens de interpretar");
  });

  it("e o que já lá está não se volta a perguntar", () => {
    expect(COMPREENSAO).toMatch(/NÃO voltes a dar por não dito/);
  });
});
