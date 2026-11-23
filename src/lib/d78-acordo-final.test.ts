import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comAcordoFinal, lerAcordoFinal, lerPedidoDeAcordoFinal, porqueNaoHaAcordo, type TrabalhoParaOAcordo } from "./acordo-final";
import { contaDaLinha, contaFecha } from "./conta-do-pagamento";
import { dividirEntrada } from "./financas-do-mes";
import { contaDoValorFinal } from "./valor-final-ao-cliente";
import { quantoSePedeNesteTrabalho } from "./eupago";
import type { Pagamento } from "./pagamentos-na-base";

/**
 * d78 (CEO e dono, 20-11-2026) — O ACORDO FINAL ABAIXO DO PAGO AO PROFISSIONAL.
 * Um Trabalho CLYON sem fatura, já pago ao profissional (500,00 €), em que o
 * cliente fica a pagar 400,00 € por acordo: a taxa a zero, o profissional não
 * deve nada, e o resultado da CLYON é −100,00 €. Números de exemplo.
 */

const linhaDoTrabalho = (p: Record<string, unknown> = {}) => ({
  valorAcordado: "500",
  taxaCliente: "0",
  taxaProfissional: "0",
  formaDePagamento: "na_plataforma",
  semFactura: 1,
  ofertaClyon: "fixo",
  valorFixoClyon: "500",
  taxaClyon: "0",
  precoClienteClyon: "500",
  negociacaoCriadaEm: "2026-11-10T10:00:00Z",
  ...p,
});

describe("a conta em degraus com o acordo final", () => {
  it("o cliente paga o acordo, o profissional o que recebeu, a CLYON fica com −100", () => {
    const c = contaDaLinha(linhaDoTrabalho({ acordoFinalCliente: "400", acordoFinalMotivo: "acordo final com o cliente" }), false);
    expect(c).not.toBeNull();
    expect(c!.total).toBe(400);
    expect(c!.iva).toBe(0);
    expect(c!.profissional).toBe(500);
    expect(c!.clyon).toBe(-100);
    expect(contaFecha(c!)).toBe(true);
    expect(c!.degraus.some((d) => d.tipo === "mais" && d.valor === 100)).toBe(true);
  });

  it("sem acordo, a conta de sempre", () => {
    const c = contaDaLinha(linhaDoTrabalho(), false);
    expect(c!.total).toBe(500);
    expect(c!.clyon).toBe(0);
    expect(c!.profissional).toBe(500);
  });

  it("um acordo que não fica abaixo não muda nada", () => {
    const base = contaDaLinha(linhaDoTrabalho(), false)!;
    expect(comAcordoFinal(base, 500)).toBe(base);
    expect(comAcordoFinal(base, 500)).toBe(base);
  });

  it("lê o valor gravado, e só um valor que serve", () => {
    expect(lerAcordoFinal({ acordoFinalCliente: "400" })).toBe(400);
    expect(lerAcordoFinal({ acordoFinalCliente: null })).toBeNull();
    expect(lerAcordoFinal({ acordoFinalCliente: "0" })).toBeNull();
    expect(lerAcordoFinal({})).toBeNull();
  });
});

describe("as Finanças contam o negativo", () => {
  it("o pagamento de 400,00 € entra com a parte do profissional inteira: a receita do pedido é −100", () => {
    const conta = contaDaLinha(linhaDoTrabalho({ acordoFinalCliente: "400" }), true)!;
    const e = dividirEntrada({
      id: 1,
      pedidoId: 1,
      dia: "2026-11-25",
      metodo: "multibanco",
      valor: 400,
      formaDoTrabalho: "na_plataforma",
      trid: null,
      parte: "trabalho",
      comissaoEupago: null,
      conta,
    });
    expect(e.iva).toBe(0);
    expect(e.profissional).toBe(500);
    expect(e.receita).toBe(-100);
  });
});

describe("o valor final ao cliente e o «Gerar referência» pedem o acordo", () => {
  const trabalho = {
    acordado: 500,
    taxas: { cliente: 0, profissional: 0 },
    modelo: "iva_incluido" as const,
    acrescimo: 0,
    formaDePagamento: "na_plataforma" as const,
    novoModelo: false,
    porHora: { horasConfirmadas: true, valorFinal: 500 },
    reservaCent: 0,
    semFactura: true,
    acordoFinal: 400,
  };
  const anulado = { id: 9001, estado: "cancelado", metodo: "ao_profissional", parte: "trabalho", valor: 400 } as unknown as Pagamento;

  it("o «Enviar o valor final» dá 400,00 € sem fatura", () => {
    const r = contaDoValorFinal(trabalho, [anulado], "normal");
    expect(r.ok).toBe(true);
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("devia ser referência");
    expect(r.conta.aPedir).toBe(400);
    expect(r.conta.total).toBe(400);
    expect(r.conta.iva).toBe(0);
    expect(r.conta.comFactura).toBe(false);
  });

  it("o «Gerar referência» pede o mesmo, com ou sem fatura pedida", () => {
    expect(quantoSePedeNesteTrabalho(trabalho, false)).toEqual({ valor: 400, quemPaga: "cliente" });
    expect(quantoSePedeNesteTrabalho(trabalho, true)).toEqual({ valor: 400, quemPaga: "cliente" });
  });

  it("sem acordo, como antes", () => {
    const r = contaDoValorFinal({ ...trabalho, acordoFinal: null }, [], "normal");
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("devia ser referência");
    expect(r.conta.aPedir).toBe(500);
  });
});

