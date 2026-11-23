// relógio: datas explícitas em todas as chamadas — nada aqui lê o dia de hoje.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D3 (CEO e dono, 23-11-2026) — O PAGAMENTO AO PARCEIRO FICA REGISTADO.
 * «por pagar → já paguei → recebi → Pago», igual no site, nas duas apps e no
 * painel; o IBAN e o MB WAY saem do ecrã com o «Pago» e num pedido concluído.
 * Dados de teste.
 */

const registo = vi.hoisted(() => ({ linha: null as null | Record<string, unknown>, pedidoStatus: "confirmado" }));

vi.mock("./db", () => ({
  perfilDoProfissional: async () => ({
    iban: "PT50000000000000000000000",
    ibanTitular: "Parceiro de Teste",
    mbway: "nº de teste",
    name: "Parceiro de Teste",
    regimeIva: "normal",
    regimeIvaConfirmadoEm: "2026-11-10T10:00:00Z",
  }),
  getSimulatorOrderById: async () => ({ id: 800, status: registo.pedidoStatus }),
}));
vi.mock("./pagar-ao-parceiro-na-base", () => ({
  congelarRegimeDoProfissional: async (_id: number, regime: string) => regime,
  oQueONovoModeloGravou: async () => ({ pagarAoParceiroPor: "transferencia" }),
}));
vi.mock("./dados-de-pagamento-mudados-na-base", () => ({ negociacoesComDadosDePagamentoMudados: async () => new Set() }));
vi.mock("./faturas-do-trabalho-na-base", () => ({ faturasDaNegociacao: async () => [] }));
vi.mock("./dados-de-pagamento-por-confirmar-na-base", () => ({ negociacoesComDadosPorConfirmar: async () => new Map() }));
vi.mock("./pagamento-registado-na-base", () => ({ registoDoPagamentoDe: async () => registo.linha }));

import { oQueOClienteVeDoParceiro } from "./pagar-ao-parceiro-para-o-cliente";
import {
  dadosDePagamentoSaem,
  estadoDoRegisto,
  pagamentoCombinadoDiretamente,
  pagoA,
  perguntaAoParceiro,
  registoDoPagamento,
} from "./pagamento-registado";
import { pagamentoRegistadoParaOParceiro } from "./pagamento-registado-para-o-parceiro";
import type { TrabalhoAPagar } from "./acesso-ao-pagamento";

const trabalho = {
  pedidoId: 800,
  negociacaoId: 900,
  providerId: 31,
  profissionalNome: "Parceiro de Teste",
  acordado: 350,
  taxas: { cliente: 0, profissional: 0.1 },
  novoModelo: true,
  reservaCent: 0,
} as unknown as TrabalhoAPagar;

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const T0 = "2026-11-23T10:00:00Z";
const T1 = "2026-11-23T11:00:00Z";
const T2 = "2026-11-23T12:00:00Z";

beforeEach(() => {
  registo.linha = {};
  registo.pedidoStatus = "confirmado";
});

describe("d3 — os quatro caminhos do registo", () => {
  it("por pagar → já paguei → recebi → Pago, e o «Ainda não recebi» fica em dúvida", () => {
    expect(estadoDoRegisto({})).toBe("por_pagar");
    expect(estadoDoRegisto({ clienteDisseQuePagouEm: T0, formaDita: "transferencia" })).toBe("cliente_disse");
    expect(estadoDoRegisto({ clienteDisseQuePagouEm: T0, parceiroNegouEm: T1 })).toBe("em_duvida");
    // Se o cliente volta a dizer que pagou depois do «Ainda não recebi», volta a «o cliente disse».
    expect(estadoDoRegisto({ clienteDisseQuePagouEm: T2, parceiroNegouEm: T1 })).toBe("cliente_disse");
    expect(estadoDoRegisto({ clienteDisseQuePagouEm: T0, parceiroNegouEm: T1, parceiroConfirmouEm: T2 })).toBe("pago");
    // O parceiro pode marcar primeiro, sem o cliente ter dito nada.
    expect(estadoDoRegisto({ parceiroConfirmouEm: T0 })).toBe("pago");
  });

  it("só o «Recebi» do parceiro é «pago»; o dinheiro no local não conta sem ele", () => {
    const soCliente = registoDoPagamento({ clienteDisseQuePagouEm: T0, formaDita: "dinheiro" });
    expect(soCliente.pago).toBe(false);
    expect(registoDoPagamento({ clienteDisseQuePagouEm: T0, formaDita: "dinheiro", parceiroConfirmouEm: T1 }).pago).toBe(true);
  });

  it("as frases: «Pago a …», o pedido concluído sem registo, e a pergunta ao parceiro", () => {
    expect(pagoA("Parceiro de Teste", "2026-11-23T10:00:00Z")).toBe("Pago a Parceiro de Teste · 23/11");
    expect(pagamentoCombinadoDiretamente("Parceiro de Teste")).toBe("Pagamento combinado diretamente com Parceiro de Teste");
    expect(perguntaAoParceiro(430.5, "mbway")).toBe("O cliente diz que lhe pagou 430,50 € por MB WAY. Recebeu?");
  });

  it("os botões do parceiro: «Sim, recebi» / «Ainda não recebi», ou «O cliente já me pagou»", () => {
    const base = { regimeIva: "normal", regimeIvaConfirmadoEm: T0, taxaCliente: "0", taxaProfissional: "0.1" };
    const disse = pagamentoRegistadoParaOParceiro({ ...base, clienteDisseQuePagouEm: T0, formaDita: "mbway" }, 350);
    expect(disse.botoes.map((b) => b.texto)).toEqual(["Sim, recebi", "Ainda não recebi"]);
    expect(disse.texto).toMatch(/^O cliente diz que lhe pagou .* por MB WAY\. Recebeu\?$/);
    const nada = pagamentoRegistadoParaOParceiro(base, 350);
    expect(nada.botoes.map((b) => b.texto)).toEqual(["O cliente já me pagou"]);
    const pago = pagamentoRegistadoParaOParceiro({ ...base, parceiroConfirmouEm: T1 }, 350);
    expect(pago.botoes).toEqual([]);
    expect(pago.texto).toBe("Pago · 23/11");
  });
});

