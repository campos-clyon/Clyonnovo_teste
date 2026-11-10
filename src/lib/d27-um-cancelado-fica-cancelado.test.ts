import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * UM PEDIDO CANCELADO FICA CANCELADO — 10-11-2026 (d27).
 *
 * Quatro portas do backoffice que mandavam um pedido a alguém sem ler o estado
 * dele: redistribuir, enviar aos parceiros da Mesa (promover), oferecer a
 * valor fixo e aprovar o orçamento. Num pedido cancelado, arquivado ou
 * rejeitado, cada uma reabria-o e avisava alguém — os parceiros, ou o cliente
 * por email.
 *
 * As rotas correm aqui a sério; da base e dos avisos só se fingem as funções
 * que elas chamam, e conta-se tudo o que escreveram e a quem avisaram.
 */

type Linha = Record<string, unknown>;

const base = vi.hoisted(() => ({
  pedido: null as Record<string, unknown> | null,
  negs: [] as Array<Record<string, unknown>>,
  pagamentos: [] as Array<{ negociacaoId: number; estado: string; metodo: string; valor: number }>,
  // O que `gravarNegociacao` responde quando leva o estado que se leu.
  gravar: { ok: true, encerradas: 0 } as Record<string, unknown>,
  aprovou: true,
  // O que ficou escrito e quem foi avisado.
  escritas: [] as Array<[string, ...unknown[]]>,
  avisos: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getSimulatorOrderById: vi.fn(async () => base.pedido),
  negociacoesDoPedido: vi.fn(async () => base.negs),
  gravarNegociacao: vi.fn(async (id: number, dados: Linha, seAinda?: Linha) => {
    base.escritas.push(["gravarNegociacao", id, dados.estado, seAinda ?? null]);
    return seAinda ? base.gravar : { ok: true, encerradas: 0 };
  }),
  appendOrderHistory: vi.fn(async (_id: number, e: { message: string }) => {
    base.escritas.push(["historico", e.message]);
  }),
  promoverPedidoAPlataforma: vi.fn(async (id: number) => {
    base.escritas.push(["promover", id]);
    return true;
  }),
  marcarPedidoComoOfertaClyon: vi.fn(async (id: number) => {
    base.escritas.push(["ofertaClyon", id]);
  }),
  prepararAMudancaDeTipo: vi.fn(async (id: number) => {
    base.escritas.push(["mudarDeTipo", id]);
    return { ok: true, tinham: [] };
  }),
  approveSimulatorOrder: vi.fn(async (id: number, dados: { precoFinal: number }) => {
    base.escritas.push(["aprovar", id, dados.precoFinal]);
    return base.aprovou;
  }),
  updateSimulatorOrder: vi.fn(async (id: number, dados: Linha) => {
    base.escritas.push(["actualizar", id, dados.status]);
  }),
  setOrcamentoToken: vi.fn(async () => "b".repeat(64)),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "a equipa", isAdmin: true, papel: "admin" } })),
}));
vi.mock("@/lib/assistentes", () => ({
  assumirPedidoSeLivre: vi.fn(async (id: number) => {
    base.escritas.push(["assumir", id]);
  }),
}));
vi.mock("@/lib/distribuir-pedido", () => ({
  distribuirPedido: vi.fn(async (p: { id: number }) => {
    base.avisos.push(["distribuir", p.id]);
    return { receberam: 2 };
  }),
  resumoDaDistribuicao: vi.fn(() => "Chegou a 2."),
}));
vi.mock("@/lib/coordenadas-do-pedido", () => ({
  coordenadasDoPedido: vi.fn(async () => ({ lat: 38.7, lng: -9.1 })),
}));
vi.mock("@/lib/pagamentos-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/pagamentos-na-base")>()),
  pagamentosQuePrendem: vi.fn(async () => base.pagamentos),
}));
vi.mock("@/lib/email-pedido", () => ({
  enviarLinkDoPedido: vi.fn(async (d: { pedidoId: number }) => {
    base.avisos.push(["email-link", d.pedidoId]);
    return true;
  }),
}));
vi.mock("@/lib/email-orcamento", () => ({
  sendOrcamentoEmail: vi.fn(async (d: { orderId: number; precoFinal: number }) => {
    base.avisos.push(["email-orcamento", d.orderId, d.precoFinal]);
  }),
}));
vi.mock("@/lib/avisos-do-backoffice", () => ({
  avisarCliente: vi.fn(async (id: number, tipo: string) => {
    base.avisos.push(["cliente", id, tipo]);
  }),
  avisarProfissional: vi.fn(async () => {}),
  avisarProfissionaisDoPedido: vi.fn(async () => {}),
}));
vi.mock("@/lib/pricing-helper", async (original) => ({
  ...(await original<typeof import("@/lib/pricing-helper")>()),
  getActivePricingMap: vi.fn(async () => ({})),
}));

