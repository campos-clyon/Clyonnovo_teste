import { describe, expect, it } from "vitest";
import {
  REFERENCIA_POR_GERAR,
  contaDoValorFinal,
  lerCanal,
  mensagemDoValorFinal,
  oQueMudouDaFolha,
} from "./valor-final-ao-cliente";
import { quantoOClientePaga } from "./eupago";
import { contaDoCliente } from "./taxas-plataforma";
import { totalAoCliente } from "./total-ao-cliente";
import { pagamentoForaDeVigor } from "./conferir-o-pagamento";
import type { Pagamento } from "./pagamentos-na-base";

/**
 * d38 v2, commit d (15-11-2026) — «ENVIAR O VALOR FINAL AO CLIENTE», em
 * simulação: a conta (a mesma do «Gerar referência», da diferença das horas e
 * do modelo de 15-11 com a reserva), as mensagens (com IVA e sem IVA ao lado,
 * «parceiro»), e a referência antiga fora de vigor no webhook.
 */

const T = { cliente: 0, profissional: 0.1 };
const trabalho = (p: Record<string, unknown> = {}) => ({
  acordado: 400,
  taxas: T,
  modelo: "iva_incluido" as const,
  acrescimo: 0,
  formaDePagamento: "na_plataforma" as const,
  novoModelo: false,
  porHora: null,
  reservaCent: 0,
  ...p,
});
let id = 0;
const linha = (p: Partial<Pagamento>): Pagamento =>
  ({
    id: ++id,
    negociacaoId: 70,
    pedidoId: 524,
    providerId: 3,
    metodo: "multibanco",
    estado: "pendente",
    ambiente: "sandbox",
    valor: 100,
    comFactura: true,
    deTeste: false,
    valorPago: null,
    parte: "trabalho",
    ...p,
  }) as Pagamento;

describe("a conta do valor final", () => {
  it("por receber, modelo do IVA incluído: o total da referência, com o sem IVA ao lado", () => {
    const r = contaDoValorFinal(trabalho(), [linha({ valor: 300 })], "normal");
    expect(r.ok).toBe(true);
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("modo");
    expect(r.conta.total).toBe(quantoOClientePaga(400, T, "iva_incluido", true, 0));
    expect(r.conta.semIva).toBe(contaDoCliente(400, T, 0).semIva);
    expect(r.conta.iva).toBeCloseTo(r.conta.total - r.conta.semIva, 2);
    expect(r.conta.aPedir).toBe(r.conta.total);
    expect(r.conta.parte).toBe("trabalho");
  });

  it("à hora, já paga a estimativa: pede-se só a diferença (acertoDasHoras)", () => {
    const final = quantoOClientePaga(400, T, "iva_incluido", true);
    const r = contaDoValorFinal(
      trabalho({ porHora: { horasConfirmadas: true, valorFinal: 400 } }),
      [linha({ estado: "pago", valor: 200, valorPago: 200 })],
      "normal",
    );
    if (!r.ok || r.conta.modo !== "referencia") throw new Error(String(!r.ok && r.porque));
    expect(r.conta.parte).toBe("diferenca");
    expect(r.conta.total).toBe(final);
    expect(r.conta.aPedir).toBe(Math.round((final - 200) * 100) / 100);
    expect(r.conta.pagoAteAgora).toBe(200);
  });

  it("já pago (e não à hora), pago a mais, ou em dinheiro: não se envia", () => {
    expect(contaDoValorFinal(trabalho(), [linha({ estado: "pago", valor: 492 })], "normal").ok).toBe(false);
    const aMais = contaDoValorFinal(
      trabalho({ porHora: { horasConfirmadas: true, valorFinal: 400 } }),
      [linha({ estado: "pago", valor: 900, valorPago: 900 })],
      "normal",
    );
    expect(aMais.ok).toBe(false);
    if (!aMais.ok) expect(aMais.porque).toMatch(/devolver/);
    expect(contaDoValorFinal(trabalho({ formaDePagamento: "dinheiro" }), [], "normal").ok).toBe(false);
  });

  it("modelo de 15-11: as duas faturas, a da CLYON com a reserva do valor único", () => {
    const r = contaDoValorFinal(trabalho({ novoModelo: true, reservaCent: 1500 }), [], "isento");
    if (!r.ok || r.conta.modo !== "parceiro") throw new Error("modo");
    const c = totalAoCliente(400, T, "isento", 1500)!;
    expect(r.conta.total).toBe(c.total);
    expect(r.conta.faturaDaClyon).toBe(c.faturaDaTaxa);
    expect(r.conta.faturaDaClyon).toBeGreaterThan(totalAoCliente(400, T, "isento", 0)!.faturaDaTaxa);
    expect(r.conta.faturaDoParceiro + r.conta.faturaDaClyon).toBeCloseTo(r.conta.total, 2);
    // Com a parte da CLYON paga pelo parceiro, o cliente já pagou.
    expect(contaDoValorFinal(trabalho({ novoModelo: true }), [linha({ estado: "pago" })], "normal").ok).toBe(false);
  });
});

