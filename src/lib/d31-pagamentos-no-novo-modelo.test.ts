import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TAXA_POR_RECEBER_DO_PARCEIRO,
  TAXA_RECEBIDA_DO_PARCEIRO,
  contaDoNovoModelo,
  contaFecha,
} from "./conta-do-pagamento";
import { faseDoDinheiro, ladoDoProfissional, pagouAoProfissional, rotuloDaFase } from "./dinheiro-do-trabalho";
import { destinoDoTrabalho, monteNasCarteiras, noSeparador, taxaDoPagoEmMao } from "./a-quem-foi-o-dinheiro";
import { noNovoModelo, type TrabalhoParaGerir } from "./trabalhos-para-gerir";
import type { SeparadorDoDinheiro } from "./filtros-dos-pagamentos";
import { dividaDoRegistoEmMao } from "./pago-em-mao";
import { contaDaCarteira, RAZOES } from "./trabalhos-da-carteira";
import type { TrabalhoNaCarteira } from "./carteira";

/*
 * d31 (CEO e dono, 15-11-2026) — os Pagamentos do backoffice no modelo de
 * 15-11: num trabalho do modelo novo o cliente pagou ao profissional
 * diretamente. Mostra-se a taxa por receber dele (a taxa + o IVA dela), e
 * NUNCA «A receber do cliente» nem «A pagar ao profissional». Um trabalho de
 * cada modelo, com os mesmos números.
 */

const taxas = { cliente: 0, profissional: 0.1 };
const PROIBIDOS = /A receber do cliente|A pagar ao profissional|Recebido do cliente|Por receber do cliente/;

function trabalhoAntigo(extra: Partial<TrabalhoParaGerir> = {}): TrabalhoParaGerir {
  return {
    negociacaoId: 1,
    pedidoId: 588,
    providerId: 7,
    cliente: null,
    telefoneDoCliente: null,
    cidade: null,
    servico: null,
    profissional: "Parceiro de teste",
    contaDeTeste: false,
    valorAcordado: 350,
    taxas,
    clientePaga: 430.5,
    declarado: null,
    profissionalRecebe: 315,
    dividaDoProfissional: null,
    ivaIncluido: true,
    semFactura: false,
    podeMudarFactura: true,
    porqueNaoMudaFactura: null,
    pagouSemFactura: false,
    motivoSemFactura: null,
    formaDePagamento: "plataforma",
    comoEntrou: null,
    clientePagouEm: null,
    confirmadoEm: "2026-11-15T12:00:00.000Z",
    pagoEm: null,
    fase: "a_receber",
    recebido: false,
    dataDoTrabalho: null,
    feitoEm: null,
    pedidoCriadoEm: null,
    agendadoPara: null,
    conta: null,
    taxaAbaixo: null,
    taxaEmMao: null,
    correccao: { valorRegistado: null, declarado: null, comFactura: 430.5, semFactura: 350 },
    ...extra,
  };
}

const SEPARADORES: SeparadorDoDinheiro[] = ["por_receber", "recebidos", "em_mao", "por_pagar", "pagos"];

describe("d31 — a conta do modelo novo", () => {
  it("diz a taxa por receber do parceiro, e fecha ao cêntimo (regime normal)", () => {
    const c = contaDoNovoModelo(350, taxas, "normal", false)!;
    expect(c.novoModelo).toBe(true);
    expect(c.total).toBe(430.5);
    const ultimo = c.degraus[c.degraus.length - 1];
    expect(ultimo.final).toBe(true);
    expect(ultimo.rotulo).toBe(TAXA_POR_RECEBER_DO_PARCEIRO);
    expect(ultimo.valor).toBe(43.05); // 35 de taxa + 8,05 de IVA
    expect(contaFecha(c)).toBe(true);
    for (const d of c.degraus) expect(d.rotulo).not.toMatch(PROIBIDOS);
  });

  it("isento: o cliente paga a fatura dele sem IVA mais a da taxa", () => {
    const c = contaDoNovoModelo(350, taxas, "isento", true)!;
    expect(c.total).toBe(358.05);
    expect(c.degraus[c.degraus.length - 1].rotulo).toBe(TAXA_RECEBIDA_DO_PARCEIRO);
    expect(contaFecha(c)).toBe(true);
  });
});

