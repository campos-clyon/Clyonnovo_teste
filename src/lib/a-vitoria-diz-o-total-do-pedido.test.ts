import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoParaOAssistente } from "./db";

/**
 * D17 — A VITÓRIA DIZ O MESMO TOTAL DO PEDIDO (CEO e dono, 13-11-2026).
 *
 * No modelo de 15-11 o total depende do regime do parceiro, e o cartão, o bloco
 * «Pagar a …», o email e a app tiram-no de `totalAoClienteDaNegociacao`. A
 * Vitória fazia a conta antiga: a um parceiro isento dizia 430,50 € onde o
 * pedido mostrava 358,05 €. O teste da conversa: a proposta e a aceitação pelo
 * WhatsApp, e as novidades do assistente, com um parceiro isento e com um com
 * IVA, dizem o número da conta do Site — e quem passa a fatura. Antes de 15-11
 * nada muda. Nomes e números INVENTADOS; nenhuma mensagem sai (o envio é falso).
 */

const DIA_16 = "2026-11-16T10:00:00Z";
const DIA_13 = "2026-11-13T10:00:00Z";
const TELEFONE = "351910000007";

let perfil: { regimeIva: string; regimeIvaConfirmadoEm: string | null };
let linhaNaBase: Record<string, unknown> = {};
const enviados: string[] = [];

function negociacao(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 900,
    pedidoId: 800,
    providerId: 31,
    estado: "aberta",
    valorAcordado: null,
    propostasJson: JSON.stringify([{ por: "profissional", valor: 350, criadaEm: "2026-11-16T09:00:00Z", estado: "pendente" }]),
    taxaCliente: "0",
    taxaProfissional: "0.1000",
    formaDePagamento: "na_plataforma",
    createdAt: "2026-11-16T08:00:00Z",
    ofertaClyon: null,
    regimeDoProfissional: null,
    profissionalNome: "Telmo Exemplo",
    profissionalTelefone: null,
    regimeIva: perfil.regimeIva,
    regimeIvaConfirmadoEm: perfil.regimeIvaConfirmadoEm,
    guiaVerificadaEm: null,
    emiteGuiaTransporte: 0,
    ...extra,
  };
}

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  negociacoesDoPedido: vi.fn(async () => [linhaNaBase]),
  getSimulatorOrderById: vi.fn(async () => ({ id: 800, baseDoPreco: "total" })),
  assistentePode: vi.fn(async () => true),
  reservarAvisoDoAssistente: vi.fn(async () => ({ id: 1, jaExistia: false })),
  guardarTextoDoAviso: vi.fn(async () => {}),
  libertarAvisoDoAssistente: vi.fn(async () => {}),
}));
vi.mock("@/lib/pagamentos-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/pagamentos-na-base")>()),
  pagamentosDaNegociacao: vi.fn(async () => []),
}));
vi.mock("@/lib/whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-cloud")>()),
  enviarBotoesWhatsApp: vi.fn(async (_t: string, texto: string) => {
    enviados.push(texto);
    return true;
  }),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    enviados.push(texto);
    return true;
  }),
}));

import { totalAoClienteDaNegociacao } from "./total-ao-cliente";
import { aceitacaoParaOWhatsApp, propostaParaOWhatsApp } from "./whatsapp-negociacao";
import { novidadesDoPedido } from "./assistente-automatico";
import { quemPassaAFatura, totalEmPalavrasDoNovoModelo } from "./o-total-da-vitoria";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

const ISENTO = { regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-12T10:00:00Z" };
const COM_IVA = { regimeIva: "normal", regimeIvaConfirmadoEm: "2026-11-12T10:00:00Z" };

// A primeira mensagem carrega o cérebro inteiro (imports dinâmicos): com a máquina carregada passa dos 5 s.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  enviados.length = 0;
});
afterEach(() => {
  delete process.env.NOVO_MODELO_DATA_SIMULADA;
});

describe("a conta é a do Site — 350 € a 0 % + 10 %", () => {
  it("isento 358,05 €, com IVA 430,50 €", () => {
    perfil = ISENTO;
    expect(totalAoClienteDaNegociacao(negociacao(), 350)?.total).toBe(358.05);
    perfil = COM_IVA;
    expect(totalAoClienteDaNegociacao(negociacao(), 350)?.total).toBe(430.5);
  });

  it("quem passa a fatura: a frase do email, pelo regime congelado ou pelo perfil", () => {
    perfil = ISENTO;
    expect(quemPassaAFatura(negociacao())).toBe("Fatura com isenção de IVA (art. 53.º), passada pelo parceiro.");
    perfil = COM_IVA;
    expect(quemPassaAFatura(negociacao())).toBe("Fatura com IVA, passada pelo parceiro.");
    // O congelado ao contratar manda sobre o perfil.
    expect(quemPassaAFatura(negociacao({ regimeDoProfissional: "isento" }))).toMatch(/art\. 53\.º/);
  });

  it("o sem IVA nunca sozinho, e com o isento não se diz «23 %» sobre o total", () => {
    perfil = ISENTO;
    const t = totalAoClienteDaNegociacao(negociacao(), 350)!;
    const frase = totalEmPalavrasDoNovoModelo(t, negociacao());
    expect(frase).toContain("com IVA incluído");
    expect(frase).toContain(`${euros(t.semIva)} sem IVA, e o IVA incluído, ${euros(t.iva)}, é só o da taxa da plataforma`);
    expect(frase).not.toContain("23");
  });
});

