import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aPagarAClyonDe,
  abatidoEmDividasDe,
  carteiraDe,
  dividasDe,
  levantavelDe,
  planoDeAbatimento,
  recusaDoLevantamento,
  type DividaNaCarteira,
  type TrabalhoNaCarteira,
} from "./carteira";
import { carteiraDoLivro, livroDe } from "./livro-da-carteira";
import { porCobrarDe, recebidoEmMaoDe } from "./carteira";
import { camposDoPagamento } from "./carteira-do-profissional";
import {
  bloqueioEmDinheiro,
  dividasEmAtraso,
  explicacaoDoBloqueio,
  venceEm,
} from "./bloqueio-por-divida";
import {
  DIAS_PARA_PAGAR_A_DIVIDA,
  METODO_DO_ABATIMENTO,
  dividaDoProfissional,
} from "./divida-do-profissional";
import { avaliarElegibilidade, motivosAgregados } from "./profissional-elegivel";
import { quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import { nomeDoRecebimento } from "./dinheiro-do-trabalho";

/**
 * «E SE O PROFISSIONAL NÃO PAGAR A DÍVIDA?» — «ABATER NO SALDO + BLOQUEAR».
 * Decisão do dono, 01-10-2026.
 *
 *   1. A dívida em aberto desconta-se do disponível PARA LEVANTAMENTO: só pode
 *      levantar disponível − dívida (0 se a dívida for maior). Quando um
 *      levantamento é dado por pago, a parte que ficou reservada paga a
 *      dívida — registado, com o número do levantamento.
 *   2. Uma dívida por pagar há mais de 7 dias fecha-lhe os trabalhos em
 *      DINHEIRO (propor, aceitar, receber pedidos); os pela plataforma
 *      continuam.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const TAXAS: Taxas = { cliente: 0.05, profissional: 0.0655 };
const DIA = 86_400_000;
/** Depois de `IVA_INCLUIDO_DESDE` (02-10-2026, meia-noite de Lisboa). */
const ABERTA = new Date("2026-10-05T10:00:00Z");
const CONFIRMADO = new Date("2026-10-11T10:00:00Z");
const agora = new Date("2026-10-15T12:00:00Z");

/** Um trabalho pela plataforma, feito, confirmado e pago pelo cliente. */
const plataforma = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 500,
  taxaCliente: String(TAXAS.cliente),
  taxaProfissional: String(TAXAS.profissional),
  formaDePagamento: "na_plataforma",
  negociacaoCriadaEm: ABERTA,
  execucaoEnviadaEm: new Date("2026-10-08T10:00:00Z"),
  confirmadoEm: new Date("2026-10-09T10:00:00Z"),
  clientePagouEm: new Date("2026-10-07T10:00:00Z"),
  ...p,
});

/** Um trabalho em dinheiro, com IVA incluído, feito e confirmado. Deve 124,95 €. */
const dinheiro = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
  negociacaoId: 2,
  estado: "acordada",
  valorAcordado: 350,
  taxaCliente: String(TAXAS.cliente),
  taxaProfissional: String(TAXAS.profissional),
  formaDePagamento: "dinheiro",
  negociacaoCriadaEm: ABERTA,
  execucaoEnviadaEm: new Date("2026-10-10T10:00:00Z"),
  confirmadoEm: CONFIRMADO,
  ...p,
});

const LIQUIDO_500 = quantoOProfissionalRecebe(500, TAXAS);
const DIVIDA = dividaDoProfissional(350, TAXAS).total;

describe("os números do exemplo", () => {
  it("500 € pela plataforma deixam 467,25 € líquidos; 350 € em dinheiro deixam 124,95 € de dívida", () => {
    expect(LIQUIDO_500).toBe(467.25);
    expect(DIVIDA).toBe(124.95);
  });
});

