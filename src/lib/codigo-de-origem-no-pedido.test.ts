import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * O CÓDIGO DE ORIGEM PASSA DA CONVERSA PARA O PEDIDO — 31-10-2026 (d4).
 *
 * O «(A1)» que o botão do site põe na mensagem do WhatsApp ficava só na
 * conversa: o pedido criado pela Vitória não sabia se a pessoa tinha vindo de
 * um anúncio, e o custo por trabalho pago do Ads não se podia contar. Agora
 * vai para o rawOrderJson (`codigoDeOrigem`) e o cartão do pedido diz-o, como
 * o canal dos pedidos do simulador.
 */

const conversa = vi.hoisted(() => ({
  mensagens: [] as Array<{ direccao: string; texto: string; criadoEm: string; haSegundos: number | null }>,
}));

vi.mock("./db", () => ({
  createSimulatorOrder: vi.fn(async () => 600),
  appendOrderHistory: vi.fn(async () => {}),
  contarFotosPendentesWhatsApp: vi.fn(async () => 0),
  anexarFotosPendentesAoPedido: vi.fn(async () => 0),
  taxasActuais: vi.fn(async () => undefined),
  mensagensDoNumeroWhatsApp: vi.fn(async () => conversa.mensagens),
}));
vi.mock("./geocodificar", () => ({
  geocodificarMoradaDetalhado: vi.fn(async () => ({ coords: null })),
  geocodificarLocalidade: vi.fn(async () => null),
}));
vi.mock("./descricao-do-pedido-na-base", () => ({
  fontesDoPedidoRegistado: vi.fn(async () => {}),
  depoisDaResposta: vi.fn(async () => {}),
  reescreverADescricao: vi.fn(async () => {}),
}));

import * as db from "./db";
import { registarPedidoDaRecolha } from "./registar-pedido-por-whatsapp";
import { canalDoPedido, origemDoCodigoDoPedido } from "./canal-do-pedido";

const msg = (direccao: "in" | "out", texto: string) => ({ direccao, texto, criadoEm: "2026-10-31 10:00:00", haSegundos: 60 });

function rawDoPedidoCriado(): Record<string, unknown> {
  const linha = vi.mocked(db.createSimulatorOrder).mock.calls.at(-1)?.[0] as unknown as { rawOrderJson: string };
  return JSON.parse(linha.rawOrderJson) as Record<string, unknown>;
}

const dados = { serviceType: "recolha_moveis", address: "Rua Inventada 1", city: "Almada", contactName: "Cliente Teste" };

beforeEach(() => {
  vi.clearAllMocks();
  conversa.mensagens = [];
});

describe("o código de origem chega ao pedido (d4)", () => {
  it("a conversa veio de um anúncio («(A1)»): o pedido guarda-o, e o cartão diz «Anúncio do Google»", async () => {
    conversa.mensagens = [
      msg("in", "Olá! Gostava de pedir um orçamento à CLYON. (A1)"),
      msg("out", "Olá! Sou a Vitória."),
      msg("in", "Um sofá e um armário"),
    ];
    await registarPedidoDaRecolha("351912345678", dados as never);
    const raw = rawDoPedidoCriado();
    expect(raw.origemPedido).toBe("whatsapp");
    expect(raw.codigoDeOrigem).toBe("A1");
    const json = JSON.stringify(raw);
    expect(canalDoPedido(json)).toBe("Anúncio do Google");
    expect(origemDoCodigoDoPedido(json)).toMatch(/^Anúncio do Google · /);
  });

  it("escrita à mão, sem código: o pedido não inventa origem", async () => {
    conversa.mensagens = [msg("in", "Boa tarde, preciso de levar um colchão")];
    await registarPedidoDaRecolha("351912345678", dados as never);
    const raw = rawDoPedidoCriado();
    expect(raw).not.toHaveProperty("codigoDeOrigem");
    expect(canalDoPedido(JSON.stringify(raw))).toBeNull();
  });

  it("se a conversa não se ler, o pedido regista-se na mesma, sem código", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.mensagensDoNumeroWhatsApp).mockRejectedValueOnce(new Error("base em baixo"));
    const r = await registarPedidoDaRecolha("351912345678", dados as never);
    expect(r.id).toBe(600);
    expect(rawDoPedidoCriado()).not.toHaveProperty("codigoDeOrigem");
  });

  it("o canal da visita no site ganha ao código, e um código falso não conta", () => {
    expect(canalDoPedido(JSON.stringify({ origemDaVisita: { gclid: "x" }, codigoDeOrigem: "F2" }))).toBe("Google Ads");
    expect(canalDoPedido(JSON.stringify({ codigoDeOrigem: "Z9" }))).toBeNull();
    expect(canalDoPedido(JSON.stringify({ codigoDeOrigem: "G2" }))).toBe("Pesquisa no Google (sem anúncio)");
  });
});
