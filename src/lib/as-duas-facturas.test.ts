import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLYON_LIQUIDA_IVA,
  TAXA_CLIENTE,
  TAXA_IVA,
  contaDoCliente,
  regimeDeIva,
} from "./taxas-plataforma";

/**
 * O QUE O CLIENTE PAGA TEM DE CABER EM FACTURAS.
 *
 * "O cliente pagou 107,52 mas a factura é de apenas 103,32." — 14-09-2026,
 * sobre o pedido #315.
 *
 * Estava certo, e a diferença tinha nome: 4,20 € de taxa da CLYON que o
 * cliente pagava e que não apareciam em documento nenhum. Não era um erro de
 * arredondamento — era sistemático, em todos os trabalhos desde sempre, porque
 * a taxa era somada a seco, sem imposto e sem quem a facturasse.
 *
 * "A CLYON vai assumir as facturas, então vamos fazer valor mais taxa mais
 * IVA." São duas facturas, de duas empresas, e a soma delas é exactamente o
 * que sai da carteira do cliente. É isso que este ficheiro guarda.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

/** O que cada empresa emite, a partir da conta. */
function facturas(acordado: number, regime: "normal" | "isento") {
  const c = contaDoCliente(acordado, regime);
  return {
    doProfissional: Math.round((c.servico + c.ivaDoServico) * 100) / 100,
    daClyon: Math.round((c.taxa + c.ivaDaTaxa) * 100) / 100,
    total: c.total,
  };
}

describe("o caso do pedido #315, com os números dele", () => {
  const c = contaDoCliente(84, "normal");

  it("o serviço e o IVA do profissional são o que ele factura", () => {
    expect(c.servico).toBe(84);
    expect(c.ivaDoServico).toBe(19.32);
    expect(facturas(84, "normal").doProfissional).toBe(103.32);
  });

  it("a taxa e o IVA dela são o que a CLYON factura — e era isto que faltava", () => {
    // 4,20 de taxa + 0,97 de IVA. Antes, os 4,20 iam sozinhos e sem documento.
    expect(c.taxa).toBe(4.2);
    expect(c.ivaDaTaxa).toBe(0.97);
    expect(facturas(84, "normal").daClyon).toBe(5.17);
  });

  it("e as duas somam EXACTAMENTE o que o cliente paga", () => {
    /*
     * O teste que não existia. 103,32 + 4,20 dava 107,52 e faltava o imposto
     * da taxa; agora 103,32 + 5,17 = 108,49, e o cliente paga 108,49.
     */
    const f = facturas(84, "normal");
    expect(Number((f.doProfissional + f.daClyon).toFixed(2))).toBe(f.total);
    expect(f.total).toBe(108.49);
  });
});

describe("as duas facturas fecham sempre, em qualquer valor e regime", () => {
  it("nunca sobra nem falta um cêntimo", () => {
    for (const v of [5, 33.33, 84, 99.99, 100, 237.5, 350, 1000, 12345.67]) {
      for (const r of ["isento", "normal"] as const) {
        const f = facturas(v, r);
        expect(Number((f.doProfissional + f.daClyon).toFixed(2))).toBe(f.total);
      }
    }
  });
});

describe("o imposto calcula-se por vendedor — nunca sobre a soma", () => {
  it("com o profissional no regime normal, dá o mesmo dos dois modos", () => {
    /*
     * É por isto que a apresentação pode juntar as duas linhas de IVA numa só:
     * 23 % de (serviço + taxa) é igual a 23 % de cada um somados. Enquanto as
     * duas partes estiverem à mesma taxa.
     */
    const c = contaDoCliente(84, "normal");
    const sobreASoma = Math.round((c.servico + c.taxa) * TAXA_IVA * 100) / 100;
    expect(c.iva).toBe(sobreASoma);
  });

  it("com o profissional ISENTO, os dois modos separam-se — e é aí que importa", () => {
    /*
     * O TESTE QUE IMPEDE A SIMPLIFICAÇÃO ERRADA.
     *
     * Um profissional na isenção do artigo 53.º não liquida imposto nenhum.
     * Uma conta feita no fim sobre a soma dava-lhe 23 % sobre o serviço dele —
     * um imposto que ele não pode emitir e que ninguém pode entregar ao
     * Estado. O total certo tem SÓ o imposto da taxa.
     */
    const c = contaDoCliente(84, "isento");
    const sobreASoma = Math.round((c.servico + c.taxa) * TAXA_IVA * 100) / 100;
    expect(c.ivaDoServico).toBe(0);
    expect(c.ivaDaTaxa).toBe(0.97);
    expect(c.iva).toBe(0.97);
    expect(c.iva).not.toBe(sobreASoma);
    expect(c.total).toBe(89.17);
  });

  it("o isento continua a ficar mais barato para o cliente", () => {
    // A vantagem não desapareceu com a mudança: mudou de «sem imposto nenhum»
    // para «só o da taxa».
    expect(contaDoCliente(84, "isento").total).toBeLessThan(contaDoCliente(84, "normal").total);
  });
});

describe("as decisões ficam escritas onde se mudam", () => {
  it("o regime da CLYON é uma constante, e não um true escondido na conta", () => {
    // Muda com a empresa e não com o código; no dia em que mudar há um sítio
    // para o dizer.
    expect(CLYON_LIQUIDA_IVA).toBe(true);
    expect(TAXA_CLIENTE).toBe(0.05);
  });

  it("um regime por preencher conta como isento — e isso não mudou", () => {
    expect(regimeDeIva(null)).toBe("isento");
    expect(regimeDeIva("")).toBe("isento");
    expect(regimeDeIva("normal")).toBe("normal");
  });
});

describe("o painel diz quem factura o quê", () => {
  it("mostra as duas facturas com o número de cada uma", () => {
    /*
     * Era a pergunta que se fazia neste ecrã — «qual valor devo emitir?» — e
     * para a qual era preciso ir buscar uma calculadora.
     */
    expect(PAINEL).toContain("em duas facturas");
    expect(PAINEL).toContain("do profissional");
    expect(PAINEL).toContain("da CLYON");
    expect(PAINEL).toContain("facturaDoPro");
    expect(PAINEL).toContain("facturaDaClyon");
  });

  it("e diz que a comissão é facturada ao profissional", () => {
    // A terceira factura: a CLYON ao profissional, os 6 %.
    expect(PAINEL).toContain("a facturar ao profissional");
  });
});