describe("d31 — um trabalho de cada modelo nos Pagamentos", () => {
  const antigo = trabalhoAntigo();
  const novo = noNovoModelo(antigo, { regimeDoProfissional: "normal" });

  it("o antigo, sem nada pago, está por receber do cliente e por pagar ao profissional", () => {
    expect(faseDoDinheiro(antigo)).toBe("a_receber");
    expect(noSeparador(antigo, "por_receber")).toBe(true);
    expect(noSeparador(antigo, "por_pagar")).toBe(true);
    expect(destinoDoTrabalho(antigo)).toBe("clyon");
  });

  it("o novo nunca está «por receber do cliente» nem «por pagar ao profissional»", () => {
    expect(novo.novoModelo).toBe(true);
    expect(pagouAoProfissional(novo)).toBe(true);
    expect(destinoDoTrabalho(novo)).toBe("profissional");
    expect(noSeparador(novo, "por_receber")).toBe(false);
    expect(noSeparador(novo, "por_pagar")).toBe(false);
    expect(noSeparador(novo, "em_mao")).toBe(true);
    expect(ladoDoProfissional(novo)).toBe("pago");
    expect(rotuloDaFase(novo)).toBe(TAXA_POR_RECEBER_DO_PARCEIRO);
    expect(novo.conta?.novoModelo).toBe(true);
    for (const d of novo.conta!.degraus) expect(d.rotulo).not.toMatch(PROIBIDOS);
  });

  it("o que se recebe é a taxa + IVA dele; sem comprovativo, fatura nem correcção do cliente", () => {
    expect(novo.dividaDoProfissional).toBe(43.05);
    expect(novo.clientePaga).toBe(430.5);
    expect(novo.profissionalRecebe).toBe(387.45);
    expect(novo.recebido).toBe(false);
    expect(novo.podeMudarFactura).toBe(false);
    expect(novo.correccao).toBeNull();
    expect(novo.taxaEmMao).toMatchObject({ valor: 43.05, cobrada: false });
  });

  it("paga a taxa, o trabalho fecha — sem passar por «por pagar»", () => {
    const pago = noNovoModelo(trabalhoAntigo({ clientePagouEm: "2026-11-16T10:00:00.000Z", comoEntrou: "multibanco" }), {});
    expect(faseDoDinheiro(pago)).toBe("fechado");
    expect(pago.taxaEmMao).toMatchObject({ cobrada: true, como: "multibanco" });
    expect(pago.conta!.degraus.at(-1)!.rotulo).toBe(TAXA_RECEBIDA_DO_PARCEIRO);
  });

  it("critério: 0 trabalhos do modelo novo «por receber do cliente» na lista", () => {
    const lista = [antigo, novo, noNovoModelo(trabalhoAntigo({ confirmadoEm: null }), {})];
    const novosPorReceber = lista.filter((t) => t.novoModelo && noSeparador(t, "por_receber"));
    expect(novosPorReceber).toHaveLength(0);
    for (const t of lista.filter((x) => x.novoModelo)) {
      expect(SEPARADORES.filter((s) => noSeparador(t, s))).toEqual(["em_mao"]);
    }
  });

  it("registado «pago ao profissional» (o #588): só a taxa por receber, com a conta da carteira", () => {
    const registado = noNovoModelo(
      trabalhoAntigo({
        comoEntrou: "ao_profissional",
        clientePagouEm: "2026-11-15T12:18:27.000Z",
        taxaEmMao: { valor: 38.5, cobrada: false, descontaNoSaldo: false },
      }),
      { valorQueEntrou: 350 },
    );
    const d = dividaDoRegistoEmMao(350, taxas, 350);
    expect(registado.novoModelo).toBe(true);
    expect(registado.dividaDoProfissional).toBe(d.total);
    expect(registado.clientePagouEm).toBeNull();
    expect(faseDoDinheiro(registado)).toBe("a_receber");
    expect(rotuloDaFase(registado)).toBe(TAXA_POR_RECEBER_DO_PARCEIRO);
    expect(SEPARADORES.filter((s) => noSeparador(registado, s))).toEqual(["em_mao"]);
    expect(contaFecha(registado.conta!)).toBe(true);
    expect(registado.conta!.degraus.at(-1)).toMatchObject({ rotulo: TAXA_POR_RECEBER_DO_PARCEIRO, valor: d.total });
    for (const g of registado.conta!.degraus) expect(g.rotulo).not.toMatch(PROIBIDOS);
  });

  it("a parte da CLYON do modelo novo segue a do dinheiro", () => {
    expect(
      taxaDoPagoEmMao({ novoModelo: true, dividaDoProfissional: 43.05, clientePagouEm: null, valorAcordado: 350, taxas }),
    ).toMatchObject({ valor: 43.05, cobrada: false });
  });
});

