import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * AS ROTAS DA APP DE CLIENTE — R3 a R6 e R8 (d8, fase 2, 28-10-2026).
 *
 * Chamam as rotas a sério, com a base simulada. O que guardam:
 *
 *   · sem sessão de cliente, 401; com o token de um profissional, 401;
 *   · só os pedidos do email da sessão — o de outro cliente dá 404, igual a
 *     um que não existe;
 *   · a vista do pedido não leva nada do profissional nem interno: o valor
 *     dele, a taxa de quem quer que seja, quem não fez proposta, o telefone
 *     antes de contratado, o histórico da equipa;
 *   · o dinheiro sai em texto, com o mesmo número da página do pedido;
 *   · contratar avisa o profissional (email e telemóvel) por QUALQUER porta —
 *     o link do email, a conta e a app —, porque as três agem pela mesma
 *     `agirComoCliente`; cancelar não precisa de negociação.
 *
 * Os dados são de teste: nomes inventados, telemóvel 912 345 678.
 */

const execute = vi.fn();
const pedidos = new Map<number, Record<string, unknown>>();
const negociacoes = new Map<number, Array<Record<string, unknown>>>();

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureProvidersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({ execute })),
  withConnection: vi.fn(async (fn: (c: { execute: typeof execute }) => unknown) => fn({ execute })),
  getSimulatorOrderById: vi.fn(async (id: number) => pedidos.get(Number(id))),
  getSimulatorOrderByAcessoTokenHash: vi.fn(async (hash: string) =>
    [...pedidos.values()].find((p) => p.acessoTokenHash === hash),
  ),
  negociacaoPorTokenHash: vi.fn(async () => undefined),
  negociacoesDoPedido: vi.fn(async (id: number) => negociacoes.get(Number(id)) ?? []),
  gravarNegociacao: vi.fn(async () => {}),
  encerrarOutrasNegociacoes: vi.fn(async () => 0),
  appendOrderHistory: vi.fn(async () => {}),
  confirmarExecucao: vi.fn(async () => true),
  avaliarProfissional: vi.fn(async () => true),
  perfilDoProfissional: vi.fn(async () => ({ email: "pro.teste@exemplo.pt", name: "Profissional Teste" })),
  cancelarPedido: vi.fn(async () => ({ encerradas: 1 })),
  registarSemFalhar: vi.fn(async () => {}),
  savePushSubscription: vi.fn(async () => {}),
  deletePushSubscription: vi.fn(async () => {}),
  getPushSubscriptionsByEmail: vi.fn(async () => []),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({
  perfilPublicoDoProfissional: vi.fn(async () => ({
    nome: "Profissional Teste",
    slug: null,
    cidade: null,
    naClyonDesde: new Date("2026-03-10T10:00:00Z"),
    categorias: [],
    zonas: ["Lisboa"],
    raioKm: 30,
    emiteFatura: true,
    guiaVerificada: false,
    trabalhosConcluidos: 12,
    notaMedia: 4.8,
    quantasAvaliacoes: 5,
    avaliacoes: [],
  })),
}));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));
vi.mock("@/lib/email-trabalho", () => ({ avisarQueFoiContratado: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-por-push", () => ({ avisarProfissionalContratadoPorPush: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-da-proposta", () => ({ avisarDaProposta: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-confirmacao", () => ({ avisarProfissionalTrabalhoConfirmado: vi.fn(async () => {}) }));
vi.mock("@/lib/responder-ajuste", async (original) => {
  const m = await original<typeof import("@/lib/responder-ajuste")>();
  return { ...m, responderAoAjuste: vi.fn(async () => ({ status: 200, corpo: { ok: true, ajusteRespondido: true } })) };
});

import * as db from "@/lib/db";
import { getServerSession } from "next-auth";
import { limitarPorConta } from "@/lib/limite-rota-publica";
import { avisarQueFoiContratado } from "@/lib/email-trabalho";
import { avisarProfissionalContratadoPorPush } from "@/lib/avisar-por-push";
import { responderAoAjuste } from "@/lib/responder-ajuste";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { assinarSessaoDoProfissional } from "@/lib/profissional-auth";
import { hashDeToken } from "@/lib/pedido-acesso";
import { precoDoCliente } from "@/lib/preco-do-cliente";
import { negociacoesDaVistaDoCliente } from "@/lib/vista-do-pedido";
import { GET as listaDePedidos } from "@/app/api/cliente/pedidos/route";
import { GET as umPedido } from "@/app/api/cliente/pedidos/[id]/route";
import { POST as guardarTelemovel, DELETE as tirarTelemovel } from "@/app/api/cliente/dispositivo/route";
import { POST as avisoDeTeste } from "@/app/api/cliente/aviso-de-teste/route";
import { POST as agirNaConta } from "@/app/api/users/me/negociacao/route";
import { POST as agirPeloLink } from "@/app/api/negociacao/[token]/route";
import { GET as aMinhaConta } from "@/app/api/users/me/route";

const SEGREDO = "segredo-so-dos-testes-das-rotas-da-app-de-cliente";
const EMAIL = "cliente.teste@exemplo.pt";
const OUTRO = "outro.cliente@exemplo.pt";
const TOKEN_DO_LINK = "t".repeat(43);
const TELEFONE_DO_PRO = "912345678";

function pedido(url: string, o: { bearer?: string; corpo?: unknown; metodo?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.bearer !== undefined) headers.authorization = `Bearer ${o.bearer}`;
  return new NextRequest(`http://localhost${url}`, {
    method: o.metodo ?? "GET",
    headers,
    body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
  });
}

const comId = (id: string) => ({ params: Promise.resolve({ id }) });
const comToken = (token: string) => ({ params: Promise.resolve({ token }) });

/** Uma proposta do profissional, por responder. */
const propostaDoPro = (valor: number) =>
  JSON.stringify([{ por: "profissional", valor, estado: "pendente", criadaEm: "2026-10-27T10:00:00.000Z" }]);

function negociacao(o: Record<string, unknown>) {
  return {
    providerId: 7,
    estado: "aberta",
    valorAcordado: null,
    propostasJson: propostaDoPro(350),
    taxaCliente: "0.05",
    taxaProfissional: "0.06",
    formaDePagamento: null,
    createdAt: new Date("2026-10-20T10:00:00Z"),
    semFactura: 0,
    ofertaClyon: null,
    profissionalNome: "Profissional Teste",
    profissionalTelefone: TELEFONE_DO_PRO,
    regimeIva: "normal",
    guiaVerificadaEm: null,
    execucaoEnviadaEm: null,
    provaJson: null,
    confirmadoEm: null,
    pagoEm: null,
    ajustesJson: null,
    estrelas: null,
    dataCombinada: null,
    ...o,
  };
}

let tokenDoCliente = "";
let tokenDoOutro = "";

beforeAll(async () => {
  process.env.JWT_SECRET = SEGREDO;
  const umaHoraAtras = new Date(Date.now() - 3600_000);
  tokenDoCliente = (await assinarSessaoDoCliente(EMAIL, "link", umaHoraAtras)).token;
  tokenDoOutro = (await assinarSessaoDoCliente(OUTRO, "link", umaHoraAtras)).token;
});

beforeEach(() => {
  vi.clearAllMocks();
  pedidos.clear();
  negociacoes.clear();
  // O pedido do cliente: uma proposta (350 € do profissional) e um profissional que não disse nada.
  pedidos.set(482, {
    id: 482,
    serviceType: "recolha_moveis",
    city: "Lisboa",
    address: "Rua de Teste 1",
    status: "pendente",
    urgency: "this_week",
    description: "Um sofá e uma mesa.",
    filesJson: JSON.stringify([{ url: "https://exemplo.pt/foto-1.jpg" }]),
    contactEmail: EMAIL,
    contactPhone: "912 345 678",
    valorFixoClyon: null,
    baseDoPreco: null,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    acessoTokenHash: hashDeToken(TOKEN_DO_LINK),
    acessoTokenExpiraEm: new Date(Date.now() + 86_400_000),
    historyJson: JSON.stringify([
      { type: "message_to_client", message: "Pode mandar mais uma fotografia?", createdAt: "2026-10-26T10:00:00Z", by: { id: 3, nome: "Equipa", role: "admin" } },
      { type: "created", message: "Lucro da CLYON: nota interna", createdAt: "2026-10-26T10:05:00Z" },
    ]),
  });
  negociacoes.set(482, [
    negociacao({ id: 11 }),
    negociacao({ id: 12, providerId: 8, propostasJson: "[]", profissionalNome: "Sem Proposta Lda" }),
  ]);
  // O pedido de OUTRO cliente.
  pedidos.set(483, { ...pedidos.get(482), id: 483, contactEmail: OUTRO, acessoTokenHash: null });
  negociacoes.set(483, [negociacao({ id: 21 })]);
  // Um Trabalho CLYON do cliente: valor fixo 300 € (preço sem IVA), taxa 15 %, já com profissional.
  pedidos.set(484, {
    ...pedidos.get(482),
    id: 484,
    valorFixoClyon: "300.00",
    taxaClyon: "0.15",
    precoClienteClyon: null,
    // O preço já foi ao cliente (S7: antes disso, a R5 não o mostra).
    propostaEnviadaEm: new Date("2026-10-27T10:00:00Z"),
    acessoTokenHash: null,
  });
  negociacoes.set(484, [
    negociacao({
      id: 31,
      estado: "acordada",
      valorAcordado: "255.00",
      propostasJson: "[]",
      ofertaClyon: "distribuida",
      profissionalNome: "Empresa Teste",
    }),
  ]);

  execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (/FROM users/.test(sql)) return [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined];
    if (/COUNT\(\*\) AS total FROM simulatorOrders/.test(sql)) {
      return [[{ total: [...pedidos.values()].filter((p) => p.contactEmail === params[0]).length }], undefined];
    }
    if (/FROM simulatorOrders o/.test(sql)) {
      const meus = [...pedidos.values()].filter((p) => p.contactEmail === params[0]);
      return [meus.map((p) => ({ ...p, trabalhoClyon: p.valorFixoClyon != null ? 1 : 0 })), undefined];
    }
    if (/FROM negociacoes n/.test(sql)) {
      const ids = params.map(Number);
      return [ids.flatMap((id) => (negociacoes.get(id) ?? []).map((n) => ({ ...n, pedidoId: id }))), undefined];
    }
    return [[], undefined];
  });
});

describe("R4 — GET /api/cliente/pedidos", () => {
  it("sem sessão, 401; com o token de um profissional, 401", async () => {
    expect((await listaDePedidos(pedido("/api/cliente/pedidos"))).status).toBe(401);
    const dePro = await assinarSessaoDoProfissional(7, "Profissional Teste");
    expect((await listaDePedidos(pedido("/api/cliente/pedidos", { bearer: dePro }))).status).toBe(401);
  });

  it("só os pedidos do email da sessão, resumidos e sem dinheiro", async () => {
    const r = await listaDePedidos(pedido("/api/cliente/pedidos", { bearer: tokenDoCliente }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.pedidos.map((p: { id: number }) => p.id).sort()).toEqual([482, 484]);
    const p482 = j.pedidos.find((p: { id: number }) => p.id === 482);
    expect(p482).toMatchObject({
      servico: "Recolha de móveis",
      cidade: "Lisboa",
      estadoTexto: "Tem propostas",
      novidade: "1 proposta nova",
      trabalhoClyon: false,
    });
    const p484 = j.pedidos.find((p: { id: number }) => p.id === 484);
    expect(p484.estadoTexto).toBe("Contratado — Empresa Teste");
    expect(p484.novidade).toBeNull();
    const texto = JSON.stringify(j);
    for (const proibido of ["Sem Proposta", "Rua de Teste", "€", TELEFONE_DO_PRO, "taxa", "historyJson", "ofertaClyon"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
    for (const [sql, params] of execute.mock.calls) {
      if (/FROM simulatorOrders/.test(String(sql))) expect((params as unknown[])[0]).toBe(EMAIL);
    }
  });
});

describe("R5 — GET /api/cliente/pedidos/[id]", () => {
  it("sem sessão, 401", async () => {
    expect((await umPedido(pedido("/api/cliente/pedidos/482"), comId("482"))).status).toBe(401);
  });

  it("o pedido de outro cliente dá 404, igual a um que não existe", async () => {
    const deOutro = await umPedido(pedido("/api/cliente/pedidos/483", { bearer: tokenDoCliente }), comId("483"));
    const naoExiste = await umPedido(pedido("/api/cliente/pedidos/999", { bearer: tokenDoCliente }), comId("999"));
    expect(deOutro.status).toBe(404);
    expect(naoExiste.status).toBe(404);
    expect(await deOutro.json()).toEqual(await naoExiste.json());
    // E o dono vê-o.
    expect((await umPedido(pedido("/api/cliente/pedidos/483", { bearer: tokenDoOutro }), comId("483"))).status).toBe(200);
  });

  it("as mesmas negociações da página do pedido, e o mesmo dinheiro, em texto", async () => {
    const r = await umPedido(pedido("/api/cliente/pedidos/482", { bearer: tokenDoCliente }), comId("482"));
    expect(r.status).toBe(200);
    const j = await r.json();
    const daPagina = await negociacoesDaVistaDoCliente(pedidos.get(482) as never);
    expect(j.negociacoes.map((n: { id: number }) => n.id)).toEqual(daPagina.map((n) => n.id));
    expect(j.negociacoes.map((n: { id: number }) => n.id)).toEqual([11]);

    // O número que a página mostra: `precoDoCliente` com a taxa da negociação, no modelo dela.
    const conta = precoDoCliente(350, { cliente: 0.05, profissional: 0.06 }, "iva_incluido");
    const n = j.negociacoes[0];
    expect(n.preco.principal).toBe(`${conta.aPagar.toFixed(2).replace(".", ",")} € com IVA`);
    expect(n.preco.principal).toBe("452,03 € com IVA");
    expect(n.preco.detalhe).toBe("367,50 € + 84,53 € de IVA (23 %)");
    expect(n.preco.nota.length).toBeGreaterThan(10);
    expect(n.precoEtiqueta).toBe("proposta dele");
    expect(n.accoes).toEqual(expect.arrayContaining(["aceitar", "desistir"]));
    expect(n.profissional.telefone).toBeNull();
    expect(n.profissional.notaTexto).toBe("★ 4,8 · 5 avaliações");
    expect(n.profissional.naClyonDesdeTexto).toBe("março de 2026");
    expect(j.pedido).toMatchObject({ id: 482, servico: "Recolha de móveis", quando: "Esta semana", trabalhoClyon: false });
    expect(j.podeCancelar).toBe(true);
    // O histórico pela lista fechada, e de quem escreveu só o nome.
    expect(j.historico).toHaveLength(1);
    expect(j.historico[0]).toMatchObject({ type: "message_to_client", by: { nome: "Equipa" } });
  });

  it("nada do profissional nem interno chega à app", async () => {
    const j = await (await umPedido(pedido("/api/cliente/pedidos/482", { bearer: tokenDoCliente }), comId("482"))).json();
    const texto = JSON.stringify(j);
    for (const proibido of [
      "taxaProfissional",
      "taxaCliente",
      "ofertaClyon",
      "historyJson",
      "propostasJson",
      "valorAcordado",
      "\"propostas\"",
      "Sem Proposta",
      TELEFONE_DO_PRO,
      "350,00",
      "Lucro da CLYON",
      "\"role\"",
    ]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it("um Trabalho CLYON: nenhuma negociação, o preço da CLYON e quem faz — e nunca o que o profissional recebe", async () => {
    const j = await (await umPedido(pedido("/api/cliente/pedidos/484", { bearer: tokenDoCliente }), comId("484"))).json();
    expect(j.negociacoes).toEqual([]);
    expect(j.pedido.valorClyon.principal).toBe("369,00 € com IVA");
    expect(j.pedido.valorClyon.detalhe).toBe("300,00 € + 69,00 € de IVA (23 %)");
    expect(j.pedido.quemFaz).toBe("Empresa Teste");
    expect(j.podeCancelar).toBe(false);
    expect(j.historico).toEqual([]);
    const texto = JSON.stringify(j);
    expect(texto).not.toContain("255");
    expect(texto).not.toContain(TELEFONE_DO_PRO);
  });

  it("contratado: o telefone aparece; feito sem fotografias, o cliente confirma e o prazo corre (30-10-2026)", async () => {
    negociacoes.set(482, [
      negociacao({
        id: 11,
        estado: "acordada",
        valorAcordado: "350.00",
        execucaoEnviadaEm: new Date("2026-10-27T15:00:00Z"),
        provaJson: JSON.stringify({ fotos: [], nota: "" }),
      }),
    ]);
    const j = await (await umPedido(pedido("/api/cliente/pedidos/482", { bearer: tokenDoCliente }), comId("482"))).json();
    const n = j.negociacoes[0];
    expect(n.profissional.telefone).toBe(TELEFONE_DO_PRO);
    expect(n.porConfirmarPelaClyon).toBe(false);
    expect(n.diasAteLibertarTexto).not.toBeNull();
    expect(n.accoes).toEqual(["confirmar"]);
    expect(n.preco.principal).toBe("452,03 € com IVA");
    expect(n.execucaoEnviadaEmTexto).toBe("terça-feira, 27 de outubro, às 15:00");
    // A tabela única (S9): com ou sem fotografias, confirma o cliente.
    expect(j.pedido.estadoTexto).toBe("Por confirmar");
    expect(JSON.stringify(j)).not.toContain("valorAcordado");
  });
});

describe("R6 — /api/cliente/dispositivo", () => {
  const EXPO = "ExponentPushToken[abcdefghij1234]";

  it("sem sessão, 401", async () => {
    expect((await guardarTelemovel(pedido("/x", { metodo: "POST", corpo: { token: EXPO } }))).status).toBe(401);
    expect((await tirarTelemovel(pedido("/x", { metodo: "DELETE", corpo: { token: EXPO } }))).status).toBe(401);
  });

  it("grava o telemóvel com a app «cliente», pelo email da sessão", async () => {
    const r = await guardarTelemovel(pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { token: EXPO, email: OUTRO } }));
    expect(r.status).toBe(200);
    expect(db.savePushSubscription).toHaveBeenCalledWith(EMAIL, { endpoint: EXPO, p256dh: "", auth: "" }, "cliente");
  });

  it("um token que não é da Expo dá 400", async () => {
    const r = await guardarTelemovel(pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { token: "https://push.exemplo/abc" } }));
    expect(r.status).toBe(400);
  });

  it("tirar: só o telemóvel desta conta", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValueOnce([]);
    await tirarTelemovel(pedido("/x", { metodo: "DELETE", bearer: tokenDoCliente, corpo: { token: EXPO } }));
    expect(db.deletePushSubscription).not.toHaveBeenCalled();
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValueOnce([{ endpoint: EXPO, p256dh: "", auth: "", app: "cliente" }]);
    await tirarTelemovel(pedido("/x", { metodo: "DELETE", bearer: tokenDoCliente, corpo: { token: EXPO } }));
    expect(db.deletePushSubscription).toHaveBeenCalledWith(EXPO);
  });
});

describe("d5 — /api/cliente/aviso-de-teste diz se o aviso chegou, e porquê não", () => {
  const EXPO = "ExponentPushToken[abcdefghij1234]";
  afterEach(() => vi.unstubAllGlobals());

  it("sem sessão, 401", async () => {
    expect((await avisoDeTeste(pedido("/x", { metodo: "POST" }))).status).toBe(401);
  });

  it("sem telemóvel da app de cliente (só o da Pro no mesmo email), diz o que fazer", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValueOnce([{ endpoint: EXPO, p256dh: "", auth: "", app: "pro" }]);
    const r = await avisoDeTeste(pedido("/x", { metodo: "POST", bearer: tokenDoCliente }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("Avisos no telemóvel");
    expect(db.getPushSubscriptionsByEmail).toHaveBeenCalledWith(EMAIL);
  });

  it("entregue só com o recibo da Expo", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValueOnce([{ endpoint: EXPO, p256dh: "", auth: "", app: "cliente" }]);
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "ok", id: "recibo-1" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { "recibo-1": { status: "ok" } } })));
    vi.stubGlobal("fetch", pedir);
    const r = await avisoDeTeste(pedido("/x", { metodo: "POST", bearer: tokenDoCliente }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, entregue: true, telemoveis: 1 });
    const corpo = JSON.parse((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo[0]).toMatchObject({ to: EXPO, title: "Avisos ligados" });
  }, 15000);

  it("sem a chave FCM V1 no projecto clyon-cliente, diz isso mesmo", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValueOnce([{ endpoint: EXPO, p256dh: "", auth: "", app: "cliente" }]);
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "ok", id: "recibo-2" }] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { "recibo-2": { status: "error", details: { error: "InvalidCredentials" } } } })),
      );
    vi.stubGlobal("fetch", pedir);
    const r = await avisoDeTeste(pedido("/x", { metodo: "POST", bearer: tokenDoCliente }));
    expect(r.status).toBe(502);
    const corpo = await r.json();
    expect(corpo.codigo).toBe("InvalidCredentials");
    expect(corpo.error).toContain("clyon-cliente");
  }, 15000);
});

