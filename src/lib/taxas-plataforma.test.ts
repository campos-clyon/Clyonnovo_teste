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
  ivaSobre,
  regimeDeIva,
} from "./taxas-plataforma";

describe("taxas da plataforma", () => {
  // O exemplo que está escrito na homepage e na página dos profissionais. Se
  // este teste falhar, o site passa a mostrar contas que não batem certo.
  it("sobre 200 € acordados: cliente paga 212, profissional recebe 190", () => {
    expect(servicoMaisTaxa(200)).toBe(212);
    expect(quantoOProfissionalRecebe(200)).toBe(190);
    expect(comissaoDaClyon(200)).toBe(22);
  });

  it("as percentagens são as decididas", () => {
    expect(TAXA_CLIENTE).toBe(0.06);
    expect(TAXA_PROFISSIONAL).toBe(0.05);
    expect(TAXA_TOTAL).toBeCloseTo(0.11, 10);
  });

  it("a CLYON fica com 11 % do acordado", () => {
    for (const v of [50, 100, 237.5, 1000]) {
      expect(comissaoDaClyon(v)).toBeCloseTo(v * 0.11, 2);
    }
  });

  it("arredonda aos cêntimos sem lixo de vírgula flutuante", () => {
    expect(servicoMaisTaxa(33.33)).toBe(35.33);
    expect(quantoOProfissionalRecebe(33.33)).toBe(31.66);
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
  it("350 € acordados com quem liquida IVA dão 80,50 € de imposto", () => {
    expect(ivaSobre(350, "normal")).toBe(80.5);
  });

  it("quem está na isenção do artigo 53.º não acrescenta nada", () => {
    // Mostrar 23% a quem contrata um isento é mostrar-lhe um imposto que não
    // deve — e que ninguém pode entregar ao Estado.
    expect(ivaSobre(350, "isento")).toBe(0);
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
  it("350 € acordados no regime normal dão 451,50 € a pagar", () => {
    // Serviço 350 + IVA 80,50 + taxa CLYON 21 = 451,50.
    const c = contaDoCliente(350, "normal");
    expect(c.servico).toBe(350);
    expect(c.iva).toBe(80.5);
    expect(c.taxa).toBe(21);
    expect(c.total).toBe(451.5);
    expect(c.temIva).toBe(true);
  });

  it("os mesmos 350 € com um isento dão 371,00 €", () => {
    const c = contaDoCliente(350, "isento");
    expect(c.iva).toBe(0);
    expect(c.total).toBe(371);
    expect(c.temIva).toBe(false);
  });

  it("as três parcelas somam sempre o total, sem cêntimos a sobrar", () => {
    for (const v of [5, 33.33, 99.99, 100, 237.5, 1000, 12345.67]) {
      for (const r of ["isento", "normal"] as const) {
        const c = contaDoCliente(v, r);
        expect(Number((c.servico + c.iva + c.taxa).toFixed(2))).toBe(c.total);
      }
    }
  });

  it("o total é sempre MAIOR do que o valor acordado — nunca menor", () => {
    // É o sentido da mudança: o acordado é a base, e tudo o resto acresce.
    for (const v of [10, 350, 5000]) {
      expect(contaDoCliente(v, "normal").total).toBeGreaterThan(v);
      expect(contaDoCliente(v, "isento").total).toBeGreaterThan(v);
    }
  });

  it("zero continua zero", () => {
    expect(contaDoCliente(0, "normal").total).toBe(0);
  });
});
