import { describe, it, expect } from "vitest";
import {
  servicoMaisTaxa,
  contaDoCliente,
  quantoOProfissionalRecebe,
  comissaoDaClyon,
  TAXA_CLIENTE,
  TAXA_PROFISSIONAL,
  TAXA_TOTAL,
  TAXA_IVA,
  regimeDeIva,
} from "./taxas-plataforma";

describe("taxas da plataforma", () => {
  // O exemplo que está escrito na página dos profissionais. Se este teste
  // falhar, o site passa a mostrar contas que não batem certo.
  it("sobre 200 € acordados: cliente paga 210, profissional recebe 188", () => {
    expect(servicoMaisTaxa(200)).toBe(210);
    expect(quantoOProfissionalRecebe(200)).toBe(188);
    expect(comissaoDaClyon(200)).toBe(22);
  });

  it("as percentagens são as decididas — 5 % ao cliente, 6 % ao profissional (07-09-2026)", () => {
    // Estavam ao contrário até 07-09-2026. "São 6% dos pros e 5% do cliente."
    expect(TAXA_CLIENTE).toBe(0.05);
    expect(TAXA_PROFISSIONAL).toBe(0.06);
    expect(TAXA_TOTAL).toBeCloseTo(0.11, 10);
  });

  it("a CLYON fica com 11 % do acordado", () => {
    for (const v of [50, 100, 237.5, 1000]) {
      expect(comissaoDaClyon(v)).toBeCloseTo(v * 0.11, 2);
    }
  });

  it("arredonda aos cêntimos sem lixo de vírgula flutuante", () => {
    // 33,33 × 1,05 = 34,9965 → 35,00; 33,33 × 0,94 = 31,3302 → 31,33.
    expect(servicoMaisTaxa(33.33)).toBe(35);
    expect(quantoOProfissionalRecebe(33.33)).toBe(31.33);
    expect(Number.isInteger(servicoMaisTaxa(10) * 100)).toBe(true);
  });

  it("o profissional recebe sempre menos do que o cliente paga", () => {
    for (const v of [1, 10, 99.99, 5000]) {
      expect(quantoOProfissionalRecebe(v)).toBeLessThan(servicoMaisTaxa(v));
    }
  });

  it("zero continua zero", () => {
    expect(servicoMaisTaxa(0)).toBe(0);
    expect(quantoOProfissionalRecebe(0)).toBe(0);
  });
});

describe("IVA — soma-se ao valor acordado, e não se decompõe dele", () => {
  /*
   * "Temos de deixar claro que todos os valores praticados são sem IVA,
   * principalmente para os clientes." — 29-08-2026.
   *
   * Era ao contrário: 350 € acordados decompunham-se em 284,55 + 65,45. Agora
   * 350 € são a base e o imposto acresce. A mudança sobe o que o cliente paga,
   * e foi pedida sabendo disso — por isso o número está escrito aqui, para
   * ninguém a desfazer por engano.
   */
  it("350 € mais a taxa dão 84,53 € de imposto, a quem quiser factura", () => {
    /*
     * Havia aqui um `ivaSobre(base, regime)` que devolvia zero para um
     * profissional na isenção do artigo 53.º. Foi apagado com o modelo que
     * servia: quem factura é uma empresa parceira, e não há base nenhuma isenta.
     */
    expect(contaDoCliente(350).iva).toBe(84.53);
    expect(contaDoCliente(350).semIva).toBe(367.5);
  });

  it("a taxa é a normal portuguesa", () => {
    expect(TAXA_IVA).toBe(0.23);
  });

  it("na dúvida, é isento — nunca se inventa um imposto", () => {
    // O que vier da base a null, vazio, ou escrito de outra maneira não pode
    // fazer aparecer 23% na conta de ninguém.
    for (const v of [null, undefined, "", "qualquer coisa", 0]) {
      expect(regimeDeIva(v)).toBe("isento");
    }
    expect(regimeDeIva("normal")).toBe("normal");
  });
});

describe("a conta do cliente", () => {
  it("valor do trabalho, mais taxa, mais IVA — por esta ordem", () => {
    /*
     * A CONTA INTEIRA, NA FORMA EM QUE O DONO A ESCREVEU — 22-09-2026.
     *
     * "Valor do trabalho mais taxa 5 % = X, mais IVA caso deseje 23 % = Y."
     *
     * 350 + 17,50 = 367,50 a pagar. Com factura, mais 84,53 de imposto:
     * 452,03.
     */
    const c = contaDoCliente(350);
    expect(c.servico).toBe(350);
    expect(c.taxa).toBe(17.5);
    expect(c.semIva).toBe(367.5);
    expect(c.iva).toBe(84.53);
    expect(c.total).toBe(452.03);
    expect(c.temIva).toBe(true);
  });

  it("o imposto é 23 % de TUDO — do trabalho e da taxa", () => {
    /*
     * "A CLYON vai emitir as facturas a partir de agora, então vamos ignorar
     * os pros: tudo deve ser a 23 % caso deseje factura." — 22-09-2026.
     *
     * Era calculado por vendedor, e com um profissional na isenção do artigo
     * 53.º o imposto do serviço era zero: 350 € davam 4,03 € de IVA e um
     * total de 371,53 €. Enquanto era ELE a facturar o serviço, estava certo.
     * Com uma factura só, o imposto é o de quem a emite.
     */
    for (const v of [10, 84, 350, 1000]) {
      const c = contaDoCliente(v);
      expect(c.iva).toBe(Number((c.semIva * TAXA_IVA).toFixed(2)));
    }
    // O caso que mudou: o que antes dava 371,53 € dá agora o mesmo que o
    // regime normal sempre deu.
    expect(contaDoCliente(350).total).toBe(452.03);
  });

  it("as três parcelas somam sempre o total, sem cêntimos a sobrar", () => {
    for (const v of [5, 33.33, 99.99, 100, 237.5, 1000, 12345.67]) {
      const c = contaDoCliente(v);
      expect(Number((c.servico + c.taxa + c.iva).toFixed(2))).toBe(c.total);
      expect(Number((c.semIva + c.iva).toFixed(2))).toBe(c.total);
    }
  });

  it("o total é sempre MAIOR do que o valor acordado — nunca menor", () => {
    // É o sentido da mudança: o acordado é a base, e tudo o resto acresce.
    for (const v of [10, 350, 5000]) {
      expect(contaDoCliente(v).total).toBeGreaterThan(v);
      expect(contaDoCliente(v).semIva).toBeGreaterThan(v);
    }
  });

  it("zero continua zero", () => {
    expect(contaDoCliente(0).total).toBe(0);
  });
});