import { taxaPeloValor } from "@/lib/oferta-clyon";
import { JA_FOI_DECIDIDO } from "@/lib/ja-foi-decidido";
import { ESTADOS_QUE_TIRAM_DOS_PROS, PEDIDO_ARRUMADO_NAO_SE_ENVIA } from "@/lib/pedido-arrumado";

type Rota = (req: NextRequest, ctx?: never) => Promise<Response>;
let redistribuir: Rota;
let promover: Rota;
let oferecer: Rota;
let aprovar: Rota;
let aprovarPeloId: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  ({ POST: redistribuir } = (await import("@/app/api/admin/negociacoes/redistribuir/route")) as unknown as { POST: Rota });
  ({ POST: promover } = (await import("@/app/api/admin/negociacoes/promover/route")) as unknown as { POST: Rota });
  ({ POST: oferecer } = (await import("@/app/api/admin/trabalhos-clyon/route")) as unknown as { POST: Rota });
  ({ POST: aprovar } = (await import("@/app/api/admin/pedidos/approve/route")) as unknown as { POST: Rota });
  ({ POST: aprovarPeloId } = await import("@/app/api/admin/pedidos/[id]/approve/route"));
}, 120_000);

const PEDIDO = 900;
const pedido = (status: string | null, mais: Record<string, unknown> = {}) => ({
  id: PEDIDO,
  status,
  serviceType: "recolha",
  city: "Lisboa",
  description: "um sofá e uma mesa",
  contactEmail: "cliente@exemplo.pt",
  contactName: "Cliente do teste",
  valorDesejadoCliente: "120.00",
  estimateTotal: "147.60",
  distanceKm: "12",
  rawOrderJson: "{}",
  ...mais,
});
const neg = (id: number, estado: string, mais: Record<string, unknown> = {}) => ({
  id,
  pedidoId: PEDIDO,
  estado,
  profissionalNome: "o parceiro do teste",
  valorAcordado: estado === "acordada" ? "180.00" : null,
  propostasJson: "[]",
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  pagoEm: null,
  ...mais,
});