describe("1. a dívida fica reservada no disponível", () => {
  it("disponível 467,25 € e dívida 124,95 €: pode levantar 342,30 €", () => {
    const t = [plataforma(), dinheiro()];
    const c = carteiraDe(t, [], agora);
    expect(c.disponivel).toBe(467.25);
    expect(aPagarAClyonDe(t, agora)).toBe(124.95);
    expect(levantavelDe(c, aPagarAClyonDe(t, agora))).toBe(342.3);
  });

  it("dívida maior do que o disponível: levanta zero, e nunca negativo", () => {
    expect(levantavelDe({ disponivel: 50 }, 124.95)).toBe(0);
    expect(levantavelDe({ disponivel: 0 }, 124.95)).toBe(0);
  });

  it("sem dívida (ou um número sem sentido), o levantável é o disponível", () => {
    expect(levantavelDe({ disponivel: 80 }, 0)).toBe(80);
    expect(levantavelDe({ disponivel: 80 }, Number.NaN)).toBe(80);
    expect(levantavelDe({ disponivel: 80 }, -5)).toBe(80);
  });

  it("a rota recusa o que passa do levantável, e diz porquê", () => {
    const t = [plataforma(), dinheiro()];
    const c = carteiraDe(t, [], agora);
    const deve = aPagarAClyonDe(t, agora);
    expect(recusaDoLevantamento(342.3, c, true, false, deve)).toBeNull();
    expect(recusaDoLevantamento(342.31, c, true, false, deve)).toBe("divida_em_aberto");
    expect(recusaDoLevantamento(467.25, c, true, false, deve)).toBe("divida_em_aberto");
    // Acima do disponível, a razão é a de sempre.
    expect(recusaDoLevantamento(500, c, true, false, deve)).toBe("pago_em_mao");
    // Sem dívida, o disponível inteiro.
    expect(recusaDoLevantamento(467.25, c, true, false, 0)).toBeNull();
  });

  it("a rota do levantamento passa a dívida, e a da carteira devolve o levantável", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/levantamento/route.ts"));
    expect(rota).toContain("const aPagarAClyon = aPagarAClyonDe(trabalhos, agora);");
    expect(rota).toMatch(/recusaDoLevantamento\([\s\S]*?aPagarAClyon,\s*\)/);
    const carteira = semComentarios(ler("src/app/api/profissionais/carteira/route.ts"));
    expect(carteira).toContain("levantavel: levantavelDe(carteira, aPagarAClyon)");
    // E o ecrã usa esse número, e não o disponível, para o botão.
    const ecra = semComentarios(ler("src/app/profissionais/painel/Carteira.tsx"));
    expect(ecra).toContain("levantavel >= MINIMO_PARA_LEVANTAR");
    expect(ecra).toContain("numero <= maximo");
  });
});

