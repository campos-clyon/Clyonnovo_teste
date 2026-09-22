import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contaDoCliente, servicoMaisTaxa } from "./taxas-plataforma";

/**
 * OS VALORES APRESENTAM-SE SEM IVA — EM TODO O LADO ONDE O CLIENTE OLHA.
 *
 * "Os clientes estão a reclamar que recebem muitas informações e que ficam
 * confusos com tudo isso. Esse cliente, por exemplo, não queria factura mas
 * não apresentámos o valor sem factura; isso deixou-o confuso, e ao final ele
 * pagou apenas 280 e não os 294 com a nossa taxa."
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
 *
 * O caso custou 14 €, e ia repetir-se: o cliente lia uma conta com quatro
 * linhas — serviço, IVA, taxa, total — e o número que lhe ficava era o do
 * profissional, porque era o único que ele reconhecia. Quatro linhas não são
 * mais transparência do que duas: são mais sítios onde se perder.
 *
 * A CONTA MUDOU DEPOIS, a 22-09-2026: o imposto era calculado por vendedor,
 * por causa da isenção do artigo 53.º, e passou a ser 23 % sobre tudo quando a
 * CLYON assumiu as facturas. O que este ficheiro guarda é anterior a isso e
 * sobreviveu-lhe: qual dos números da conta é que se MOSTRA.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/*
 * O código sem comentários.
 *
 * Um teste que procura texto no ficheiro encontra-o dentro dos comentários —
 * incluindo dentro DESTE comentário, se ele citar a frase que está a proibir.
 * Fica sempre verde e nunca guarda nada.
 */
const soCodigo = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("o número que o cliente vê é serviço mais taxa, sem imposto", () => {
  it("o caso que deu origem a isto: 280 € do profissional são 294 € a pagar", () => {
    // Foi este o engano. Ele pagou 280 e ficaram 14 por pagar.
    expect(contaDoCliente(280).semIva).toBe(294);
  });

  it("é serviço mais taxa, e mais nada", () => {
    /*
     * É o único número que se pode dizer antes de se saber com quem ele vai
     * ficar, e o único que não muda debaixo dos pés de quem já o leu.
     *
     * Até 22-09-2026 havia aqui uma segunda razão: o TOTAL mudava com o
     * regime do profissional e este não. Essa razão desapareceu — quem
     * factura é a CLYON e o total é o mesmo para toda a gente — mas o número
     * continua a ser o que se mostra.
     */
    for (const v of [0, 1, 33.33, 280, 1999.99]) {
      expect(contaDoCliente(v).semIva).toBe(servicoMaisTaxa(v));
    }
  });

  it("e o imposto continua lá, inteiro, para quem quiser factura", () => {
    /*
     * Apresentar sem IVA não é deixar de o calcular. Se esta conta deixar de
     * fechar, alguém tratou o imposto como opcional na aritmética — e não é:
     * é opcional na APRESENTAÇÃO, e só isso.
     */
    for (const v of [84, 280, 300, 330]) {
      const c = contaDoCliente(v);
      expect(Number((c.semIva + c.iva).toFixed(2))).toBe(c.total);
    }
  });
});

describe("os ecrãs do cliente mostram esse número", () => {
  it("a conta do trabalho fechado tem duas linhas e um total sem IVA", () => {
    const ECRA = soCodigo(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("{euros(conta.semIva)}");
    // A linha de IVA saiu da tabela: passou para a nota de baixo, onde diz o
    // que acresce A QUEM QUISER FACTURA em vez de aparecer como se fosse
    // devida por toda a gente.
    expect(ECRA).not.toContain("IVA ({Math.round(TAXA_IVA * 100)}%)");
    expect(ECRA).toContain("Valores sem IVA.");
  });

  it("o cartão da proposta, antes de contratar, diz o mesmo número", () => {
    // É onde ele decide. Um número aqui e outro depois do clique é a definição
    // de má surpresa, e a lei portuguesa (DL 138/90) manda mostrar ao
    // consumidor o preço final antes de ele se comprometer.
    const ECRA = soCodigo(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("taxasDaNegociacao(n)).semIva)} a pagar");
  });

  it("a lista de pedidos da conta dele também", () => {
    const CONTA = soCodigo(ler("src/app/conta/components/types.ts"));
    expect(CONTA).toContain(".semIva");
    expect(CONTA).not.toContain("taxasDaNegociacao(fechada)).total");
  });

  it("e a carteira, que é o mesmo dinheiro contado outra vez", () => {
    // A carteira a dizer 361,20 € sobre um trabalho anunciado a 294,00 € era
    // a terceira versão do mesmo preço — e a que ninguém tinha visto antes.
    const CARTEIRA = soCodigo(ler("src/lib/carteira-do-cliente.ts"));
    expect(CARTEIRA).toContain("contaDoCliente(acordado).semIva");
  });
});

describe("o backoffice continua a ver a conta inteira", () => {
  it("quem passa as facturas precisa do total, e continua a tê-lo", () => {
    /*
     * Apresentar sem IVA é uma regra da FRENTE. O painel do administrador vê
     * a conta inteira — o que o cliente paga, o que o profissional recebe e o
     * que fica para a casa — porque é dali que sai a factura e o dinheiro de
     * cada um.
     */
    const PAINEL = soCodigo(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(PAINEL).toContain("contaDoCliente(valorAcordado, taxas)");
    const CARTEIRAS = soCodigo(ler("src/app/api/admin/carteiras/route.ts"));
    expect(CARTEIRAS).toContain("taxas).total");
  });
});