describe("R8 — as acções do cliente, pela mesma função em todas as portas", () => {
  beforeEach(() => {
    // O profissional aceitou o valor do cliente: falta o cliente contratar.
    negociacoes.set(482, [
      negociacao({
        id: 11,
        estado: "aguarda_contratacao",
        valorAcordado: "350.00",
        propostasJson: JSON.stringify([
          { por: "cliente", valor: 350, estado: "aceite", criadaEm: "2026-10-27T10:00:00.000Z" },
        ]),
      }),
    ]);
  });

  it("contratar pela app (conta, com Bearer) avisa o profissional por email e no telemóvel", async () => {
    const r = await agirNaConta(
      pedido("/api/users/me/negociacao", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "contratar", pedidoId: 482, negociacaoId: 11 } }),
    );
    expect(r.status).toBe(200);
    // A app recebe só o estado: o valor do profissional não lhe chega (relê a R5).
    expect(await r.json()).toEqual({ ok: true, estado: "acordada" });
    expect(avisarQueFoiContratado).toHaveBeenCalledTimes(1);
    expect(avisarProfissionalContratadoPorPush).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.appendOrderHistory).mock.calls.map((c) => c[1].message).join(" ")).toContain("na app");
  });

  it("contratar pelo link do email avisa da mesma maneira", async () => {
    const r = await agirPeloLink(
      pedido(`/api/negociacao/${TOKEN_DO_LINK}`, { metodo: "POST", corpo: { accao: "contratar", negociacaoId: 11 } }),
      comToken(TOKEN_DO_LINK),
    );
    expect(r.status).toBe(200);
    // Desde 28-10-2026 (d10) o site também recebe só o estado: volta a ler o pedido.
    expect(await r.json()).toEqual({ ok: true, estado: "acordada" });
    expect(avisarQueFoiContratado).toHaveBeenCalledTimes(1);
    expect(avisarProfissionalContratadoPorPush).toHaveBeenCalledTimes(1);
  });

  it("cancelar o pedido não precisa de negociação — na conta e no link", async () => {
    const conta = await agirNaConta(
      pedido("/api/users/me/negociacao", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "cancelar_pedido", pedidoId: 482, motivo: "Já não preciso." } }),
    );
    expect(conta.status).toBe(200);
    expect(await conta.json()).toMatchObject({ ok: true, cancelado: true });
    const link = await agirPeloLink(
      pedido(`/api/negociacao/${TOKEN_DO_LINK}`, { metodo: "POST", corpo: { accao: "cancelar_pedido", pedidoId: 482 } }),
      comToken(TOKEN_DO_LINK),
    );
    expect(link.status).toBe(200);
    expect(db.cancelarPedido).toHaveBeenCalledTimes(2);
  });

  it("recusar o ajuste leva a nota de quem recusa", async () => {
    await agirNaConta(
      pedido("/api/users/me/negociacao", {
        metodo: "POST",
        bearer: tokenDoCliente,
        corpo: { accao: "recusar_ajuste", pedidoId: 482, negociacaoId: 11, motivo: "Combinámos outro valor." },
      }),
    );
    expect(responderAoAjuste).toHaveBeenCalledWith(
      expect.objectContaining({ negociacaoId: 11, resposta: "recusar", porQuem: "cliente", nota: "Combinámos outro valor." }),
    );
  });

  it("sem sessão, 401; o pedido de outro cliente, 404; um Trabalho CLYON, 403", async () => {
    const corpo = { accao: "contratar", pedidoId: 482, negociacaoId: 11 };
    expect((await agirNaConta(pedido("/x", { metodo: "POST", corpo }))).status).toBe(401);
    expect((await agirNaConta(pedido("/x", { metodo: "POST", bearer: tokenDoOutro, corpo }))).status).toBe(404);
    const clyon = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "cancelar_pedido", pedidoId: 484 } }),
    );
    expect(clyon.status).toBe(403);
    expect(avisarQueFoiContratado).not.toHaveBeenCalled();
    expect(db.cancelarPedido).not.toHaveBeenCalled();
  });
});

