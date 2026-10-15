import { describe, it, expect } from "vitest";
import { contasDoTrabalhoClyon, EMPRESA_PARCEIRA } from "./contas-do-trabalho-clyon";
import { precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { TAXAS_DO_TRABALHO_CLYON } from "./oferta-clyon";

/**
 * PARA ONDE VAI O DINHEIRO DE UM TRABALHO CLYON — 15-10-2026.
 *
 * *«Esses cálculos não fazem sentido.»* — e a seguir: *«Deixe aqui quanto foi
 * pago pelo cliente, quanto vamos passar à empresa parceira e quanto a CLYON
 * fica.»* O cartão do #437 dizia «o pro recebe 104 €» e «fica para a CLYON
 * 26 €», e o botão da proposta dizia 159,90 €: faltava à vista o IVA, que passa
 * para a empresa parceira que emite a factura. Os números são os dos três
 * cartões da captura.
 */

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe("os três cartões da captura", () => {
  it("#437 — 130 € sem IVA a 20 %: o cliente paga 159,90 = 29,90 de IVA + 104 ao pro + 26 à CLYON", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 130, taxa: 0.2, precoAoCliente: 130 })).toEqual({
      cliente: 159.9,
      semIva: 130,
      parceira: 29.9,
      profissional: 104,
      clyon: 26,
    });
  });

  it("#428 — 100 € a 15 %: 123 = 23 + 85 + 15", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 100, taxa: 0.15, precoAoCliente: 100 })).toEqual({
      cliente: 123,
      semIva: 100,
      parceira: 23,
      profissional: 85,
      clyon: 15,
    });
  });

  it("#417, antigo — 250 € ao pro e 273 € sem IVA ao cliente: 335,79 = 62,79 + 250 + 23", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: 273 })).toEqual({
      cliente: 335.79,
      semIva: 273,
      parceira: 62.79,
      profissional: 250,
      clyon: 23,
    });
  });
});

describe("as contas", () => {
  it("as partes somam sempre o que o cliente paga, ao cêntimo", () => {
    for (let valor = 10; valor <= 2500; valor += 7.37) {
      const v = aosCentimos(valor);
      for (const taxa of TAXAS_DO_TRABALHO_CLYON) {
        const c = contasDoTrabalhoClyon({ valorFixo: v, taxa, precoAoCliente: v })!;
        expect(aosCentimos(c.parceira + c.profissional + c.clyon), `${v} a ${taxa}`).toBe(c.cliente);
        expect(aosCentimos(c.profissional + c.clyon), `${v} a ${taxa}`).toBe(c.semIva);
      }
    }
  });

  it("o que o cliente paga é o número do botão «Enviar proposta ao cliente»", () => {
    for (const t of [
      { valorFixo: 130, taxa: 0.2, precoAoCliente: 130 },
      { valorFixo: 250, taxa: null, precoAoCliente: 273 },
      { valorFixo: 333.33, taxa: 0.1, precoAoCliente: 333.33 },
    ]) {
      expect(contasDoTrabalhoClyon(t)!.cliente).toBe(precoDaPropostaClyon(t)!.total);
      expect(contasDoTrabalhoClyon(t)!.parceira).toBe(precoDaPropostaClyon(t)!.iva);
    }
  });

  it("um antigo sem preço ao cliente não tem conta — não se inventa", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: null })).toBeNull();
  });

  it("um antigo com o preço abaixo do que o pro recebe mostra a CLYON a perder, e não esconde", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: 240 })!.clyon).toBe(-10);
  });

  it("a empresa parceira é a que emite a factura", () => {
    expect(EMPRESA_PARCEIRA).toBe("Miragem Dourada");
  });
});