describe("as mensagens", () => {
  const agora = new Date("2026-11-15T15:00:00Z");
  const conta = (() => {
    const r = contaDoValorFinal(trabalho(), [], "normal");
    if (!r.ok) throw new Error("conta");
    return r.conta;
  })();

  it("pré-visualização: o marcador da referência, com IVA e sem IVA, sem «profissional»", () => {
    const m = mensagemDoValorFinal({ pedidoId: 524, cliente: "Ana Teste", conta, mbway: true }, agora);
    expect(m).toContain(REFERENCIA_POR_GERAR);
    expect(m).toMatch(/com IVA \(\d+,\d{2} € sem IVA\)/);
    expect(m).toContain("MB WAY");
    expect(m).toContain("parceiro");
    expect(m.toLowerCase()).not.toContain("profissional");
    expect(m).not.toMatch(/próprio dia/i);
  });

  it("ao enviar: a Multibanco gerada, e o que mudou só se a equipa o juntar", () => {
    const sem = mensagemDoValorFinal({ pedidoId: 524, cliente: null, conta, multibanco: { entidade: "11111", referencia: "000 000 000" }, mbway: false }, agora);
    expect(sem).toContain("Entidade 11111, Referência 000 000 000");
    expect(sem).not.toContain("MB WAY");
    const explica = oQueMudouDaFolha({ pessoas: 3, horas: 6.5, deslocacao: { tipo: "km", km: 40 }, materiais: [{ descricao: "20 caixas", cent: 4000 }] });
    expect(explica).toContain("6,5 h");
    expect(explica).toContain("20 caixas");
    const com = mensagemDoValorFinal({ pedidoId: 524, cliente: null, conta, oQueMudou: explica }, agora);
    expect(com).toContain(explica);
  });

  it("modelo de 15-11: os dados do parceiro e as duas faturas", () => {
    const r = contaDoValorFinal(trabalho({ novoModelo: true }), [], "normal");
    if (!r.ok) throw new Error("conta");
    const m = mensagemDoValorFinal(
      {
        pedidoId: 524,
        cliente: null,
        conta: r.conta,
        parceiro: {
          nome: "Mudanças Exemplo",
          iban: "PT50 0000 0000 0000 0000 0000 0",
          titular: "Exemplo Lda",
          mbway: null,
          faturas: { doTrabalho: "https://exemplo.test/f1.pdf", daTaxa: null },
        },
      },
      agora,
    );
    expect(m).toContain("Paga diretamente ao parceiro Mudanças Exemplo");
    expect(m).toContain("Fatura do trabalho, passada pelo parceiro");
    expect(m).toContain("Fatura da taxa da plataforma, passada pela CLYON");
    expect(m).toContain("IBAN PT50");
    expect(m).toContain("https://exemplo.test/f1.pdf");
    expect(m).not.toContain(REFERENCIA_POR_GERAR);
  });

  it("canal só WhatsApp, email ou os dois", () => {
    expect(lerCanal("ambos")).toBe("ambos");
    expect(lerCanal("sms")).toBeNull();
  });
});

describe("o webhook: a referência antiga não fecha o pedido", () => {
  it("paga a antiga depois de gerada a do valor final: fora de vigor, para devolver", () => {
    const antiga = { id: 1, metodo: "multibanco", estado: "cancelado", valor: 300, erro: "Substituída pelo valor final enviado ao cliente." };
    const nova = { id: 2, metodo: "multibanco", estado: "pendente", valor: 492, erro: null };
    expect(pagamentoForaDeVigor(antiga as never, [antiga, nova] as never)).toMatch(/devolver/);
    expect(pagamentoForaDeVigor(nova as never, [antiga, nova] as never)).toBeNull();
  });
});