describe("1. quando o levantamento é pago, o reservado paga a dívida", () => {
  it("o plano: dívidas inteiras, das mais antigas para as mais novas, saltando as que não cabem", () => {
    const d = (negociacaoId: number, total: number, dia: number): DividaNaCarteira => ({
      negociacaoId,
      total,
      iva: 0,
      comissao: 0,
      recebidoDoCliente: 0,
      paga: false,
      abatida: false,
      abatidaNoLevantamento: null,
      nasceuEm: new Date(Date.UTC(2026, 9, dia)),
    });
    const p = planoDeAbatimento([d(3, 50, 12), d(1, 300, 10), d(2, 100, 11)], 200);
    // A de 300 (a mais antiga) não cabe; abatem-se a de 100 e a de 50.
    expect(p.abater.map((x) => x.negociacaoId)).toEqual([2, 3]);
    expect(p.ficam.map((x) => x.negociacaoId)).toEqual([1]);
    expect(p.totalAbatido).toBe(150);
    expect(p.sobra).toBe(50);
  });

  it("nada para abater sem saldo, e as já pagas nunca entram", () => {
    const paga: DividaNaCarteira = {
      negociacaoId: 9,
      total: 10,
      iva: 0,
      comissao: 0,
      recebidoDoCliente: 0,
      paga: true,
      abatida: false,
      abatidaNoLevantamento: null,
      nasceuEm: null,
    };
    expect(planoDeAbatimento([paga], 1000).abater).toEqual([]);
    expect(planoDeAbatimento([{ ...paga, paga: false }], 0).abater).toEqual([]);
  });

  it("DE PONTA A PONTA: pede 342,30 €, é pago, abatem-se 124,95 € e fica tudo a zero", () => {
    // Pede o levantável inteiro.
    const levantamentos = [{ id: 45, valor: 342.3, estado: "pago" }];
    const antes = [plataforma(), dinheiro()];
    const c = carteiraDe(antes, levantamentos, agora);
    // O que ficou no disponível é exactamente o reservado.
    expect(c.disponivel).toBe(124.95);
    const plano = planoDeAbatimento(dividasDe(antes, agora), c.disponivel);
    expect(plano.totalAbatido).toBe(124.95);
    expect(plano.abater.map((d) => d.negociacaoId)).toEqual([2]);

    // O abatimento escrito: a linha `abatimento` paga a negociação 2.
    const pagos = new Map([
      [2, { pagoEm: agora, metodo: METODO_DO_ABATIMENTO, valor: 124.95, levantamentoId: 45 }],
    ]);
    const depois = [
      plataforma(),
      { ...dinheiro(), ...camposDoPagamento({ id: 2, createdAt: ABERTA, formaDePagamento: "dinheiro" }, pagos) },
    ];
    const c2 = carteiraDe(depois, levantamentos, agora);
    expect(c2.abatidoEmDividas).toBe(124.95);
    expect(c2.disponivel).toBe(0);
    expect(c2.levantado).toBe(342.3);
    // O total ganho não muda: ganhou-o, e pagou com ele.
    expect(c2.totalGanho).toBe(c.totalGanho);
    expect(aPagarAClyonDe(depois, agora)).toBe(0);
    expect(dividasDe(depois, agora)[0]).toMatchObject({ paga: true, abatida: true, abatidaNoLevantamento: 45 });
    // E o bloqueio levanta-se sozinho.
    const muitoDepois = new Date(CONFIRMADO.getTime() + 30 * DIA);
    expect(bloqueioEmDinheiro(depois, muitoDepois).bloqueado).toBe(false);
  });

  it("paga por referência não sai do disponível — só o abatimento sai", () => {
    const pagos = new Map([[2, { pagoEm: agora, metodo: "multibanco", valor: 124.95, levantamentoId: null }]]);
    const campos = camposDoPagamento({ id: 2, createdAt: ABERTA, formaDePagamento: "dinheiro" }, pagos);
    expect(campos.dividaPagaEm).toEqual(agora);
    expect(campos.dividaAbatida).toBeNull();
    const c = carteiraDe([plataforma(), { ...dinheiro(), ...campos }], [], agora);
    expect(c.disponivel).toBe(467.25);
    expect(c.abatidoEmDividas).toBe(0);
  });

  it("num trabalho que não é dinheiro, um pagamento nunca é uma dívida abatida", () => {
    const pagos = new Map([[1, { pagoEm: agora, metodo: METODO_DO_ABATIMENTO, valor: 10, levantamentoId: 1 }]]);
    const campos = camposDoPagamento({ id: 1, createdAt: ABERTA, formaDePagamento: "na_plataforma" }, pagos);
    expect(campos.clientePagouEm).toEqual(agora);
    expect(campos.dividaPagaEm).toBeNull();
    expect(campos.dividaAbatida).toBeNull();
  });

  it("o livro chega ao mesmo número, com um movimento seu para a dívida abatida", () => {
    const t = [
      plataforma(),
      dinheiro({ dividaPagaEm: agora, dividaAbatida: { valor: 124.95, em: agora, levantamentoId: 45 } }),
    ];
    const levs = [{ id: 45, valor: 342.3, estado: "pago" }];
    const livro = livroDe(7, t, levs);
    const mov = livro.find((m) => m.tipo === "divida_abatida");
    expect(mov).toMatchObject({ valor: -124.95, chave: "divida:2:abatida", levantamentoId: 45 });
    const doLivro = carteiraDoLivro(livro, agora, porCobrarDe(t), recebidoEmMaoDe(t, agora));
    expect(doLivro).toEqual(carteiraDe(t, levs, agora));
    expect(abatidoEmDividasDe(t)).toBe(124.95);
  });

  it("o backoffice abate SÓ depois de dar o levantamento por pago, e só num pago", () => {
    const rota = semComentarios(ler("src/app/api/admin/levantamentos/route.ts"));
    const marca = rota.indexOf("await marcarLevantamento(");
    const abate = rota.indexOf("await abaterDividasNoSaldo(");
    expect(marca).toBeGreaterThan(-1);
    expect(abate).toBeGreaterThan(marca);
    expect(rota.slice(marca, abate)).toContain('if (estado === "pago")');
  });

  it("o abatimento escreve-se pela porta dos pagamentos à mão (índice único), com o levantamento, e no registo", () => {
    const lib = semComentarios(ler("src/lib/abater-dividas-no-saldo.ts"));
    expect(lib).toContain("registarRecebimentoAMao({");
    expect(lib).toContain("metodo: METODO_DO_ABATIMENTO,");
    expect(lib).toContain("levantamentoId: c.levantamentoId,");
    expect(lib).toContain('acontecimento: "divida_abatida"');
    // Uma recusa da base (já paga entretanto) não se conta como abatida.
    expect(lib).toContain("if (!r.feito) return null;");
    const base = ler("src/lib/pagamentos-na-base.ts");
    expect(base).toContain("ALTER TABLE pagamentos ADD COLUMN levantamentoId");
    // Não é dinheiro que entrou: fica fora do total pago do painel.
    expect(base).toContain("metodo <> 'abatimento'");
    expect(nomeDoRecebimento(METODO_DO_ABATIMENTO)).toBe("Abatido no saldo do profissional");
  });
});

