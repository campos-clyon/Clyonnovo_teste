import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aPagarAClyonDe,
  carteiraDe,
  dividasDe,
  foiPagoEmMao,
  levantavelDe,
  planoDeAbatimento,
  recusaDoLevantamento,
  type TrabalhoNaCarteira,
} from "./carteira";
import { contaDaCarteira, RAZOES, type TrabalhoParaALista } from "./trabalhos-da-carteira";
import { camposDoPagamento } from "./carteira-do-profissional";
import { pagouAoProfissional } from "./dinheiro-do-trabalho";
import { bloqueioEmDinheiro } from "./bloqueio-por-divida";
import { dividaDoRegistoEmMao, foiPagoEmMaoPor } from "./pago-em-mao";
import { afectadosPeloPagoEmMao } from "./pagos-em-mao-afectados";

/*
 * PAGO EM MÃO — 01-11-2026 (urgência, com o ok do dono). Valores inventados:
 * o repositório é público. Os dois casos que o dono viu:
 *
 *   · COM FACTURA, 10 % — 150 € sem IVA, ele recebe 135 €, taxa 15 €;
 *   · SEM FACTURA, 11 % — 80 €, ele recebe 71,20 €, taxa 8,80 €.
 *
 * Os dois combinados pela plataforma e registados nos Pagamentos como «o
 * cliente pagou ao profissional, em mão». Nunca «Por receber», nunca
 * transferíveis; a taxa fica a dever-se e desconta-se do resto.
 */

const NOVO = "2026-10-20T10:00:00Z";
const agora = new Date("2026-11-01T12:00:00Z");