describe("d6 — o fim do Trabalho CLYON na R5 e o «avaliar» pela R8", () => {
  beforeEach(() => {
    negociacoes.set(484, [
      negociacao({
        id: 31,
        estado: "acordada",
        valorAcordado: "255.00",
        propostasJson: "[]",
        ofertaClyon: "distribuida",
        profissionalNome: "Empresa Teste",
        dataCombinada: new Date("2026-11-03T09:00:00Z"),
        execucaoEnviadaEm: new Date("2026-11-03T14:00:00Z"),
        confirmadoEm: new Date("2026-11-03T15:00:00Z"),
      }),
    ]);
  });

  it("a R5 manda o dia, «a CLYON confirma», e a avaliação — e nenhum campo interno", async () => {
    const j = await (await umPedido(pedido("/api/cliente/pedidos/484", { bearer: tokenDoCliente }), comId("484"))).json();
    expect(j.negociacoes).toEqual([]);
    const f = j.pedido.fimClyon;
    expect(f).toMatchObject({
      negociacaoId: 31,
      profissional: "Empresa Teste",
      fase: "confirmado",
      dataCombinadaTexto: "terça-feira, 3 de novembro, às 09:00",
      podeAvaliar: true,
      // O valor da negociação (255) não é o valor fixo (300): paga-se pela referência da CLYON.
      podePagar: false,
      pagamento: null,
    });
    expect(f.textos.pergunta).toBe("Como correu com Empresa Teste?");
    expect(j.pedido.accoes).toEqual(["avaliar"]);
    const texto = JSON.stringify(j);
    for (const proibido of ["valorAcordado", "taxaProfissional", "taxaCliente", "taxaClyon", "valorFixoClyon", "ofertaClyon", "distribuida", "255", TELEFONE_DO_PRO]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it("avaliar num Trabalho CLYON grava a nota como do cliente; o id de outra negociação, 404", async () => {
    const r = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "avaliar", pedidoId: 484, negociacaoId: 31, estrelas: 5 } }),
    );
    expect(r.status).toBe(200);
    expect(db.avaliarProfissional).toHaveBeenCalledWith(31, 484, 5, null, { origem: "cliente", por: "cliente" });
    const outra = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "avaliar", pedidoId: 484, negociacaoId: 99, estrelas: 5 } }),
    );
    expect(outra.status).toBe(404);
    // O resto continua tratado pela CLYON.
    const confirmar = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "confirmar", pedidoId: 484, negociacaoId: 31 } }),
    );
    expect(confirmar.status).toBe(403);
  });
});

