import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contaDoCliente } from "./taxas-plataforma";
import { totalEmPalavras } from "./conta-em-palavras";

/**
 * O WHATSAPP DEIXA DE ANUNCIAR IVA A QUEM NÃO O PAGA.
 *
 * A frase era sempre a mesma — «Com o IVA e a taxa CLYON, fica em 315,00 €» —
 * e 315 eram 300 mais 5 % de taxa, com ZERO de imposto. O regime é do
 * profissional: um isento pelo artigo 53.º não liquida IVA nenhum, e a coluna
 * `providers.regimeIva` nasce em `isento`. O caso comum era exactamente aquele
 * em que a frase mentia.
 *
 * O ecrã do site já distinguia os dois casos. O WhatsApp, que é o único canal
 * que fala sozinho e sem ninguém a rever, era o único que não ramificava.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a frase diz o mesmo que a conta", () => {
  /*
   * MUDOU A 14-09-2026. A taxa da CLYON passou a levar IVA — ela assume as
   * facturas, e a conta é valor + taxa + IVA. Consequência que não é óbvia:
   * MESMO COM UM PROFISSIONAL ISENTO há agora imposto na conta, porque o da
   * taxa é da CLYON e não dele.
   */
  it("profissional isento: o imposto que resta é o da taxa, e é da CLYON", () => {
    // 300 + taxa 15,00 + IVA da taxa 3,45 = 318,45. Do serviço, zero.
    expect(totalEmPalavras(300, "isento")).toBe("Com o IVA e a taxa CLYON, fica em 318,45 €.");
  });

  it("profissional que liquida: os dois impostos, e a conta fecha", () => {
    // 300 + taxa 15,00 + IVA 72,45 (69,00 do serviço + 3,45 da taxa) = 387,45
    expect(totalEmPalavras(300, "normal")).toBe("Com o IVA e a taxa CLYON, fica em 387,45 €.");
  });

  it("regime por preencher conta como isento — e a frase acompanha", () => {
    // É o que `regimeDeIva` faz: só «normal» é normal. A frase tem de dizer o
    // mesmo que a conta, seja qual for o valor da coluna.
    expect(totalEmPalavras(300, null)).toBe("Com o IVA e a taxa CLYON, fica em 318,45 €.");
    expect(totalEmPalavras(300, "")).toBe("Com o IVA e a taxa CLYON, fica em 318,45 €.");
  });

  it("o isento continua a pagar MENOS imposto do que o que liquida", () => {
    // A distinção que interessa não desapareceu: mudou de «nenhum imposto»
    // para «só o da taxa». Se um dia isto empatar, alguém aplicou 23 % sobre
    // a soma em vez de por vendedor.
    expect(contaDoCliente(300, "isento").iva).toBeLessThan(contaDoCliente(300, "normal").iva);
  });
});

describe("a frase está escrita uma vez só", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
  const AVISOS = ler("src/lib/assistente-automatico.ts");

  it("nem o cérebro nem os avisos voltam a escrevê-la à mão", () => {
    expect(CEREBRO).not.toContain("Com o IVA e a taxa CLYON, fica em ${euros(conta.total)}");
    expect(AVISOS).not.toContain("com o imposto e a taxa da CLYON fica em");
    expect(AVISOS).not.toContain("Com o imposto e a taxa fica em");
  });

  it("os quatro sítios passam pelo mesmo sítio", () => {
    expect(CEREBRO).toContain("totalEmPalavras(dados.valor, dados.regimeIva)");
    expect(AVISOS).toContain("totalEmPalavras(pendente.valor, n.regimeIva)");
    expect(AVISOS).toContain("totalEmPalavras(acordado, n.regimeIva)");
  });
});

describe("ninguém recebe dinheiro por o cliente ficar calado", () => {
  const AVISOS = ler("src/lib/assistente-automatico.ts");

  /*
   * O lembrete dizia: «se não me disser nada, o pedido fecha-se sozinho dentro
   * de poucos dias e o profissional recebe».
   *
   * Não recebe. `A_PLATAFORMA_COBRA` é `false`, a CLYON não guarda dinheiro
   * nenhum, e o que o prazo faz é escrever uma data e mandar um email. Depois
   * do prazo quem deve o dinheiro ao profissional continua a ser o cliente —
   * que acabou de ler o contrário. Era a frase da plataforma que COBRA, dita a
   * quem vive na que não cobra.
   */
  it("a promessa de pagamento automático saiu do lembrete", () => {
    expect(AVISOS).not.toContain("o pedido fecha-se sozinho dentro de poucos dias");
    expect(AVISOS).not.toContain("profissional recebe. Se houver algum problema");
  });

  it("o prazo vem de onde está escrito e testado, e não à mão", () => {
    expect(AVISOS).toContain("prazoAutomaticoPorExtenso(DIAS_ATE_LIBERTAR_SOZINHO)");
    // «ao fim de sete dias» estava escrito ao lado de uma constante que os
    // pode mudar sem a frase dar por isso.
    expect(AVISOS).not.toContain("ao fim de sete dias fecha sozinho");
  });
});
