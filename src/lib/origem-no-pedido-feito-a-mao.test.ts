import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d8 (a), 12-11-2026 — o pedido criado À MÃO pela equipa a partir de uma
 * conversa do WhatsApp herda o código de origem da conversa («(A1)»), como o
 * que a Vitória regista (d4). Sem código, ou sem conversa, não se inventa.
 */

const conversa = vi.hoisted(() => ({
  mensagens: [] as Array<{ direccao: string; texto: string; criadoEm: string; haSegundos: number | null }>,
}));

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "Pessoa de Teste" } })),
}));
vi.mock("@/lib/assistentes", () => ({ assumirPedidoSeLivre: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({
  createSimulatorOrder: vi.fn(async () => 700),
  appendOrderHistory: vi.fn(async () => {}),
  taxasActuais: vi.fn(async () => undefined),
  mensagensDoNumeroWhatsApp: vi.fn(async () => conversa.mensagens),
  ligarRecolhaWhatsAppAoPedido: vi.fn(async () => {}),
  anexarFotosPendentesAoPedido: vi.fn(async () => 0),
}));
vi.mock("@/lib/geocodificar", () => ({
  geocodificarMoradaDetalhado: vi.fn(async () => ({ coords: null, estado: "SEM_CHAVE" })),
  geocodificarLocalidade: vi.fn(async () => null),
}));
vi.mock("@/lib/campos-do-servico", () => ({
  camposDoServico: vi.fn(async () => ({ paraOJson: {}, paraOMotor: {} })),
}));
vi.mock("@/lib/pricing-helper", () => ({
  calculateFastEstimate: vi.fn(async () => {
    throw new Error("sem motor no teste");
  }),
}));
vi.mock("@/lib/distribuir-pedido", () => ({ avaliarAlcance: vi.fn(async () => null) }));
vi.mock("@/lib/whatsapp-cloud", () => ({ enviarTextoWhatsApp: vi.fn(async () => false) }));
vi.mock("@/lib/whatsapp-recolha", () => ({ mensagemDePedidoRegistado: vi.fn(() => "ok") }));

import * as db from "@/lib/db";
import { POST } from "@/app/api/admin/pedidos/criar/route";
import { canalDoPedido } from "./canal-do-pedido";

const msg = (direccao: "in" | "out", texto: string) => ({ direccao, texto, criadoEm: "2026-11-12 10:00:00", haSegundos: 60 });

function pedido(corpo: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/pedidos/criar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceType: "recolha_moveis",
      address: "Rua Inventada 1",
      city: "Almada",
      contactName: "Cliente Teste",
      contactPhone: "912345678",
      ...corpo,
    }),
  }) as never;
}

function rawDoPedidoCriado(): Record<string, unknown> {
  const linha = vi.mocked(db.createSimulatorOrder).mock.calls.at(-1)?.[0] as unknown as { rawOrderJson: string };
  return JSON.parse(linha.rawOrderJson) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  conversa.mensagens = [];
});

describe("o pedido feito à mão a partir de uma conversa herda a origem (d8)", () => {
  it("conversa com «(A1)»: o pedido guarda o código e o canal é o anúncio", async () => {
    conversa.mensagens = [msg("in", "Olá! Gostava de pedir um orçamento à CLYON. (A1)"), msg("out", "Olá!")];
    const r = await POST(pedido({ recolhaWhatsApp: "351912345678" }));
    expect(r.status).toBeLessThan(300);
    const raw = rawDoPedidoCriado();
    expect(raw.origemPedido).toBe("whatsapp");
    expect(raw.codigoDeOrigem).toBe("A1");
    expect(canalDoPedido(JSON.stringify(raw))).toBe("Anúncio do Google");
  });

  it("conversa escrita à mão, sem código: não se inventa origem", async () => {
    conversa.mensagens = [msg("in", "Boa tarde, preciso de levar um colchão")];
    await POST(pedido({ recolhaWhatsApp: "351912345678" }));
    expect(rawDoPedidoCriado()).not.toHaveProperty("codigoDeOrigem");
  });

  it("sem conversa (pedido do telefone): nem se lê o WhatsApp", async () => {
    await POST(pedido({}));
    expect(db.mensagensDoNumeroWhatsApp).not.toHaveBeenCalled();
    expect(rawDoPedidoCriado()).not.toHaveProperty("codigoDeOrigem");
  });

  it("se a conversa não se ler, o pedido cria-se na mesma", async () => {
    vi.mocked(db.mensagensDoNumeroWhatsApp).mockRejectedValueOnce(new Error("base em baixo"));
    await POST(pedido({ recolhaWhatsApp: "351912345678" }));
    expect(db.createSimulatorOrder).toHaveBeenCalled();
    expect(rawDoPedidoCriado()).not.toHaveProperty("codigoDeOrigem");
  });
});
