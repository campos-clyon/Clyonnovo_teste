import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UMA SÓ TABELA DE ESTADOS — d8 fase 2, S9 (28-10-2026).
 *
 * O mesmo pedido dá o mesmo `estadoTexto` na lista da app (R4), no pedido da
 * app (R5) e na conta do site; as mesmas negociações pela mesma ordem (a
 * última actividade em cima — P3) na R5, em /pedido/<token> e em
 * /api/users/me/orders; a lista da app pela ordem do E2. Dados de teste.
 */

const EMAIL = "cliente.teste@exemplo.pt";
const pedidos = new Map<number, Record<string, unknown>>();
const negociacoes = new Map<number, Array<Record<string, unknown>>>();

const execute = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/FROM users/.test(sql)) return [[{ id: 1, email: EMAIL, sessoesClienteDesde: null, contaMaisNova: 0 }], undefined];
  if (/AS totalOrders/.test(sql)) return [[{ totalOrders: pedidos.size, activeOrders: 0, lastOrderDate: null }], undefined];
  if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total: pedidos.size }], undefined];
  if (/FROM negociacoes n/.test(sql)) {
    const ids = params.map(Number);
    return [ids.flatMap((id) => (negociacoes.get(id) ?? []).map((n) => ({ ...n, pedidoId: id }))), undefined];
  }
  if (/FROM simulatorOrders o/.test(sql)) {
    return [[...pedidos.values()].map((p) => ({ ...p, trabalhoClyon: p.valorFixoClyon != null ? 1 : 0 })), undefined];
  }
  return [[], undefined];
});

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({ execute })),
  withConnection: vi.fn(async (fn: (c: unknown) => unknown) => fn({ execute })),
  getSimulatorOrderById: vi.fn(async (id: number) => pedidos.get(Number(id))),
  negociacoesDoPedido: vi.fn(async (id: number) => (negociacoes.get(Number(id)) ?? []).map((n) => ({ ...n }))),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { email: EMAIL } })) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({ perfilPublicoDoProfissional: vi.fn(async () => null) }));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));

import { GET as listaDaApp } from "@/app/api/cliente/pedidos/route";
import { GET as pedidoDaApp } from "@/app/api/cliente/pedidos/[id]/route";
import { GET as pedidosDaConta } from "@/app/api/users/me/orders/route";
import { negociacoesNoEcraDoPedido } from "@/lib/vista-do-pedido";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { estadoDoPedidoParaOCliente } from "@/lib/pedido-para-a-app";

let sessao = "";
const AGORA = Date.now();
const antes = (h: number) => new Date(AGORA - h * 3600_000);
const proposta = (por: string, estado = "pendente", h = 5) =>
  JSON.stringify([{ por, valor: 350, estado, criadaEm: antes(h).toISOString() }]);
const FOTO = JSON.stringify({ fotos: ["https://exemplo.pt/feito.jpg"], nota: "" });
const SEM_FOTOS = JSON.stringify({ fotos: [], nota: "" });

function pedido(id: number, o: Record<string, unknown> = {}) {
  pedidos.set(id, {
    id,
    serviceType: "recolha_moveis",
    city: "Lisboa",
    status: "pendente",
    contactEmail: EMAIL,
    valorFixoClyon: null,
    baseDoPreco: null,
    canceladoPeloCliente: 0,
    historyJson: null,
    createdAt: antes(48),
    updatedAt: antes(48),
    propostaEnviadaEm: null,
    precoAceiteEm: null,
    ...o,
  });
}
function negociacao(pedidoId: number, o: Record<string, unknown>) {
  const lista = negociacoes.get(pedidoId) ?? [];
  lista.push({
    providerId: 7,
    estado: "aberta",
    valorAcordado: null,
    propostasJson: proposta("profissional"),
    taxaCliente: "0.05",
    formaDePagamento: null,
    createdAt: antes(30),
    updatedAt: antes(5),
    semFactura: 0,
    ofertaClyon: null,
    profissionalNome: "Profissional Teste",
    profissionalTelefone: "912345678",
    regimeIva: "normal",
    guiaVerificadaEm: null,
    execucaoEnviadaEm: null,
    provaJson: null,
    confirmadoEm: null,
    pagoEm: null,
    ajustesJson: null,
    estrelas: null,
    dataCombinada: null,
    aCaminhoEm: null,
    chegouEm: null,
    ...o,
  });
  negociacoes.set(pedidoId, lista);
}

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-da-tabela-de-estados";
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", antes(1))).token;
});