describe("2. mais de 7 dias por pagar fecha os trabalhos em dinheiro", () => {
  it("o prazo conta-se da confirmação, e são 7 dias", () => {
    expect(DIAS_PARA_PAGAR_A_DIVIDA).toBe(7);
    const [d] = dividasDe([dinheiro()], agora);
    expect(d.nasceuEm).toEqual(CONFIRMADO);
    expect(venceEm(d)?.getTime()).toBe(CONFIRMADO.getTime() + 7 * DIA);
  });

  it("no sétimo dia certo ainda está a tempo; um instante depois, bloqueado", () => {
    const fim = new Date(CONFIRMADO.getTime() + 7 * DIA);
    expect(bloqueioEmDinheiro([dinheiro()], fim).bloqueado).toBe(false);
    const b = bloqueioEmDinheiro([dinheiro()], new Date(fim.getTime() + 1));
    expect(b.bloqueado).toBe(true);
    expect(b.total).toBe(124.95);
    expect(b.dividas.map((x) => x.negociacaoId)).toEqual([2]);
  });

  it("libertado pelo prazo do cliente: a dívida nasce sete dias depois da prova", () => {
    const prova = new Date("2026-10-10T10:00:00Z");
    const t = dinheiro({ confirmadoEm: null, execucaoEnviadaEm: prova });
    const nasce = new Date(prova.getTime() + 7 * DIA);
    expect(dividasDe([t], new Date(nasce.getTime() + 1))[0].nasceuEm).toEqual(nasce);
    expect(bloqueioEmDinheiro([t], new Date(nasce.getTime() + 7 * DIA)).bloqueado).toBe(false);
    expect(bloqueioEmDinheiro([t], new Date(nasce.getTime() + 7 * DIA + 1)).bloqueado).toBe(true);
  });

  it("paga por referência, abatida, anterior ao IVA incluído ou pela plataforma: não bloqueia", () => {
    const tarde = new Date(CONFIRMADO.getTime() + 60 * DIA);
    expect(bloqueioEmDinheiro([dinheiro({ dividaPagaEm: agora })], tarde).bloqueado).toBe(false);
    expect(
      bloqueioEmDinheiro(
        [dinheiro({ dividaPagaEm: agora, dividaAbatida: { valor: 124.95, em: agora, levantamentoId: 1 } })],
        tarde,
      ).bloqueado,
    ).toBe(false);
    expect(
      bloqueioEmDinheiro([dinheiro({ negociacaoCriadaEm: new Date("2026-09-20T10:00:00Z") })], tarde).bloqueado,
    ).toBe(false);
    expect(bloqueioEmDinheiro([plataforma({ clientePagouEm: null })], tarde).bloqueado).toBe(false);
  });

  it("as mais antigas primeiro, e só as atrasadas", () => {
    const velha = dinheiro({ negociacaoId: 3, confirmadoEm: new Date("2026-10-06T10:00:00Z") });
    const nova = dinheiro({ negociacaoId: 4, confirmadoEm: new Date("2026-10-14T10:00:00Z") });
    const l = dividasEmAtraso([nova, velha], agora);
    expect(l.map((d) => d.negociacaoId)).toEqual([3]);
  });

  it("a explicação diz o valor, o pedido e a referência", () => {
    const t = explicacaoDoBloqueio([
      { total: 124.95, pedidoId: 312, multibanco: { entidade: "11249", referencia: "123 456 789" } },
    ]);
    expect(t).toContain("124,95 €");
    expect(t).toContain("pedido #312");
    expect(t).toContain("entidade 11249");
    expect(t).toContain("referência 123 456 789");
    expect(t).toContain("mais de 7 dias");
    expect(t).toContain("pagos pela plataforma continuam abertos");
    expect(explicacaoDoBloqueio([])).toBe("");
  });

  it("as duas rotas onde ele propõe e aceita recusam, nos trabalhos em dinheiro", () => {
    const painel = semComentarios(ler("src/app/api/profissionais/negociacao/route.ts"));
    expect(painel).toContain("bloqueioDoProfissional(sessao.providerId, agora)");
    expect(painel).toMatch(/compromete &&\s*lerForma\([^)]*\)\.formaDePagamento\) === "dinheiro"/);
    // ANTES de o motor correr: a proposta não pode chegar a ser gravada.
    expect(painel.indexOf("bloqueioDoProfissional(")).toBeLessThan(painel.indexOf("propor(estadoActual"));

    const link = semComentarios(ler("src/app/api/negociacao/[token]/route.ts"));
    expect(link).toContain("bloqueioDoProfissional(providerId, agora)");
    expect(link).toContain('lado === "profissional"');
    expect(link).toContain('lerForma(linha.formaDePagamento) === "dinheiro"');
    expect(link.indexOf("bloqueioDoProfissional(providerId")).toBeLessThan(link.indexOf("propor(estadoActual"));
  });
});