function t(id: number, valor: number, taxa: number, extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoParaALista {
  return {
    negociacaoId: id,
    pedidoId: 900 + id,
    servico: "Recolha de móveis",
    cliente: "Ana",
    estado: "acordada",
    valorAcordado: valor,
    taxaProfissional: taxa,
    taxaCliente: 0,
    formaDePagamento: null,
    execucaoEnviadaEm: "2026-10-25T10:00:00Z",
    confirmadoEm: "2026-10-25T12:00:00Z",
    pagoEm: null,
    clientePagouEm: "2026-10-26T10:00:00Z",
    negociacaoCriadaEm: NOVO,
    ...extra,
  } as TrabalhoParaALista;
}

const emMao = { comoEntrou: "ao_profissional" };
const comFactura = t(1, 150, 0.1, { ...emMao, valorQueEntrou: 150 });
const semFactura = t(2, 80, 0.11, { ...emMao, valorQueEntrou: 80 });

describe("a regra única: pago em mão por qualquer dos dois caminhos", () => {
  it("a carteira e os Pagamentos respondem o mesmo", () => {
    for (const [forma, como, sim] of [
      ["dinheiro", null, true],
      [null, "ao_profissional", true],
      ["plataforma", "ao_profissional", true],
      [null, "multibanco", false],
      [null, "transferencia", false],
      [null, null, false],
    ] as const) {
      expect(foiPagoEmMaoPor(forma, como)).toBe(sim);
      expect(foiPagoEmMao({ formaDePagamento: forma, comoEntrou: como })).toBe(sim);
      expect(pagouAoProfissional({ formaDePagamento: forma, comoEntrou: como })).toBe(sim);
    }
  });
});

describe("os dois casos do dono: recebidos em mão, nunca «Por receber»", () => {
  const trabalhos = [comFactura, semFactura];
  const k = carteiraDe(trabalhos, [], agora);
  const { linhas, resumo } = contaDaCarteira(trabalhos, [], agora);

  it("ficam em «Recebido em mão» e não em disponível", () => {
    expect(k.disponivel).toBe(0);
    expect(k.porCobrar).toBe(0);
    expect(k.cativo).toBe(0);
    expect(k.recebidoEmMao).toBe(206.2);
    expect(resumo.porReceber).toBe(0);
    expect(resumo.podePedir).toBe(0);
    expect(resumo.recebidoEmMao).toBe(206.2);
  });

  it("cada trabalho na lista como recebido em mão", () => {
    expect(linhas.filter((l) => l.grupo === "por_receber")).toHaveLength(0);
    for (const l of linhas) {
      expect(l.grupo).toBe("recebido");
      expect(l.razao).toBe(RAZOES.emMao);
      expect(l.falta).toBe(0);
    }
    expect(linhas.find((l) => l.negociacaoId === 1)?.recebe).toBe(135);
    expect(linhas.find((l) => l.negociacaoId === 2)?.recebe).toBe(71.2);
  });

  it("a taxa fica a dever-se à CLYON: 15,00 € e 8,80 €", () => {
    const d = dividasDe(trabalhos, agora);
    // À parte (a negociação já está paga pelo registo), e desde 04-11-2026 (d9) com referência.
    expect(d.map((x) => [x.negociacaoId, x.total, x.comissao, x.iva, x.aParte, x.descontaNoSaldo ?? false])).toEqual([
      [1, 15, 15, 0, true, false],
      [2, 8.8, 8.8, 0, true, false],
    ]);
    expect(aPagarAClyonDe(trabalhos, agora)).toBe(23.8);
  });

  it("o servidor recusa transferi-los", () => {
    expect(recusaDoLevantamento(206.2, k, true, false, aPagarAClyonDe(trabalhos, agora))).toBe("pago_em_mao");
    expect(recusaDoLevantamento(10, k, true, false, aPagarAClyonDe(trabalhos, agora))).toBe("pago_em_mao");
  });

  it("desde 04-11-2026 (d9) pagam-se por referência e contam para os 7 dias, como as do dinheiro", () => {
    // Feitos a 25/10: dentro do prazo a 01/11, em atraso a 01/12.
    expect(bloqueioEmDinheiro(trabalhos, agora).bloqueado).toBe(false);
    const longe = new Date("2026-12-01T12:00:00Z");
    expect(bloqueioEmDinheiro(trabalhos, longe).bloqueado).toBe(true);
    expect(bloqueioEmDinheiro(trabalhos, longe).total).toBe(23.8);
  });
});

describe("com factura e o IVA pago em mão, o IVA também é da CLYON", () => {
  it("150 € + 23 % = 184,50 € recebidos: deve 34,50 € de IVA + 15,00 € de taxa", () => {
    const d = dividaDoRegistoEmMao(150, { cliente: 0, profissional: 0.1 } as never, 184.5);
    expect(d).toMatchObject({ recebidoDoCliente: 184.5, liquido: 135, iva: 34.5, comissao: 15, total: 49.5 });
  });
  it("sem o valor registado, só a taxa — nunca mais do que se sabe", () => {
    expect(dividaDoRegistoEmMao(80, { cliente: 0, profissional: 0.11 } as never, null).total).toBe(8.8);
    expect(dividaDoRegistoEmMao(80, { cliente: 0, profissional: 0.11 } as never, 0).total).toBe(8.8);
  });
});

describe("«Pode pedir já» desconta a dívida", () => {
  const outro = t(3, 300, 0.1); // 270 € pela plataforma, pago à CLYON e confirmado
  const trabalhos = [comFactura, semFactura, outro];
  const k = carteiraDe(trabalhos, [], agora);
  const deve = aPagarAClyonDe(trabalhos, agora);

  it("disponível 270, deve 23,80, pode pedir 246,20", () => {
    expect(k.disponivel).toBe(270);
    expect(deve).toBe(23.8);
    expect(levantavelDe(k, deve)).toBe(246.2);
    expect(recusaDoLevantamento(270, k, true, false, deve)).toBe("divida_em_aberto");
    expect(recusaDoLevantamento(246.2, k, true, false, deve)).toBeNull();
  });

  it("a lista põe só o trabalho da plataforma em «Por receber»", () => {
    const { linhas, resumo } = contaDaCarteira(trabalhos, [], agora);
    expect(linhas.filter((l) => l.grupo === "por_receber").map((l) => l.negociacaoId)).toEqual([3]);
    expect(resumo.podePedir).toBe(270);
  });

  it("depois de transferidos 246,20, as duas taxas abatem-se com o que sobra", () => {
    const k2 = carteiraDe(trabalhos, [{ id: 1, valor: 246.2, estado: "pago" }], agora);
    const plano = planoDeAbatimento(dividasDe(trabalhos, agora), k2.disponivel);
    expect(plano.totalAbatido).toBe(23.8);
    expect(plano.sobra).toBe(0);
  });

  it("abatida, a taxa sai do disponível e deixa de se dever", () => {
    const abatidos = [
      { ...comFactura, dividaAbatida: { valor: 15, em: "2026-11-01T10:00:00Z", levantamentoId: 1 } },
      { ...semFactura, dividaAbatida: { valor: 8.8, em: "2026-11-01T10:00:00Z", levantamentoId: 1 } },
      outro,
    ];
    const k3 = carteiraDe(abatidos, [{ id: 1, valor: 246.2, estado: "pago" }], agora);
    expect(k3.disponivel).toBe(0);
    expect(aPagarAClyonDe(abatidos, agora)).toBe(0);
  });
});

describe("a leitura da base: o método do pagamento chega à carteira", () => {
  const pagos = new Map([
    [1, { pagoEm: new Date("2026-10-26T10:00:00Z"), metodo: "ao_profissional", valor: 150, levantamentoId: null }],
    [
      2,
      {
        pagoEm: new Date("2026-10-26T10:00:00Z"),
        metodo: "ao_profissional",
        valor: 80,
        levantamentoId: null,
        abatimentoAParte: { valor: 8.8, em: new Date("2026-11-01T10:00:00Z"), levantamentoId: 7 },
      },
    ],
    [3, { pagoEm: new Date("2026-10-26T10:00:00Z"), metodo: "multibanco", valor: 369, levantamentoId: null }],
  ]);

  it("pago ao profissional: comoEntrou e o valor; a taxa abatida à parte", () => {
    const a = camposDoPagamento({ id: 1, createdAt: NOVO, formaDePagamento: null }, pagos);
    expect(a).toMatchObject({ comoEntrou: "ao_profissional", valorQueEntrou: 150, dividaAbatida: null });
    const b = camposDoPagamento({ id: 2, createdAt: NOVO, formaDePagamento: null }, pagos);
    expect(b.dividaAbatida).toMatchObject({ valor: 8.8, levantamentoId: 7 });
    const c = camposDoPagamento({ id: 3, createdAt: NOVO, formaDePagamento: null }, pagos);
    expect(c).toMatchObject({ comoEntrou: "multibanco", dividaAbatida: null });
    expect(foiPagoEmMao(a)).toBe(true);
    expect(foiPagoEmMao(c)).toBe(false);
  });
});

describe("a lista dos afectados para o dono", () => {
  const linhas = [
    { negociacaoId: 1, pedidoId: 901, providerId: 5, profissional: "Pro A", valorAcordado: 150, taxaProfissional: 0.1, taxaCliente: 0, valorQueEntrou: 150, registadoEm: "2026-10-26T10:00:00Z", pagoEm: null },
    { negociacaoId: 2, pedidoId: 902, providerId: 5, profissional: "Pro A", valorAcordado: 80, taxaProfissional: 0.11, taxaCliente: 0, valorQueEntrou: 80, registadoEm: "2026-10-27T10:00:00Z", pagoEm: null },
    { negociacaoId: 4, pedidoId: 904, providerId: 6, profissional: "Pro B", valorAcordado: 100, taxaProfissional: 0.1, taxaCliente: 0, valorQueEntrou: 100, registadoEm: "2026-10-20T10:00:00Z", pagoEm: null },
  ];
  const levs = [
    { id: 11, providerId: 5, valor: 206.2, estado: "pedido", createdAt: "2026-10-31T10:00:00Z", processadoEm: null },
    { id: 12, providerId: 6, valor: 90, estado: "pago", createdAt: "2026-10-22T10:00:00Z", processadoEm: "2026-10-23T10:00:00Z" },
    { id: 13, providerId: 6, valor: 50, estado: "pago", createdAt: "2026-10-01T10:00:00Z", processadoEm: "2026-10-02T10:00:00Z" },
  ];
  const r = afectadosPeloPagoEmMao(linhas, levs);

  it("o pedido de transferência aberto vem primeiro, em destaque", () => {
    expect(r[0]).toMatchObject({ providerId: 5, alerta: "pedido_aberto", mostradoAMais: 206.2, deve: 23.8 });
    expect(r[0].pedidosAbertos.map((v) => v.id)).toEqual([11]);
    expect(r[0].trabalhos.map((t) => t.pedidoId)).toEqual([902, 901]);
  });

  it("uma transferência paga depois do registo fica para conferir; as de antes não", () => {
    expect(r[1]).toMatchObject({ providerId: 6, alerta: "transferencia_depois" });
    expect(r[1].transferenciasDepois.map((v) => v.id)).toEqual([12]);
  });
});

describe("os caminhos que pagam ao profissional lêem a mesma regra", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("o «pago ao profissional» um a um recusa um trabalho pago em mão", () => {
    expect(ler("src/app/api/admin/pagamentos/pago-ao-profissional/route.ts")).toContain(
      "foiPagoEmMaoPor(l.formaDePagamento, l.comoEntrou)",
    );
  });
  it("o pedido de transferência usa a carteira lida da base (com o método)", () => {
    const r = ler("src/app/api/profissionais/levantamento/route.ts");
    expect(r).toContain("trabalhosDaCarteira(linhas)");
    expect(r).toContain("recusaDoLevantamento(");
    expect(r).toContain("aPagarAClyonDe(trabalhos, agora)");
  });
  it("as Carteiras do backoffice não põem um pago em mão em «por pagar»", () => {
    // A mesma pergunta dos Pagamentos, também nos Trabalhos CLYON (04-11-2026, d9).
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("const monte = monteNasCarteiras({");
  });
  it("o abatimento de um pago em mão não fecha a negociação outra vez", () => {
    expect(ler("src/lib/abater-dividas-no-saldo.ts")).toContain("aParte: d.aParte === true");
  });
});
