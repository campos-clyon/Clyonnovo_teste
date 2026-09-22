import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLYON_LIQUIDA_IVA, TAXA_IVA, contaDoCliente } from "./taxas-plataforma";

/**
 * UMA FACTURA, DA CLYON, COM IVA SOBRE TUDO.
 *
 * "A CLYON vai emitir as facturas a partir de agora, então vamos ignorar os
 * pros: tudo deve ser a 23 % caso deseje factura." — 22-09-2026.
 *
 * ESTE FICHEIRO SUBSTITUIU O `as-duas-facturas.test.ts`, e vale a pena saber
 * o que ele guardava, porque a razão dele continua de pé.
 *
 * Nasceu a 14-09-2026 de uma queixa concreta: "o cliente pagou 107,52 mas a
 * factura é de apenas 103,32". A diferença eram 4,20 € de taxa da CLYON que o
 * cliente pagava e que não apareciam em documento nenhum — sistematicamente,
 * em todos os trabalhos. A regra que dali saiu é a que fica: **o que sai da
 * carteira do cliente tem de caber em factura**.
 *
 * O que mudou foi o número de facturas. Enquanto o profissional facturava o
 * serviço ao cliente, o imposto era do regime DELE, e um profissional na
 * isenção do artigo 53.º não podia liquidar nada: a conta fazia-se por
 * vendedor, e 350 € davam 371,53 € a um cliente e 452,03 € a outro, pelo mesmo
 * trabalho. Com a CLYON a facturar, há uma factura e um imposto — o de quem a
 * emite.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o que o cliente paga cabe na factura", () => {
  it("a factura é o total, e o total é o que sai da carteira dele", () => {
    for (const v of [84, 120, 350, 1000]) {
      const c = contaDoCliente(v);
      expect(Number((c.semIva + c.iva).toFixed(2))).toBe(c.total);
      // Nada fica de fora do documento: o serviço, a taxa e o acréscimo estão
      // todos na base sobre a qual o imposto se calcula.
      expect(Number((c.servico + c.taxa + c.acrescimo).toFixed(2))).toBe(c.semIva);
    }
  });

  it("o imposto é 23 % da base — nem mais, nem por partes", () => {
    for (const v of [10, 84, 350, 1000, 12345.67]) {
      const c = contaDoCliente(v);
      expect(c.iva).toBe(Math.round(c.semIva * TAXA_IVA * 100) / 100);
    }
  });

  it("o mesmo trabalho dá o mesmo total, venha o profissional de onde vier", () => {
    /*
     * O CORAÇÃO DA MUDANÇA.
     *
     * A conta deixou de ter um segundo argumento. Não é arrumação: era esse
     * argumento que fazia o mesmo trabalho custar 371,53 € ou 452,03 €
     * conforme quem o fizesse, e era o cliente que pagava a diferença sem
     * nunca perceber porquê.
     */
    expect(contaDoCliente.length).toBeLessThanOrEqual(3);
    expect(contaDoCliente(350).total).toBe(452.03);
  });

  it("a CLYON liquida IVA — e é disso que tudo isto depende", () => {
    expect(CLYON_LIQUIDA_IVA).toBe(true);
    expect(TAXA_IVA).toBe(0.23);
    expect(contaDoCliente(350).temIva).toBe(true);
  });
});

describe("o acréscimo do pagar-depois também leva imposto", () => {
  it("entra na base e não fica de fora do documento", () => {
    const c = contaDoCliente(120, { cliente: 0.05, profissional: 0.06 }, 5);
    expect(c.acrescimo).toBe(5);
    expect(c.semIva).toBe(131);
    expect(c.iva).toBe(30.13);
    expect(c.total).toBe(161.13);
  });
});

describe("o ecrã do backoffice diz a conta pela ordem em que se faz", () => {
  const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
  /** Sem os comentários: o que eles CONTAM não pode fazer um teste passar. */
  const semNotas = (t: string) =>
    t.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");

  it("as duas facturas saíram do ecrã", () => {
    /*
     * "Essas telas estão muito confusas e erradas." O resumo do trabalho
     * fechado dizia «o cliente paga 47,77 €, em duas facturas — 45,00 € do
     * profissional (isento de IVA) e 2,77 € da CLYON (taxa 2,25 € + IVA
     * 0,52 €)», tudo na mesma linha.
     */
    const limpo = semNotas(PAINEL);
    for (const morto of [
      "em duas facturas",
      // Sem o «} do profissional» genérico: a etiqueta da comissão diz «5 % do
      // cliente + 6 % do profissional», e essa é para ficar.
      "</strong> do profissional",
      "isento de IVA",
      "facturaDoPro",
      "facturaDaClyon",
      "a facturar ao profissional",
      "ivaDoServico",
      "na factura dele",
    ]) {
      expect(limpo).not.toContain(morto);
    }
  });

  it("e o que ficou é a soma, escrita com os sinais à vista", () => {
    const limpo = semNotas(PAINEL);
    expect(limpo).toContain("Trabalho ");
    expect(limpo).toContain("{\" + taxa \"}");
    expect(limpo).toContain("a pagar");
    expect(limpo).toContain("{\" · com factura, + IVA \"}");
    // A tabela de confirmar, linha a linha e pela mesma ordem.
    for (const rotulo of [
      '"O trabalho"',
      "`Taxa CLYON (${pct(taxas.cliente)})`",
      '"O cliente paga"',
      "`Se quiser factura — IVA (${pct(TAXA_IVA)})`",
      '"Com factura, paga"',
    ]) {
      expect(limpo).toContain(rotulo);
    }
  });

  it("e usa as taxas DESTA negociação, e já não as de hoje", () => {
    /*
     * A caixa de confirmar calculava com as taxas de hoje enquanto a linha
     * por cima dela usava as congeladas na negociação. Dois números para a
     * mesma pergunta, um em cima do outro.
     */
    const limpo = semNotas(PAINEL);
    expect(limpo).toContain("contaDoCliente(valorAcordado, taxas)");
    expect(limpo).toContain("quantoOProfissionalRecebe(valorAcordado, taxas)");
    expect(limpo).toContain("comissaoDaClyon(valorAcordado, taxas)");
    expect(limpo).toContain("taxas={taxasDaNegociacao(feito)}");
  });
});