describe("d3 — o que o cliente vê no bloco «Pagar a …»", () => {
  it("por pagar: IBAN e MB WAY à vista e o botão «Já paguei a …»", async () => {
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(v.paraPagar?.iban).toBe("PT50000000000000000000000");
    expect(v.paraPagar?.mbway).toBe("nº de teste");
    expect(v.registo.estado).toBe("por_pagar");
    expect(v.registo.podeDizerQuePagou).toBe(true);
    expect(v.registo.botao).toBe("Já paguei a Parceiro de Teste");
    expect(v.opcoes.length).toBeGreaterThan(0);
  });

  it("o cliente disse que pagou: os dados ficam, espera pelo parceiro", async () => {
    registo.linha = { clienteDisseQuePagouEm: T0, formaDita: "transferencia" };
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(v.registo.estado).toBe("cliente_disse");
    expect(v.registo.texto).toContain("à espera de que ele confirme");
    expect(v.paraPagar?.iban).toBe("PT50000000000000000000000");
  });

  it("com o «Recebi»: «Pago a …», sem IBAN nem MB WAY, sem formas de pagar", async () => {
    registo.linha = { clienteDisseQuePagouEm: T0, formaDita: "transferencia", parceiroConfirmouEm: T1 };
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(v.registo.pago).toBe(true);
    expect(v.paraPagar?.iban).toBeNull();
    expect(v.paraPagar?.mbway).toBeNull();
    expect(v.paraPagar?.titular).toBeNull();
    expect(v.semDados).toBe("Pago a Parceiro de Teste · 23/11");
    expect(v.opcoes).toEqual([]);
    expect(v.registo.podeDizerQuePagou).toBe(false);
  });

  it("pedido concluído sem registo: os dados saem e fica «Pagamento combinado diretamente com …»", async () => {
    registo.pedidoStatus = "concluido";
    const v = await oQueOClienteVeDoParceiro(trabalho);
    expect(dadosDePagamentoSaem(v.registo)).toBe(true);
    expect(v.paraPagar?.iban).toBeNull();
    expect(v.semDados).toBe("Pagamento combinado diretamente com Parceiro de Teste");
  });
});

describe("d3 — as guardas e as portas", () => {
  const base = ler("src/lib/pagamento-registado-na-base.ts");

  it("cada escrita é um UPDATE com as guardas (acordada, pedido aberto, sem «Recebi» já dado)", () => {
    expect(base.match(/estado = 'acordada'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(base.match(/parceiroConfirmouEm IS NULL/g)?.length).toBeGreaterThanOrEqual(3);
    expect(base).toContain("status NOT IN ('cancelado','arquivado')");
    // «Ainda não recebi» só depois de o cliente dizer que pagou; «Recebi» só do parceiro do trabalho.
    expect(base).toContain("clienteDisseQuePagouEm IS NOT NULL");
    expect(base).toMatch(/providerId = \?/);
  });

  it("o cliente age pela mesma função em todas as portas; a acção é só do cliente", () => {
    const agir = ler("src/lib/agir-como-cliente.ts");
    expect(agir).toContain('"ja_paguei"');
    expect(agir).toContain("dizerQueJaPagou({ pedidoId, negociacaoId, forma: corpo.forma");
    expect(ler("src/app/api/pagamentos/ao-parceiro/route.ts")).toContain("dizerQueJaPagou({");
  });

  it("o parceiro responde só no trabalho dele, com a sessão", () => {
    const rota = ler("src/app/api/profissionais/trabalho/pagamento/route.ts");
    expect(rota).toContain("sessaoActivaDoProfissional");
    expect(rota).toContain("Number(n.providerId) !== sessao.providerId");
  });

  it("a migração é aditiva (as quatro colunas) e a Mesa e o pago-ao-profissional leem o registo", () => {
    const db = ler("src/lib/db.ts");
    for (const c of ["clienteDisseQuePagouEm DATETIME", "formaDita VARCHAR(20)", "parceiroConfirmouEm DATETIME", "parceiroNegouEm DATETIME"]) {
      expect(db).toContain(`ALTER TABLE negociacoes ADD COLUMN ${c}`);
    }
    expect(ler("src/app/api/admin/pagamentos/pago-ao-profissional/route.ts")).toContain("l.parceiroConfirmouEm == null");
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("pagamentoRegistado");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("SELO_PAGAMENTO_EM_DUVIDA");
  });

  it("a app de cliente lê o «pago» do registo", () => {
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("pago: aoParceiro ? aoParceiro.registo.pago");
  });
});