describe("d31 — as Carteiras (o #612)", () => {
  it("um trabalho do modelo novo confirmado e sem nada pago nunca fica «por pagar»", () => {
    const t = { formaDePagamento: "plataforma", comoEntrou: null, confirmadoEm: "2026-11-15", pagoEm: null };
    expect(monteNasCarteiras(t)).toBe("por_pagar");
    expect(monteNasCarteiras({ ...t, novoModelo: true })).toBe("em_mao");
  });

  /*
   * O #612 era um Trabalho CLYON (modelo antigo): confirmado, e a carteira dele
   * já dizia «pode pedir a transferência» de 315 € que o cliente ainda não
   * tinha pago. Um trabalho de cada modelo, com os mesmos números.
   */
  const agora = new Date("2026-11-16T12:00:00Z");
  const naCarteira = (o: Partial<TrabalhoNaCarteira> = {}) =>
    ({
      negociacaoId: 612,
      pedidoId: 612,
      estado: "acordada",
      valorAcordado: 350,
      taxaCliente: 0,
      taxaProfissional: 0.1,
      formaDePagamento: "na_plataforma",
      execucaoEnviadaEm: "2026-11-15T11:00:00Z",
      confirmadoEm: "2026-11-15T11:40:00Z",
      pagoEm: null,
      clientePagouEm: null,
      negociacaoCriadaEm: "2026-11-10T09:00:00Z",
      pagoPelaClyon: true,
      ...o,
    }) as TrabalhoNaCarteira;
  const linha = (t: TrabalhoNaCarteira) => contaDaCarteira([t], [], agora).linhas[0];

  it("um Trabalho CLYON confirmado e sem o cliente ter pago nunca fica «pode pedir a transferência»", () => {
    const c = contaDaCarteira([naCarteira()], [], agora);
    expect(c.linhas[0]).toMatchObject({ grupo: "retido", razao: RAZOES.clienteNaoPagou, falta: 315 });
    expect(c.resumo.podePedir).toBe(0);
    expect(c.resumo.porReceber).toBe(0);
    expect(c.resumo.clienteAindaNaoPagou).toBe(315);
  });

  it("o cliente pagou: fica disponível; e o que a CLYON já lhe transferiu continua recebido", () => {
    expect(linha(naCarteira({ clientePagouEm: "2026-11-15T11:58:00Z" }))).toMatchObject({
      grupo: "por_receber",
      razao: RAZOES.podePedir,
    });
    expect(linha(naCarteira({ pagoEm: "2026-11-15T12:54:00Z" }))).toMatchObject({ grupo: "recebido", razao: "pago" });
  });

  it("por fazer, sem o cliente ter pago, já não diz «o cliente já pagou»", () => {
    expect(linha(naCarteira({ execucaoEnviadaEm: null, confirmadoEm: null })).razao).toBe(RAZOES.clienteNaoPagou);
  });

  it("o trabalho de plataforma do modelo antigo segue a mesma regra", () => {
    expect(linha(naCarteira({ pagoPelaClyon: false })).razao).toBe(RAZOES.clienteNaoPagou);
  });

  it("nas Carteiras do backoffice: confirmado sem o cliente ter pago fica «à espera do cliente», nunca «A pagar»", () => {
    const t = { formaDePagamento: "na_plataforma", comoEntrou: null, confirmadoEm: "2026-11-15", pagoEm: null };
    expect(monteNasCarteiras({ ...t, clientePagou: false })).toBe("a_espera_do_cliente");
    expect(monteNasCarteiras({ ...t, clientePagou: true })).toBe("por_pagar");
    // Já transferido, ou pago em mão, fica onde estava.
    expect(monteNasCarteiras({ ...t, pagoEm: "2026-11-15", clientePagou: false })).toBe("pago");
    expect(monteNasCarteiras({ ...t, novoModelo: true, clientePagou: false })).toBe("em_mao");
  });
});

describe("d31 — as rotas perguntam pelo modelo", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("os Pagamentos, as Carteiras e o «Já recebemos» lêem o modelo novo", () => {
    const tpg = ler("src/lib/trabalhos-para-gerir.ts");
    expect(tpg).toMatch(/await contratadasNoNovoModelo\(/);
    expect(tpg).toMatch(/noNovoModelo\(linha, l/);
    const carteiras = ler("src/app/api/admin/carteiras/route.ts");
    expect(carteiras).toMatch(/await contratadasNoNovoModelo\(/);
    expect(carteiras).toMatch(/novoModelo: novo,/);
    expect(carteiras).toMatch(/contaDoNovoModelo\(/);
    // O #612: o dinheiro do cliente decide o «A pagar» e a conta, também num Trabalho CLYON.
    expect(carteiras).toMatch(/clientePagou: clienteJaPagou,/);
    expect(carteiras).toMatch(/monte === "por_finalizar" \|\| monte === "a_espera_do_cliente"/);
    expect(carteiras).not.toMatch(/clyonAntigo \|\| lerForma\(l\.formaDePagamento\) === "dinheiro"/);
    const recebido = ler("src/app/api/admin/pagamentos/recebido/route.ts");
    expect(recebido).toMatch(/await segueONovoModelo\(/);
    expect(recebido).toMatch(/taxaAPassarAClyon\(/);
  });
});