describe("o teste da conversa — a proposta e a aceitação pelo WhatsApp", () => {
  for (const [nome, p] of [
    ["isento", ISENTO],
    ["com IVA", COM_IVA],
  ] as const) {
    it(`desde 15-11, parceiro ${nome}: a proposta diz o total de totalAoClienteDaNegociacao`, async () => {
      process.env.NOVO_MODELO_DATA_SIMULADA = DIA_16;
      perfil = p;
      linhaNaBase = negociacao();
      const t = totalAoClienteDaNegociacao(linhaNaBase, 350)!;
      const saiu = await propostaParaOWhatsApp({
        telefone: TELEFONE,
        pedidoId: 800,
        negociacaoId: 900,
        profissionalNome: "Telmo Exemplo",
        valor: 350,
        servico: "recolha_moveis",
        base: "total",
      });
      expect(saiu).toBe(true);
      const texto = enviados.at(-1)!;
      expect(texto).toContain(`propõe ${euros(t.total)}`);
      expect(texto).toContain(euros(t.semIva));
      expect(texto).toContain(quemPassaAFatura(linhaNaBase));
      if (nome === "isento") expect(texto).not.toContain("430,50");
    });

    it(`desde 15-11, parceiro ${nome}: a aceitação diz o mesmo total`, async () => {
      process.env.NOVO_MODELO_DATA_SIMULADA = DIA_16;
      perfil = p;
      linhaNaBase = negociacao({
        estado: "aguarda_contratacao",
        valorAcordado: "350.00",
        propostasJson: JSON.stringify([{ por: "cliente", valor: 350, criadaEm: "2026-11-16T09:00:00Z", estado: "aceite" }]),
      });
      const t = totalAoClienteDaNegociacao(linhaNaBase, 350)!;
      await aceitacaoParaOWhatsApp({
        telefone: TELEFONE,
        pedidoId: 800,
        negociacaoId: 900,
        profissionalNome: "Telmo Exemplo",
        valor: 350,
        base: "total",
      });
      const texto = enviados.at(-1)!;
      expect(texto).toContain(`aceitou os ${euros(t.total)}`);
      expect(texto).toContain(quemPassaAFatura(linhaNaBase));
    });
  }

  it("antes de 15-11 nada muda: o isento ouve a conta de sempre, sem a frase da fatura", async () => {
    process.env.NOVO_MODELO_DATA_SIMULADA = DIA_13;
    perfil = ISENTO;
    linhaNaBase = negociacao({ createdAt: "2026-11-13T08:00:00Z" });
    await propostaParaOWhatsApp({
      telefone: TELEFONE,
      pedidoId: 800,
      negociacaoId: 900,
      profissionalNome: "Telmo Exemplo",
      valor: 350,
      servico: "recolha_moveis",
      base: "total",
    });
    const texto = enviados.at(-1)!;
    expect(texto).toContain("propõe 430,50 €");
    expect(texto).not.toMatch(/art\. 53/);
  });

  it("um Trabalho CLYON aberto fica no modelo antigo", async () => {
    process.env.NOVO_MODELO_DATA_SIMULADA = DIA_16;
    perfil = ISENTO;
    linhaNaBase = negociacao({ ofertaClyon: "1" });
    await propostaParaOWhatsApp({
      telefone: TELEFONE,
      pedidoId: 800,
      negociacaoId: 900,
      profissionalNome: "Telmo Exemplo",
      valor: 350,
      servico: "recolha_moveis",
      base: "total",
    });
    expect(enviados.at(-1)!).toContain("propõe 430,50 €");
  });
});

describe("as novidades do assistente — o mesmo total", () => {
  const TARDE = new Date("2026-11-16T14:00:00Z");
  function pedido(neg: Partial<PedidoParaOAssistente["negociacoes"][number]>): PedidoParaOAssistente {
    return {
      id: 800,
      contactName: "Ana Exemplo",
      contactPhone: TELEFONE,
      serviceType: "recolha_moveis",
      status: "atribuido",
      createdAt: new Date("2026-11-15T09:00:00Z"),
      dataAgendada: null,
      negociacoes: [
        {
          id: 900,
          estado: "aberta",
          valorAcordado: null,
          propostasJson: JSON.stringify([{ por: "profissional", valor: 350, criadaEm: "2026-11-16T13:00:00Z", estado: "pendente" }]),
          execucaoEnviadaEm: null,
          confirmadoEm: null,
          pagoEm: null,
          dataCombinada: null,
          avaliadoEm: null,
          profissionalNome: "Telmo Exemplo",
          regimeIva: "isento",
          regimeIvaConfirmadoEm: "2026-11-12T10:00:00Z",
          actualizadaEm: new Date("2026-11-16T13:00:00Z"),
          criadaEm: new Date("2026-11-15T10:00:00Z"),
          taxaCliente: "0",
          taxaProfissional: "0.1000",
          formaDePagamento: "na_plataforma",
          noNovoModelo: true,
          ...neg,
        },
      ],
    };
  }
  const texto = (p: PedidoParaOAssistente, especie: string) =>
    novidadesDoPedido(p, TARDE).find((n) => n.especie === especie)?.texto ?? "";

  it("a proposta nova e o fecho: 358,05 € com o isento, 430,50 € com IVA", () => {
    expect(texto(pedido({}), "proposta_nova")).toContain("358,05 €");
    expect(texto(pedido({}), "proposta_nova")).toMatch(/art\. 53\.º/);
    expect(texto(pedido({ regimeIva: "normal" }), "proposta_nova")).toContain("430,50 €");
    const fechado = { estado: "acordada", valorAcordado: "350.00" };
    const f = texto(pedido({ ...fechado, regimeDoProfissional: "isento" }), "fechado");
    expect(f).toContain("358,05 €");
    expect(f).toMatch(/art\. 53\.º/);
    expect(f).not.toContain("430,50");
  });

  it("sem a marca do servidor, a conta de sempre", () => {
    expect(texto(pedido({ noNovoModelo: false }), "proposta_nova")).toContain("430,50 €");
  });
});
