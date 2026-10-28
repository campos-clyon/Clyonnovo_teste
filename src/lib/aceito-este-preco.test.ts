import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TRABALHO CLYON COM «ACEITO ESTE PREÇO» — d8 fase 2, S7 (28-10-2026; P2 do
 * dono). Critério 26: sem preço enviado, nenhum valor; enviado, o valor com a
 * versão e a acção; aceitar grava e avisa a equipa (cartão, selo, histórico);
 * a equipa muda o valor → volta a «a rever» e pede outra vez a resposta;
 * aceitar com o preço antigo → «O preço mudou entretanto.»; nunca contratar
 * nem recusar. Dados de teste.
 */

const EMAIL = "cliente.teste@exemplo.pt";
const ENVIADO = new Date("2026-10-27T10:00:00Z");
let pedido: Record<string, unknown> = {};
let negociacoes: Array<Record<string, unknown>> = [];
const historico: string[] = [];

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderById: vi.fn(async () => ({ ...pedido })),
  negociacoesDoPedido: vi.fn(async () => negociacoes.map((n) => ({ ...n }))),
  aceitarPrecoClyon: vi.fn(async (_id: number, versao: Date) => {
    if (pedido.precoAceiteEm || (pedido.propostaEnviadaEm as Date).getTime() !== versao.getTime()) return false;
    pedido.precoAceiteEm = new Date("2026-10-28T09:30:00Z");
    return true;
  }),
  appendOrderHistory: vi.fn(async (_id: number, e: { message: string }) => {
    historico.push(e.message);
  }),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({ perfilPublicoDoProfissional: vi.fn(async () => null) }));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));

import { GET as umPedido } from "@/app/api/cliente/pedidos/[id]/route";
import { POST as agir } from "@/app/api/users/me/negociacao/route";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { PRECO_MUDOU, PRECO_JA_NAO_ESPERA } from "@/lib/agir-como-cliente";

let sessao = "";

function chamar(url: string, o: { corpo?: unknown; metodo?: string; bearer?: string | null } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const b = o.bearer === undefined ? sessao : o.bearer;
  if (b) headers.authorization = `Bearer ${b}`;
  return new NextRequest(`https://clyon.pt${url}`, {
    method: o.metodo ?? "GET",
    headers,
    body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
  });
}
const lerPedido = async () =>
  (await umPedido(chamar("/api/cliente/pedidos/700"), { params: Promise.resolve({ id: "700" }) })).json();
const aceitar = (versao: unknown) =>
  agir(chamar("/api/users/me/negociacao", { metodo: "POST", corpo: { pedidoId: 700, accao: "aceitar_preco_clyon", versao } }));

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-aceito-este-preco";
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000))).token;
});

beforeEach(() => {
  historico.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Um Trabalho CLYON de 300 € sem IVA (taxa 15 %), à espera de quem o faça.
  pedido = {
    id: 700,
    serviceType: "recolha_moveis",
    city: "Lisboa",
    status: "pendente",
    contactEmail: EMAIL,
    valorFixoClyon: "300.00",
    taxaClyon: "0.15",
    precoClienteClyon: null,
    baseDoPreco: null,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    propostaEnviadaEm: null,
    precoAceiteEm: null,
  };
  negociacoes = [];
});

describe("S7 — R5: o preço da CLYON só depois de enviado", () => {
  it("sem preço enviado: nenhum valor, nenhuma acção", async () => {
    const j = await lerPedido();
    expect(j.pedido.valorClyon).toBeNull();
    expect(j.pedido.accoes).toEqual([]);
    expect(JSON.stringify(j)).not.toContain("369");
  });

  it("enviado: o valor com a versão e «aceitar_preco_clyon»; nunca contratar nem recusar", async () => {
    pedido.propostaEnviadaEm = ENVIADO;
    const j = await lerPedido();
    expect(j.pedido.valorClyon).toMatchObject({ principal: "369,00 € com IVA", versao: ENVIADO.toISOString() });
    expect(j.pedido.accoes).toEqual(["aceitar_preco_clyon"]);
    expect(j.negociacoes).toEqual([]);
    expect(JSON.stringify(j)).not.toMatch(/"(contratar|desistir|aceitar)"/);
  });
});

describe("S7 — R8: aceitar_preco_clyon", () => {
  it("aceitar grava, regista no histórico e a R5 passa a dizer quando", async () => {
    pedido.propostaEnviadaEm = ENVIADO;
    const r = await aceitar(ENVIADO.toISOString());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, aceite: true });
    expect(historico).toEqual(["O cliente aceitou o preço de 369,00 € com IVA na app."]);
    const j = await lerPedido();
    expect(j.pedido.precoAceiteEm).toBe("2026-10-28T09:30:00.000Z");
    expect(j.pedido.precoAceiteEmTexto).toBe("quarta-feira, 28 de outubro, às 09:30");
    expect(j.pedido.accoes).toEqual([]);
  });

  it("com o preço antigo no ecrã → 409 «O preço mudou entretanto.»", async () => {
    pedido.propostaEnviadaEm = ENVIADO;
    const r = await aceitar("2026-10-20T10:00:00.000Z");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe(PRECO_MUDOU);
    expect(historico).toEqual([]);
  });

  it("sem preço enviado, já aceite ou já com profissional → 409 «já não está à espera»", async () => {
    expect((await (await aceitar(ENVIADO.toISOString())).json()).error).toBe(PRECO_JA_NAO_ESPERA);
    pedido.propostaEnviadaEm = ENVIADO;
    pedido.precoAceiteEm = new Date();
    expect((await (await aceitar(ENVIADO.toISOString())).json()).error).toBe(PRECO_JA_NAO_ESPERA);
    pedido.precoAceiteEm = null;
    negociacoes = [{ id: 1, estado: "acordada", ofertaClyon: "distribuida" }];
    expect((await (await aceitar(ENVIADO.toISOString())).json()).error).toBe(PRECO_JA_NAO_ESPERA);
  });

  it("contratar ou recusar num Trabalho CLYON continua 403", async () => {
    pedido.propostaEnviadaEm = ENVIADO;
    const r = await agir(chamar("/api/users/me/negociacao", { metodo: "POST", corpo: { pedidoId: 700, accao: "contratar", negociacaoId: 1 } }));
    expect(r.status).toBe(403);
  });
});

describe("S7 — a equipa vê e a mudança de valor limpa", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  it("mudar o valor limpa a proposta e o «aceito» (volta a «a rever» e pede outra resposta)", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("SET propostaEnviadaEm = NULL, precoAceiteEm = NULL, updatedAt = updatedAt");
    expect(DB).toContain("ALTER TABLE simulatorOrders ADD COLUMN precoAceiteEm DATETIME NULL DEFAULT NULL");
    expect(DB).toMatch(/WHERE id = \? AND valorFixoClyon IS NOT NULL AND propostaEnviadaEm = \? AND precoAceiteEm IS NULL/);
  });

  it("o cartão dos Trabalhos CLYON diz que o cliente aceitou, e conta no selo", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain(
      "if (t.precoAceiteEm) return `O cliente aceitou o preço ${quando(t.precoAceiteEm)} — escolha quem o faz`;",
    );
    const DB = ler("src/lib/db.ts");
    const selo = DB.slice(DB.indexOf('"trabalhos_clyon",\n    `SELECT o.id FROM simulatorOrders o'));
    expect(selo.slice(0, 2500)).toContain("OR o.precoAceiteEm > ?");
  });
});