const pedir = (caminho: string, corpo: Record<string, unknown>) =>
  new NextRequest(`https://clyon.pt/api/admin/${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

const nomes = (lista: Array<[string, ...unknown[]]>) => lista.map(([n]) => n);

beforeEach(() => {
  base.pedido = pedido("pendente");
  base.negs = [];
  base.pagamentos = [];
  base.gravar = { ok: true, encerradas: 0 };
  base.aprovou = true;
  base.escritas = [];
  base.avisos = [];
});

// ── 4 ────────────────────────────────────────────────────────────────────────
describe("d27.4 — redistribuir, enviar aos parceiros e oferecer recusam um pedido arrumado", () => {
  const portas: Array<[string, () => Promise<Response>]> = [
    ["redistribuir", () => redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO }))],
    ["redistribuir com «reabrir»", () => redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, reabrir: true }))],
    ["redistribuir com «voltar a mandar»", () => redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, voltarAMandar: 41 }))],
    ["enviar aos parceiros (promover)", () => promover(pedir("negociacoes/promover", { pedidoId: PEDIDO, valor: 150 }))],
    ["oferecer a valor fixo", () => oferecer(pedir("trabalhos-clyon", { pedidoId: PEDIDO, valor: 300, taxa: taxaPeloValor(300) }))],
    [
      "oferecer a valor fixo, vindo de negociação",
      () => oferecer(pedir("trabalhos-clyon", { pedidoId: PEDIDO, valor: 300, taxa: taxaPeloValor(300), deNegociacao: true })),
    ],
  ];

  for (const status of ESTADOS_QUE_TIRAM_DOS_PROS) {
    for (const [nome, porta] of portas) {
      it(`${nome}, pedido «${status}»: 409, nada escrito e ninguém avisado`, async () => {
        base.pedido = pedido(status);
        // Como fica um pedido cancelado: as negociações encerradas, uma delas a que estava fechada.
        base.negs = [neg(41, "morta"), neg(42, "desistida")];
        const r = await porta();
        expect(r.status).toBe(409);
        expect((await r.json()).error).toBe(PEDIDO_ARRUMADO_NAO_SE_ENVIA);
        expect(base.escritas).toEqual([]);
        expect(base.avisos).toEqual([]);
      });
    }
  }

  it("um pedido vivo redistribui-se como sempre", async () => {
    base.negs = [neg(41, "aberta")];
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO }));
    expect(r.status).toBe(200);
    expect(base.avisos).toEqual([["distribuir", PEDIDO]]);
  });

  it("um pedido vivo envia-se aos parceiros como sempre", async () => {
    const r = await promover(pedir("negociacoes/promover", { pedidoId: PEDIDO, valor: 150 }));
    expect(r.status).toBe(200);
    expect(nomes(base.escritas)).toContain("promover");
    expect(nomes(base.avisos)).toContain("distribuir");
  });

  it("um pedido vivo oferece-se a valor fixo como sempre", async () => {
    const r = await oferecer(pedir("trabalhos-clyon", { pedidoId: PEDIDO, valor: 300, taxa: taxaPeloValor(300) }));
    expect(r.status).toBe(200);
    expect(nomes(base.escritas)).toContain("ofertaClyon");
    expect(nomes(base.avisos)).toContain("distribuir");
  });
});

// ── 4, o ponto vizinho da d26 ────────────────────────────────────────────────
describe("d27.4 — o «reabrir» da Mesa grava com o estado que leu", () => {
  it("leva a condição do estado e o pedido, como as outras portas", async () => {
    base.negs = [neg(41, "acordada")];
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, reabrir: true }));
    expect(r.status).toBe(200);
    expect(base.escritas[0]).toEqual(["gravarNegociacao", 41, "morta", { estado: "acordada", pedidoId: PEDIDO }]);
  });

  it("se alguém mexeu primeiro: 409 «já foi decidido», sem histórico e sem avisar ninguém", async () => {
    base.negs = [neg(41, "acordada")];
    base.gravar = { ok: false, porque: "ja_decidido" };
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, reabrir: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe(JA_FOI_DECIDIDO);
    expect(nomes(base.escritas)).toEqual(["gravarNegociacao"]);
    expect(base.avisos).toEqual([]);
  });

  it("o «voltar a mandar» também: a linha que se leu «desistida» só passa a «morta» se ainda o for", async () => {
    base.negs = [neg(42, "desistida")];
    await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, voltarAMandar: 42 }));
    expect(base.escritas[0]).toEqual(["gravarNegociacao", 42, "morta", { estado: "desistida", pedidoId: PEDIDO }]);

    base.escritas = [];
    base.avisos = [];
    base.gravar = { ok: false, porque: "ja_decidido" };
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, voltarAMandar: 42 }));
    expect(r.status).toBe(409);
    expect(base.avisos).toEqual([]);
  });
});

// ── a suspeita que se provou ─────────────────────────────────────────────────
describe("d27 — não se reabre um fecho com o pagamento do cliente cá dentro", () => {
  it("o cliente já pagou (o trabalho ainda nem foi feito): reabrir é recusado, nada muda", async () => {
    base.negs = [neg(41, "acordada")];
    base.pagamentos = [{ negociacaoId: 41, estado: "pago", metodo: "mbway", valor: 221.4 }];
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, reabrir: true }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ podeReabrir: false });
    expect(base.escritas).toEqual([]);
    expect(base.avisos).toEqual([]);
  });

  it("uma referência ainda por pagar não trava o reabrir", async () => {
    base.negs = [neg(41, "acordada")];
    base.pagamentos = [{ negociacaoId: 41, estado: "pendente", metodo: "multibanco", valor: 221.4 }];
    const r = await redistribuir(pedir("negociacoes/redistribuir", { pedidoId: PEDIDO, reabrir: true }));
    expect(r.status).toBe(200);
  });
});

// ── 5 ────────────────────────────────────────────────────────────────────────
describe("d27.5 — aprovar o orçamento confere o preço e o estado", () => {
  const portas: Array<[string, (corpo: Record<string, unknown>) => Promise<Response>]> = [
    ["/pedidos/approve", (corpo) => aprovar(pedir("pedidos/approve", { id: PEDIDO, ...corpo }))],
    [
      "/pedidos/[id]/approve",
      (corpo) => aprovarPeloId(pedir(`pedidos/${PEDIDO}/approve`, corpo), { params: Promise.resolve({ id: String(PEDIDO) }) }),
    ],
  ];

  for (const [nome, porta] of portas) {
    for (const precoFinal of ["abc", "-50", "0", "1e9", "12,5,3"]) {
      it(`${nome}: o preço «${precoFinal}» é recusado (400), nada escrito e nenhum email`, async () => {
        const r = await porta({ precoFinal });
        expect(r.status).toBe(400);
        expect(base.escritas).toEqual([]);
        expect(base.avisos).toEqual([]);
      });
    }

    for (const status of [...ESTADOS_QUE_TIRAM_DOS_PROS, "concluido"]) {
      it(`${nome}: pedido «${status}» não se aprova (409), nada escrito e nenhum email`, async () => {
        base.pedido = pedido(status);
        const r = await porta({ precoFinal: "200" });
        expect(r.status).toBe(409);
        expect(base.escritas).toEqual([]);
        expect(base.avisos).toEqual([]);
      });
    }

    it(`${nome}: o pedido fechou entre a leitura e a escrita — 409 e nenhum email`, async () => {
      base.aprovou = false;
      const lido = vi.mocked((await import("@/lib/db")).getSimulatorOrderById);
      lido.mockResolvedValueOnce(pedido("pendente") as never).mockResolvedValueOnce(pedido("cancelado") as never);
      const r = await porta({ precoFinal: "200" });
      expect(r.status).toBe(409);
      expect(base.avisos).toEqual([]);
    });

    it(`${nome}: um pedido que não existe é 404`, async () => {
      base.pedido = null;
      const r = await porta({ precoFinal: "200" });
      expect(r.status).toBe(404);
      expect(base.escritas).toEqual([]);
    });

    it(`${nome}: «350,50», com a vírgula de um teclado português, aprova por 350,50 €`, async () => {
      const r = await porta({ precoFinal: "350,50" });
      expect(r.status).toBe(200);
      expect(base.escritas).toContainEqual(["aprovar", PEDIDO, 350.5]);
      expect(nomes(base.avisos)).toEqual(["email-orcamento"]);
    });
  }

  it("/pedidos/[id]/approve sem preço (só o estado) também não reabre um cancelado", async () => {
    base.pedido = pedido("cancelado");
    const r = await aprovarPeloId(pedir(`pedidos/${PEDIDO}/approve`, {}), { params: Promise.resolve({ id: String(PEDIDO) }) });
    expect(r.status).toBe(409);
    expect(base.escritas).toEqual([]);
    expect(base.avisos).toEqual([]);
  });
});