describe("2. a distribuição não manda pedidos em dinheiro a quem está bloqueado", () => {
  const pro = {
    id: 1,
    isActive: true,
    estado: "aprovado",
    categorias: ["recolha_monos"],
    raioKm: 50,
    zonas: [],
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
  };
  const pedido = {
    serviceType: "recolha_monos",
    precisaFatura: false,
    precisaGuiaTransporte: false,
    distanciaKm: 10,
    city: "Setúbal",
  };

  it("em dinheiro fica de fora, com o motivo; pela plataforma continua a receber", () => {
    const r = avaliarElegibilidade({ ...pedido, formaDePagamento: "dinheiro" }, { ...pro, dividaEmAtraso: true });
    expect(r.elegivel).toBe(false);
    expect(r.motivos).toEqual(["divida_em_atraso"]);
    expect(
      avaliarElegibilidade({ ...pedido, formaDePagamento: "na_plataforma" }, { ...pro, dividaEmAtraso: true })
        .elegivel,
    ).toBe(true);
    expect(avaliarElegibilidade({ ...pedido, formaDePagamento: "dinheiro" }, pro).elegivel).toBe(true);
  });

  it("e o diagnóstico conta-o", () => {
    const m = motivosAgregados({ ...pedido, formaDePagamento: "dinheiro" }, [
      { profissional: { ...pro, dividaEmAtraso: true }, distanciaKm: 10 },
    ]);
    expect(m.divida_em_atraso).toBe(1);
  });

  it("a distribuição passa a forma e a dívida de cada um, e só pergunta à base no dinheiro", () => {
    const lib = semComentarios(ler("src/lib/distribuir-pedido.ts"));
    expect(lib).toContain('if (forma !== "dinheiro") return activos.map((p) => ({ ...p, dividaEmAtraso: false }));');
    expect(lib).toContain("dividaEmAtraso: bloqueados.has(p.id)");
    expect(lib.split("formaDePagamento: forma,").length - 1).toBeGreaterThanOrEqual(3);
  });
});