beforeEach(() => {
  pedidos.clear();
  negociacoes.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // 901 — duas propostas (a de cima é a de última actividade).
  pedido(901);
  negociacao(901, { id: 1, updatedAt: antes(2), profissionalNome: "Recente Lda" });
  negociacao(901, { id: 2, updatedAt: antes(9), profissionalNome: "Antigo Lda", providerId: 8 });
  // 902 — contratado, com o profissional à porta.
  pedido(902);
  negociacao(902, { id: 3, estado: "acordada", valorAcordado: "350.00", chegouEm: antes(1), dataCombinada: antes(2) });
  // 903 — feito sem fotografias: desde 30-10-2026 confirma o cliente, como os outros.
  pedido(903);
  negociacao(903, { id: 4, estado: "acordada", valorAcordado: "350.00", execucaoEnviadaEm: antes(3), provaJson: SEM_FOTOS });
  // 904 — feito com fotografias.
  pedido(904);
  negociacao(904, { id: 5, estado: "acordada", valorAcordado: "350.00", execucaoEnviadaEm: antes(3), provaJson: FOTO });
  // 905 — concluído.
  pedido(905, { updatedAt: antes(1) });
  negociacao(905, { id: 6, estado: "acordada", valorAcordado: "350.00", execucaoEnviadaEm: antes(30), confirmadoEm: antes(20), provaJson: FOTO });
  // 906 — cancelado pelo cliente.
  pedido(906, { canceladoPeloCliente: 1 });
  // 907 — Trabalho CLYON com o preço enviado, por responder.
  pedido(907, { valorFixoClyon: "300.00", taxaClyon: "0.15", propostaEnviadaEm: antes(4) });
  // 908 — Trabalho CLYON com o preço aceite.
  pedido(908, { valorFixoClyon: "300.00", taxaClyon: "0.15", propostaEnviadaEm: antes(6), precoAceiteEm: antes(5) });
  // 909 — ainda sem nada.
  pedido(909);
});

const chamar = (url: string, bearer?: string) =>
  new NextRequest(`https://clyon.pt${url}`, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });

describe("S9 — a tabela, sozinha", () => {
  const base = { status: "pendente", trabalhoClyon: false, contratado: null, comPropostas: 0, enviado: false };
  it("as linhas do E2, pela ordem em que se aplicam", () => {
    expect(estadoDoPedidoParaOCliente({ ...base, status: "arquivado" })).toBe("Cancelado");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "concluido" })).toBe("Concluído");
    expect(estadoDoPedidoParaOCliente({ ...base, trabalhoClyon: true })).toBe("A ser revisto pela CLYON");
    expect(estadoDoPedidoParaOCliente({ ...base, trabalhoClyon: true, precoEnviado: true })).toBe("Preço da CLYON por responder");
    expect(estadoDoPedidoParaOCliente({ ...base, trabalhoClyon: true, precoEnviado: true, precoAceite: true })).toBe(
      "Preço aceite — a CLYON escolhe quem faz",
    );
    expect(estadoDoPedidoParaOCliente({ ...base, comPropostas: 2, enviado: true })).toBe("Tem propostas");
    expect(estadoDoPedidoParaOCliente({ ...base, enviado: true })).toBe("À espera de propostas");
    expect(estadoDoPedidoParaOCliente(base)).toBe("A ser revisto pela CLYON");
    const c = { fase: "a_executar" as const, profissionalNome: "Ana" };
    expect(estadoDoPedidoParaOCliente({ ...base, contratado: { ...c, aCaminhoEm: antes(1) } })).toBe("Ana vai a caminho");
    expect(estadoDoPedidoParaOCliente({ ...base, contratado: c })).toBe("Contratado — Ana");
  });
});

