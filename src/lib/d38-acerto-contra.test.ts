import { describe, expect, it } from "vitest";
import {
  acertoContraDe,
  aPagarAClyonDe,
  carteiraDe,
  dividasDe,
  levantavelDe,
  type TrabalhoNaCarteira,
} from "./carteira";
import { camposDoPagamento } from "./carteira-do-profissional";
import {
  dividaACobrar,
  eLinhaDaDividaEmMao,
  tridDaDividaAParte,
  tridDoAbatimentoAParte,
  tridDoAcertoDaFolha,
} from "./pago-em-mao";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * d38 v2, commit c, parte 2 (15-11-2026) — A DIFERENÇA CONTRA O PROFISSIONAL JÁ PAGO.
 *
 * Um trabalho pago ao profissional (`pagoEm`) e corrigido depois pela folha
 * final para menos: o que se lhe transferiu a mais é uma dívida dele à CLYON,
 * só a parte «taxa», nascida no dia em que se lhe pagou, com o nome «acerto da
 * folha final do pedido #N». Fecha-se numa linha à parte (`acerto-folha-N`),
 * como a de um pago em mão: abatida no saldo, marcada à mão ou paga pela
 * referência (o webhook fecha-a sozinho).
 */

const agora = new Date("2026-11-15T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);
const T = { cliente: 0, profissional: 0.15 };
const pago = (p: Partial<TrabalhoNaCarteira & { pedidoId: number }> = {}): TrabalhoNaCarteira & { pedidoId: number } => ({
  negociacaoId: 900,
  pedidoId: 524,
  estado: "acordada",
  valorAcordado: 548,
  taxaCliente: T.cliente,
  taxaProfissional: T.profissional,
  execucaoEnviadaEm: haDias(5),
  confirmadoEm: haDias(4),
  pagoEm: haDias(3),
  pagoPelaClyon: true,
  ...p,
});
const vale = quantoOProfissionalRecebe(548, T); // 465,80

describe("a regra do acerto contra", () => {
  it("transferido − o que vale hoje, só num trabalho já pago", () => {
    expect(acertoContraDe(pago({ pagoAoProfissionalValor: 500 }))).toBe(34.2);
    expect(acertoContraDe(pago({ pagoAoProfissionalValor: 425 }))).toBe(0); // a favor: é a carteira
    expect(acertoContraDe(pago())).toBe(0); // sem folha final depois
    expect(acertoContraDe(pago({ pagoEm: null, pagoAoProfissionalValor: 500 }))).toBe(0); // por pagar
  });

  it("nasce uma dívida à parte, só taxa, em pagoEm, com o nome do acerto", () => {
    const t = pago({ pagoAoProfissionalValor: 500 });
    const [d] = dividasDe([t], agora);
    expect(d).toBeDefined();
    expect(d.negociacaoId).toBe(900);
    expect(d.total).toBe(34.2);
    expect(d.iva).toBe(0);
    expect(d.comissao).toBe(34.2);
    expect(d.partes.map((p) => p.parte)).toEqual(["taxa"]);
    expect(d.paga).toBe(false);
    expect(d.aParte).toBe(true);
    expect(d.acertoDaFolhaFinal).toBe(true);
    expect(d.rotulo).toBe("acerto da folha final do pedido #524");
    expect(d.tridAParte).toBe("acerto-folha-900");
    expect(d.nasceuEm?.getTime()).toBe(haDias(3).getTime());
  });

  it("a carteira não lhe tira nada; o levantável fica reservado pela dívida", () => {
    const t = pago({ pagoAoProfissionalValor: 500 });
    const outro = pago({ negociacaoId: 901, pedidoId: 525, pagoEm: null, valorAcordado: 100 });
    const c = carteiraDe([t, outro], [], agora);
    expect(c.levantado).toBe(vale); // o que saiu a mais não volta a sair
    expect(c.disponivel).toBe(quantoOProfissionalRecebe(100, T));
    const deve = aPagarAClyonDe([t, outro], agora);
    expect(deve).toBe(34.2);
    expect(levantavelDe(c, deve)).toBe(Math.round((c.disponivel - 34.2) * 100) / 100);
  });

  it("a dívida do pago em mão continua com o seu trid", () => {
    const emMao = pago({ pagoEm: null, comoEntrou: "ao_profissional", valorQueEntrou: 548, pagoPelaClyon: false });
    const [d] = dividasDe([emMao], agora);
    expect(d.tridAParte).toBe(tridDoAbatimentoAParte(900));
    expect(d.acertoDaFolhaFinal).toBeUndefined();
  });
});

describe("o fecho por uma linha à parte, lida em camposDoPagamento", () => {
  const l = { id: 900, createdAt: haDias(10), formaDePagamento: null };
  it("paga pela referência: a dívida fica paga e o saldo não mexe", () => {
    const campos = camposDoPagamento(l, new Map(), false, {
      valor: 34.2,
      em: haDias(1),
      levantamentoId: null,
      metodo: "multibanco",
    });
    expect(campos.dividaPagaEm).toEqual(haDias(1));
    expect(campos.dividaAbatida).toBeNull();
    const t = pago({ pagoAoProfissionalValor: 500, ...campos });
    const [d] = dividasDe([t], agora);
    expect(d.paga).toBe(true);
    expect(aPagarAClyonDe([t], agora)).toBe(0);
  });

  it("abatida no saldo: sai do disponível como um levantamento", () => {
    const campos = camposDoPagamento(l, new Map(), false, {
      valor: 34.2,
      em: haDias(1),
      levantamentoId: 77,
      metodo: "abatimento",
    });
    expect(campos.dividaAbatida).toEqual({ valor: 34.2, em: haDias(1), levantamentoId: 77 });
    const t = pago({ pagoAoProfissionalValor: 500, ...campos });
    const outro = pago({ negociacaoId: 901, pagoEm: null, valorAcordado: 100 });
    const c = carteiraDe([t, outro], [], agora);
    expect(c.abatidoEmDividas).toBe(34.2);
    expect(dividasDe([t], agora)[0].abatida).toBe(true);
  });

  it("sem a linha, tudo como sempre", () => {
    expect(camposDoPagamento(l, new Map()).dividaPagaEm).toBeNull();
  });
});

describe("a referência e o webhook: o trid certo", () => {
  it("pago em mão → abatimento-mao-N; pago pela plataforma → acerto-folha-N", () => {
    expect(tridDaDividaAParte(70, "ao_profissional")).toBe("abatimento-mao-70");
    expect(tridDaDividaAParte(70, null)).toBe("abatimento-mao-70");
    expect(tridDaDividaAParte(70, "multibanco")).toBe("acerto-folha-70");
    expect(tridDaDividaAParte(70, "transferencia")).toBe("acerto-folha-70");
    expect(eLinhaDaDividaEmMao(tridDoAcertoDaFolha(70))).toBe(true);
  });

  it("dividaACobrar: o acerto vai à parte «divida», e está pago pela linha à parte", () => {
    const base = { negociacaoId: 900, formaDePagamento: "plataforma", dividaEmDinheiro: null, acordado: 548, taxas: T };
    const linhaDoCliente = { estado: "pago", metodo: "multibanco", valor: 548, trid: "EUPAGO1" };
    expect(dividaACobrar(base, [linhaDoCliente])).toBeNull();
    const a = dividaACobrar({ ...base, acertoContra: 34.2 }, [linhaDoCliente]);
    expect(a).toMatchObject({ caso: "acerto", parte: "divida", jaPaga: false });
    expect(a?.divida.total).toBe(34.2);
    expect(a?.divida.iva).toBe(0);
    const paga = dividaACobrar({ ...base, acertoContra: 34.2 }, [
      linhaDoCliente,
      { estado: "pago", metodo: "multibanco", valor: 34.2, trid: "acerto-folha-900", parte: "divida" },
    ]);
    expect(paga?.jaPaga).toBe(true);
  });
});
