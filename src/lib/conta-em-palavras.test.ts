import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contaDoCliente } from "./taxas-plataforma";
import { totalEmPalavras, comFacturaEmPalavras } from "./conta-em-palavras";

/**
 * O QUE SE DIZ AO CLIENTE É O VALOR SEM IVA — E O IMPOSTO NUMA LINHA SÓ.
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
 *
 * Saía «Com o IVA e a taxa CLYON, fica em 318,45 €»: um número que junta três
 * coisas e não diz qual é a dele. Um cliente que não queria factura leu isso,
 * não percebeu, e acabou a pagar ao profissional os 280 € dele — sem os 14 €
 * da nossa taxa. A conta estava certa; foi a mensagem que perdeu o dinheiro.
 *
 * A conta NÃO mudou. `contaDoCliente` continua a calcular o imposto por
 * vendedor, por causa da isenção do artigo 53.º. O que mudou foi qual dos
 * números dela é que se diz primeiro.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a frase diz o mesmo que a conta", () => {
  it("o número grande é serviço mais taxa, sem imposto", () => {
    // 300 + taxa 15,00 = 315,00. É este o número que ele tem de reconhecer.
    expect(totalEmPalavras(300, "isento")).toContain("fica em 315,00 € sem IVA.");
    expect(totalEmPalavras(300, "normal")).toContain("fica em 315,00 € sem IVA.");
  });

  it("profissional isento: o imposto que resta é o da taxa, e é da CLYON", () => {
    /*
     * MESMO COM UM PROFISSIONAL ISENTO há imposto na conta, porque o da taxa é
     * da CLYON e não dele — 14-09-2026. São 3,45 €, e não 23 %: anunciar-lhe
     * 23 % era mostrar-lhe um imposto que ninguém entrega ao Estado.
     */
    expect(totalEmPalavras(300, "isento")).toBe(
      "Com a taxa CLYON, fica em 315,00 € sem IVA. " +
        "Com factura acrescem 3,45 € de IVA da taxa CLYON: 318,45 €.",
    );
  });

  it("profissional que liquida: aí sim, 23 %, e a conta fecha", () => {
    // 300 + taxa 15,00 + IVA 72,45 (69,00 do serviço + 3,45 da taxa) = 387,45
    expect(totalEmPalavras(300, "normal")).toBe(
      "Com a taxa CLYON, fica em 315,00 € sem IVA. Com factura acrescem 23 % de IVA: 387,45 €.",
    );
  });

  it("regime por preencher conta como isento — e a frase acompanha", () => {
    // É o que `regimeDeIva` faz: só «normal» é normal. A frase tem de dizer o
    // mesmo que a conta, seja qual for o valor da coluna.
    expect(totalEmPalavras(300, null)).toBe(totalEmPalavras(300, "isento"));
    expect(totalEmPalavras(300, "")).toBe(totalEmPalavras(300, "isento"));
  });

  it("«23 %» só a quem vai mesmo pagar 23 %", () => {
    expect(comFacturaEmPalavras(300, "normal")).toContain("23 %");
    expect(comFacturaEmPalavras(300, "isento")).not.toContain("23 %");
  });

  it("o isento continua a pagar MENOS imposto do que o que liquida", () => {
    // A distinção que interessa não desapareceu: mudou de «nenhum imposto»
    // para «só o da taxa». Se um dia isto empatar, alguém aplicou 23 % sobre
    // a soma em vez de por vendedor.
    expect(contaDoCliente(300, "isento").iva).toBeLessThan(contaDoCliente(300, "normal").iva);
  });

  it("e o valor sem IVA é o MESMO nos dois regimes", () => {
    // É a razão de ele servir para apresentar: não depende do regime de quem
    // factura, e por isso é o único número que se pode dizer antes de saber
    // com quem o cliente vai ficar.
    expect(contaDoCliente(300, "isento").semIva).toBe(contaDoCliente(300, "normal").semIva);
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

  it("e a percentagem sai da constante, e não escrita à mão", () => {
    // 23 % é uma coisa do mundo e muda por decreto. Escrita à mão numa frase,
    // muda em todo o lado menos ali.
    const FRASE = ler("src/lib/conta-em-palavras.ts");
    expect(FRASE).toContain("Math.round(TAXA_IVA * 100)");
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