describe("S9 — o mesmo estado na R4, na R5 e na conta", () => {
  it("cada pedido diz o mesmo nas três portas", async () => {
    const r4 = (await (await listaDaApp(chamar("/api/cliente/pedidos", sessao))).json()).pedidos as Array<{
      id: number;
      estadoTexto: string;
      novidade: string | null;
    }>;
    const conta = (await (await pedidosDaConta(chamar("/api/users/me/orders"))).json()).orders as Array<{
      id: number;
      estadoTexto: string;
      novidade: string | null;
    }>;
    const esperado: Record<number, string> = {
      901: "Tem propostas",
      902: "Profissional Teste chegou",
      903: "Por confirmar",
      904: "Por confirmar",
      905: "Concluído",
      906: "Cancelado",
      907: "Preço da CLYON por responder",
      908: "Preço aceite — a CLYON escolhe quem faz",
      909: "A ser revisto pela CLYON",
    };
    for (const [id, texto] of Object.entries(esperado)) {
      const n = Number(id);
      const r5 = (await (await pedidoDaApp(chamar(`/api/cliente/pedidos/${n}`, sessao), { params: Promise.resolve({ id }) })).json())
        .pedido.estadoTexto;
      expect(r4.find((p) => p.id === n)?.estadoTexto, `R4 #${id}`).toBe(texto);
      expect(r5, `R5 #${id}`).toBe(texto);
      expect(conta.find((p) => p.id === n)?.estadoTexto, `conta #${id}`).toBe(texto);
      // E a mesma novidade na lista da app e na conta.
      expect(conta.find((p) => p.id === n)?.novidade).toBe(r4.find((p) => p.id === n)?.novidade);
    }
    expect(r4.find((p) => p.id === 907)?.novidade).toBe("Responda ao preço");
    expect(r4.find((p) => p.id === 908)?.novidade).toBeNull();
  }, 60_000); // Importa as rotas: no meio da suite inteira passa dos 5 s (29-10-2026).

  it("a lista da app: com novidade em cima (pela ordem do que urge), os fechados no fim", async () => {
    const ids = ((await (await listaDaApp(chamar("/api/cliente/pedidos", sessao))).json()).pedidos as Array<{
      id: number;
    }>).map((p) => p.id);
    // Confirme o trabalho (903, 904) › Responda ao preço (907) › 1 proposta nova (901) › os outros › fechados.
    expect(ids.slice(0, 4).sort()).toEqual([901, 903, 904, 907].sort());
    expect(ids.indexOf(907)).toBeLessThan(ids.indexOf(901));
    expect(ids.indexOf(904)).toBeLessThan(ids.indexOf(907));
    expect(ids.slice(-2).sort()).toEqual([905, 906]);
  });
});

describe("S9 — as propostas pela mesma ordem nas três portas (P3: a última actividade em cima)", () => {
  it("R5, /pedido/<token> e /api/users/me/orders", async () => {
    const r5 = (await (await pedidoDaApp(chamar("/api/cliente/pedidos/901", sessao), { params: Promise.resolve({ id: "901" }) })).json())
      .negociacoes.map((n: { id: number }) => n.id);
    const pagina = (await negociacoesNoEcraDoPedido(pedidos.get(901) as never)).map((n) => n.id);
    const conta = (await (await pedidosDaConta(chamar("/api/users/me/orders"))).json()).orders
      .find((o: { id: number }) => o.id === 901)
      .negociacoes.map((n: { id: number }) => n.id);
    expect(r5).toEqual([1, 2]);
    expect(pagina).toEqual(r5);
    expect(conta).toEqual(r5);
    // As três consultas pedem a mesma ordem à base.
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/lib/pedidos-da-conta.ts")).toContain("ORDER BY n.updatedAt DESC");
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function negociacoesDoPedido(");
    expect(DB.slice(i, i + 1200)).toContain("ORDER BY n.updatedAt DESC");
  });

  it("a conta deixa de mostrar os estados internos («Novo», «Em análise», «Aprovado»)", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const LISTA = ler("src/app/conta/components/MeusPedidos.tsx");
    expect(LISTA).not.toContain("<StatusBadge");
    expect(LISTA).not.toMatch(/label: "(Novo|Em análise|Aprovado|Agendado)"/);
    expect(LISTA).toContain("{o.estadoTexto ??");
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).not.toContain("<StatusBadge");
  });
});
