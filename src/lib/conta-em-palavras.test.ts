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
  it("o preço já foi dito antes dela — a frase não o repete nem soma a taxa", () => {
    /*
     * MUDOU A 29-09-2026. Dizia «Com a taxa CLYON, fica em 315,00 € sem IVA»
     * depois de «Fulano propõe 300 €»: dois números, e a taxa somada à frente
     * do cliente. Agora quem chama diz o preço dele primeiro («propõe
     * 315,00 €»), e aqui fica só o que ele ainda não sabe.
     */
    for (const regime of ["isento", "normal"]) {
      const frase = totalEmPalavras(300, regime);
      expect(frase.startsWith("Valor sem IVA.")).toBe(true);
      expect(frase).not.toContain("taxa CLYON");
      expect(frase).not.toContain("315,00 €");
    }
  });

  it("uma frase só, e são sempre 23 %", () => {
    /*
     * MUDOU A 22-09-2026. Havia duas frases, porque o imposto era do regime de
     * quem facturava: a quem contratasse um profissional na isenção do artigo
     * 53.º dizia-se «Com factura acrescem 3,45 € de IVA da taxa CLYON:
     * 318,45 €», e só aos outros se dizia 23 %.
     *
     * "A CLYON vai emitir as facturas a partir de agora, então vamos ignorar
     * os pros: tudo deve ser a 23 % caso deseje factura."
     *
     * 300 + taxa 15,00 = 315,00 · IVA 72,45 = 387,45.
     */
    const frase = "Valor sem IVA. Com factura acrescem 23 % de IVA: 387,45 €.";
    for (const regime of ["isento", "normal", null, ""]) {
      expect(totalEmPalavras(300, regime)).toBe(frase);
    }
  });

  it("com as taxas da negociação, o total com factura é o dela", () => {
    // O exemplo do dono: 350 € → 367,50 € sem IVA → 452,03 € com factura.
    expect(totalEmPalavras(350, null, { cliente: 0.05, profissional: 0.0655 })).toBe(
      "Valor sem IVA. Com factura acrescem 23 % de IVA: 452,03 €.",
    );
  });

  it("em dinheiro continua a dizer as duas entregas", () => {
    // A CLYON leva as duas taxas ao cliente: 5 + 6,55 = 11,55 % de 350.
    const frase = totalEmPalavras(350, null, { cliente: 0.1155, profissional: 0 }, "dinheiro");
    expect(frase).toContain("Paga 350,00 € em dinheiro ao profissional, no local");
    expect(frase).toContain("40,43 € de taxa à CLYON por referência");
  });

  it("o regime do profissional já não muda uma vírgula", () => {
    /*
     * O argumento ainda lá está na assinatura, porque muitos sítios o passam
     * e tirá-lo era um commit por si. O que este teste guarda é que ele não
     * pode voltar a decidir nada.
     */
    for (const v of [84, 300, 1000]) {
      expect(comFacturaEmPalavras(v, "isento")).toBe(comFacturaEmPalavras(v, "normal"));
      expect(comFacturaEmPalavras(v, "normal")).toContain("23 %");
    }
    expect(contaDoCliente(300).iva).toBe(72.45);
    expect(contaDoCliente(300).semIva).toBe(315);
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

  it("os quatro sítios passam pelo mesmo sítio — com as taxas e a forma DELA", () => {
    /*
     * Sem o parêntese de fecho: a 30-09-2026 as chamadas ganharam a base do
     * preço (por carga). O que isto guarda é a frase vir da função — e, desde
     * 29-09-2026, com as taxas e a forma da negociação. Sem elas a frase fazia
     * a conta com as taxas de origem e como se todos pagassem pela
     * plataforma: a quem escolheu dinheiro dizia-se o total de quem paga por
     * referência.
     */
    expect(CEREBRO).toContain("totalEmPalavras(dados.valor, dados.regimeIva, taxas, forma");
    expect(AVISOS).toContain("totalEmPalavras(pendente.valor, n.regimeIva, taxas, forma");
    expect(AVISOS).toContain("totalEmPalavras(acordado, n.regimeIva, taxas, forma");
    expect(CEREBRO).not.toContain("totalEmPalavras(dados.valor, dados.regimeIva)");
    expect(CEREBRO).not.toContain("totalEmPalavras(dados.valor, dados.regimeIva, undefined");
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
   * Não é o prazo que o paga. O que o prazo faz é escrever uma data e mandar
   * um email: em dinheiro, quem deve o valor ao profissional continua a ser o
   * cliente — que acabou de ler o contrário; pela plataforma, a CLYON só
   * entrega o que o cliente pagou. (A razão escrita aqui até 29-09-2026 era o
   * `A_PLATAFORMA_COBRA` a falso; a promessa continua falsa pelas duas.)
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