describe("R3 — /api/users/me pelo leitor único", () => {
  it("sem sessão, 401; com o Bearer da app, a conta do email da sessão", async () => {
    expect((await aMinhaConta(pedido("/api/users/me"))).status).toBe(401);
    const r = await aMinhaConta(pedido("/api/users/me", { bearer: tokenDoCliente }));
    expect(r.status).toBe(200);
    const doUpsert = execute.mock.calls.find(([sql]) => /INSERT INTO users/.test(String(sql)));
    expect((doUpsert?.[1] as unknown[])[0]).toBe(EMAIL);
  });
});

/*
 * ── AS REGRAS DA SEGURANÇA PARA AS ROTAS DO CLIENTE (análise de 28-10-2026) ──
 *
 * Numeradas como na análise. A (9), o allowBackup da app, é das Apps.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
function rotasEm(dir: string): string[] {
  return readdirSync(join(raiz, dir)).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(join(raiz, p)).isDirectory()) return rotasEm(p);
    return n === "route.ts" ? [relative(raiz, join(raiz, p)).replace(/\\/g, "/")] : [];
  });
}

describe("Segurança — as regras das rotas do cliente", () => {
  it("(1) o cliente é a sessão: um email no endereço ou no corpo não muda nada", async () => {
    const r = await listaDePedidos(pedido(`/api/cliente/pedidos?email=${OUTRO}`, { bearer: tokenDoCliente }));
    const ids = (await r.json()).pedidos.map((p: { id: number }) => p.id);
    expect(ids).not.toContain(483);
    // E na negociação: o pedidoId é do outro cliente → o mesmo 404 de um que não existe.
    const deOutro = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "contratar", pedidoId: 483, negociacaoId: 21, email: OUTRO } }),
    );
    const naoExiste = await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "contratar", pedidoId: 999, negociacaoId: 21 } }),
    );
    expect(deOutro.status).toBe(404);
    expect(await deOutro.json()).toEqual(await naoExiste.json());
  });

  it("(2) a resposta é escrita campo a campo, depois das regras de 26-10", () => {
    const R5 = ler("src/lib/pedidos-do-cliente.ts");
    expect(R5).toContain("negociacoesDaVistaDoCliente(pedido, agora)");
    expect(R5).toContain("historicoParaOCliente(pedido.historyJson, { trabalhoClyon })");
    expect(ler("src/lib/vista-do-pedido.ts")).toContain("negociacoesParaOCliente(");
    // Sem espalhar a linha inteira para a resposta (o código, sem os comentários).
    const APP = ler("src/lib/pedido-para-a-app.ts").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");
    expect(APP).toContain("export function negociacaoParaAApp(");
    expect(APP).not.toMatch(/\.\.\.n\b|\.\.\.linha\b/);
  });

  it("(3) quem escreve tem travão por endereço e por conta", async () => {
    const ESCREVEM: Array<[string, RegExp]> = [
      ["src/app/api/users/me/negociacao/route.ts", /limitarPorConta\("negociacao-conta-cliente", cliente\.email/],
      ["src/app/api/negociacao/[token]/route.ts", /limitarPorConta\("negociacao-pedido", `pedido:\$\{pedido\.id\}`/],
      ["src/app/api/cliente/dispositivo/route.ts", /limitarPorConta\("cliente-dispositivo-conta", email/],
      ["src/app/api/cliente/aviso-de-teste/route.ts", /limitarPorConta\("cliente-aviso-de-teste-conta", email/],
      ["src/app/api/users/me/route.ts", /limitarPorConta\("conta-cliente-gravar", session\.user\.email/],
      ["src/app/api/pagamentos/route.ts", /limitarPorConta\(\s*"pagamentos-criar-conta"/],
      ["src/app/api/simulador/pedido/route.ts", /limitarPorContaDoCliente\(req, "simulador-pedido-conta"/],
      ["src/app/api/blob/presign/route.ts", /limitarPorContaDoCliente\(req, "blob-presign-conta"/],
      ["src/app/api/simulador/upload-fotos/route.ts", /limitarPorContaDoCliente\(request, "upload-fotos-conta"/],
    ];
    for (const [f, porConta] of ESCREVEM) {
      const s = ler(f);
      expect(s, f).toMatch(porConta);
      expect(s, f).toMatch(/limitarRotaPublica\(|checkRateLimit\(/);
    }
    // E é a conta da sessão que conta.
    negociacoes.set(482, [negociacao({ id: 11, estado: "aguarda_contratacao", valorAcordado: "350.00" })]);
    await agirNaConta(
      pedido("/x", { metodo: "POST", bearer: tokenDoCliente, corpo: { accao: "contratar", pedidoId: 482, negociacaoId: 11 } }),
    );
    expect(limitarPorConta).toHaveBeenCalledWith("negociacao-conta-cliente", EMAIL, 30, 300);
  });

  it("(4) o X-Pedido-Token não abre nada: sem sessão, 401, e nenhuma rota do cliente o lê", async () => {
    const r = await umPedido(
      new NextRequest("http://localhost/api/cliente/pedidos/482", { headers: { "x-pedido-token": TOKEN_DO_LINK } }),
      comId("482"),
    );
    expect(r.status).toBe(401);
    for (const f of rotasEm("src/app/api/cliente")) expect(ler(f).toLowerCase(), f).not.toContain("x-pedido-token");
  });

  it("(5) apagar a conta tira-lhe os telemóveis", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function apagarContaDeCliente(");
    expect(i).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 12000)).toContain('DELETE FROM pushSubscriptions WHERE userEmail = ?", [alvo]');
  });

  it("(6) a sessão do site também tem de ter conta na base", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: EMAIL, name: "Cliente Teste" }, expires: "" });
    try {
      // Com a conta: entra.
      expect((await listaDePedidos(pedido("/api/cliente/pedidos"))).status).toBe(200);
      // Conta apagada (o email já não está na base): o cookie deixa de servir.
      const antes = execute.getMockImplementation()!;
      execute.mockImplementation(async (sql: string, params: unknown[] = []) =>
        /FROM users/.test(sql) ? [[], undefined] : antes(sql, params),
      );
      expect((await listaDePedidos(pedido("/api/cliente/pedidos"))).status).toBe(401);
      expect((await aMinhaConta(pedido("/api/users/me"))).status).toBe(401);
      expect(
        (await agirNaConta(pedido("/x", { metodo: "POST", corpo: { accao: "cancelar_pedido", pedidoId: 482 } }))).status,
      ).toBe(401);
      expect(db.cancelarPedido).not.toHaveBeenCalled();
    } finally {
      vi.mocked(getServerSession).mockResolvedValue(null);
    }
  });

  it("(8) sem CORS aberto", async () => {
    for (const f of [...rotasEm("src/app/api/cliente"), ...rotasEm("src/app/api/users/me")]) {
      expect(ler(f), f).not.toMatch(/Access-Control-Allow-Origin/i);
    }
    const r = await listaDePedidos(pedido("/api/cliente/pedidos", { bearer: tokenDoCliente }));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("(10) a guarda lê src/app/api/cliente: cada rota lê a sessão pelo leitor único e tem travão", () => {
    const rotas = rotasEm("src/app/api/cliente");
    expect(rotas.length).toBeGreaterThanOrEqual(5);
    for (const f of rotas) {
      const s = ler(f);
      expect(s, f).not.toMatch(/getServerSession\s*\(/);
      expect(s, f).toMatch(/limitarRotaPublica\(/);
      // As que não leem sessão nenhuma, de propósito: a entrada (R1, R1a) troca
      // uma prova por uma sessão, ou diz de quem é o link sem o gastar; o
      // catálogo (R7) abre o primeiro ecrã; os erros (S3) dão-se antes de entrar.
      const SEM_SESSAO = [
        "cliente/entrar/route.ts",
        "cliente/entrar/verificar/route.ts",
        "cliente/catalogo/route.ts",
        "cliente/erro-da-app/route.ts",
        // O preço de referência (R12, S13): o simulador da app mostra-o sem conta.
        "cliente/referencia/route.ts",
      ];
      if (SEM_SESSAO.some((x) => f.endsWith(x))) {
        expect(s, f).not.toMatch(/\b(emailDoCliente|clienteDaSessao|sessaoActivaDoCliente)\(/);
        continue;
      }
      expect(s, f).toMatch(/from "@\/lib\/cliente-auth"/);
      expect(s, f).toMatch(/\b(emailDoCliente|clienteDaSessao|sessaoActivaDoCliente)\(/);
    }
  });
});