describe("a regra do acordo", () => {
  const t = (p: Partial<TrabalhoParaOAcordo> = {}): TrabalhoParaOAcordo => ({
    estado: "acordada",
    formaDePagamento: "na_plataforma",
    semFactura: true,
    novoModelo: false,
    pagoAoProfissional: true,
    profissionalRecebeSemTaxa: 500,
    pagoDoCliente: { id: 9001, metodo: "ao_profissional" },
    partesPagas: 0,
    dividaFechada: false,
    ...p,
  });
  const pedido = { negociacaoId: 1, valor: 400, motivo: "acordo final com o cliente", anularPagoEmMao: true };

  it("o caso do pedido passa", () => {
    expect(porqueNaoHaAcordo(t(), pedido)).toBeNull();
    expect(porqueNaoHaAcordo(t({ pagoDoCliente: null }), pedido)).toBeNull();
  });

  it("e recusa o resto", () => {
    expect(porqueNaoHaAcordo(t({ estado: "cancelada" }), pedido)).toBe("nao_fechado");
    expect(porqueNaoHaAcordo(t({ formaDePagamento: "dinheiro" }), pedido)).toBe("dinheiro");
    expect(porqueNaoHaAcordo(t({ novoModelo: true }), pedido)).toBe("novo_modelo");
    expect(porqueNaoHaAcordo(t({ semFactura: false }), pedido)).toBe("com_fatura");
    expect(porqueNaoHaAcordo(t({ pagoAoProfissional: false }), pedido)).toBe("nao_pago_ao_profissional");
    expect(porqueNaoHaAcordo(t(), { ...pedido, valor: 500 })).toBe("nao_abaixo");
    expect(porqueNaoHaAcordo(t({ pagoDoCliente: { id: 9, metodo: "multibanco" } }), pedido)).toBe("cliente_pagou");
    expect(porqueNaoHaAcordo(t(), { ...pedido, anularPagoEmMao: false })).toBe("em_mao_sem_anular");
    expect(porqueNaoHaAcordo(t({ partesPagas: 1 }), pedido)).toBe("divida_paga");
    expect(porqueNaoHaAcordo(t({ dividaFechada: true }), pedido)).toBe("divida_paga");
  });

  it("o motivo é obrigatório", () => {
    expect(lerPedidoDeAcordoFinal({ negociacaoId: 1, valor: 400 }).ok).toBe(false);
    expect(lerPedidoDeAcordoFinal({ negociacaoId: 1, valor: 400, motivo: " " }).ok).toBe(false);
    const ok = lerPedidoDeAcordoFinal({ negociacaoId: 1, valor: "400,00", motivo: "acordo final com o cliente", anularPagoEmMao: true });
    expect(ok).toEqual({ ok: true, pedido: { negociacaoId: 1, valor: 400, motivo: "acordo final com o cliente", anularPagoEmMao: true } });
  });
});

describe("a rota: só o administrador, nada se apaga, nada se envia", () => {
  const ROTA = readFileSync(join(__dirname, "../app/api/admin/pagamentos/acordo-final/route.ts"), "utf8");
  const BASE = readFileSync(join(__dirname, "acordo-final-na-base.ts"), "utf8");
  const ACESSO = readFileSync(join(__dirname, "acesso-ao-pagamento.ts"), "utf8");

  it("só o administrador geral, com histórico e registo permanente", () => {
    expect(ROTA).toContain("await requireAdminGeral(req)");
    expect(ROTA).toContain("appendOrderHistory(");
    expect(ROTA).toContain('acontecimento: "pagamento_corrigido"');
  });

  it("não envia, não gera referências, não paga", () => {
    for (const proibido of ["enviarWhatsApp", "gerarReferenciaDaDivida", "pedirPagamento", "abrirPagamento", "fecharSePagoDosDoisLados", "avisar"]) {
      expect(ROTA).not.toContain(proibido);
      expect(BASE).not.toContain(proibido);
    }
  });

  it("nada se apaga: as linhas ficam canceladas, com o motivo", () => {
    expect(BASE).not.toMatch(/DELETE\s+FROM/i);
    expect(BASE).toContain("SET estado = 'cancelado', negociacaoPaga = NULL, erro = ?");
    expect(BASE).toContain("AND metodo = 'ao_profissional'");
  });

  it("o cliente não paga pelo link um trabalho com acordo — paga a referência que a CLYON envia", () => {
    expect(ACESSO).toContain("credencial.backoffice !== true && credencial.soParaVer !== true && acordoFinal != null");
  });
});
