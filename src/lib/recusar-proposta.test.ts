import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «RECUSAR» NO SITE E NA APP, E O PROFISSIONAL AVISADO — d8 fase 2, S8
 * (28-10-2026; P4 do dono). Critério 18: a pergunta certa (com outras / a
 * única), as outras continuam, a proposta sai da lista, e o profissional
 * recebe o aviso no telemóvel (o da d5) e por email — por qualquer porta.
 */

const EMAIL = "cliente.teste@exemplo.pt";
const TOKEN_DO_LINK = "r".repeat(43);
const negociacoes: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderById: vi.fn(async () => pedido()),
  getSimulatorOrderByAcessoTokenHash: vi.fn(async () => pedido()),
  negociacaoPorTokenHash: vi.fn(async () => undefined),
  negociacoesDoPedido: vi.fn(async () => negociacoes.map((n) => ({ ...n }))),
  gravarNegociacao: vi.fn(async () => {}),
  appendOrderHistory: vi.fn(async () => {}),
  perfilDoProfissional: vi.fn(async () => ({ email: "pro.teste@exemplo.pt", name: "Profissional Teste" })),
  registarSemFalhar: vi.fn(async () => {}),
  marcarVistoPeloCliente: vi.fn(async () => {}),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({ perfilPublicoDoProfissional: vi.fn(async () => null) }));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));
vi.mock("@/lib/avisar-quem-perdeu", async (original) => {
  const m = await original<typeof import("@/lib/avisar-quem-perdeu")>();
  return { ...m, avisarQuemFicouSemOTrabalho: vi.fn(async () => {}) };
});
vi.mock("@/lib/email-trabalho", () => ({
  avisarQueFoiContratado: vi.fn(async () => true),
  avisarQueOClienteRecusou: vi.fn(async () => true),
}));

import { hashDeToken } from "@/lib/pedido-acesso";
import { POST as agirNaConta } from "@/app/api/users/me/negociacao/route";
import { POST as agirPeloLink } from "@/app/api/negociacao/[token]/route";
import { GET as umPedido } from "@/app/api/cliente/pedidos/[id]/route";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { avisarQuemFicouSemOTrabalho } from "@/lib/avisar-quem-perdeu";
import { avisarQueOClienteRecusou } from "@/lib/email-trabalho";
import { RECUSAR, perguntaDeRecusar } from "@/lib/recusar-proposta";

function pedido() {
  return {
    id: 620,
    serviceType: "recolha_moveis",
    status: "pendente",
    contactEmail: EMAIL,
    valorFixoClyon: null,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    acessoTokenHash: hashDeToken(TOKEN_DO_LINK),
    acessoTokenExpiraEm: new Date(Date.now() + 86_400_000),
  };
}
const proposta = JSON.stringify([{ por: "profissional", valor: 350, estado: "pendente", criadaEm: new Date().toISOString() }]);
const negociacao = (id: number, providerId: number) => ({
  id,
  pedidoId: 620,
  providerId,
  estado: "aberta",
  valorAcordado: null,
  propostasJson: proposta,
  taxaCliente: "0.05",
  createdAt: new Date("2026-10-20T10:00:00Z"),
  updatedAt: new Date(),
  semFactura: 0,
  ofertaClyon: null,
  profissionalNome: `Profissional ${id}`,
  profissionalTelefone: "912345678",
  regimeIva: "normal",
  guiaVerificadaEm: null,
});

let sessao = "";
beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-recusar";
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000))).token;
});
beforeEach(() => {
  vi.clearAllMocks();
  negociacoes.length = 0;
  negociacoes.push(negociacao(51, 7), negociacao(52, 8));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("S8 — as perguntas, iguais no site e na app", () => {
  it("com outras / a única", () => {
    expect(perguntaDeRecusar("Ana", true)).toBe("Recusar a proposta de Ana? As outras continuam.");
    expect(perguntaDeRecusar("Ana", false)).toBe("Recusar a proposta de Ana? O pedido continua aberto a outras propostas.");
  });

  it("a R5 manda-as em textos.recusar, da mesma constante", async () => {
    const r = await umPedido(
      new NextRequest("https://clyon.pt/api/cliente/pedidos/620", { headers: { authorization: `Bearer ${sessao}` } }),
      { params: Promise.resolve({ id: "620" }) },
    );
    const j = await r.json();
    expect(j.textos.recusar).toEqual({ comOutras: RECUSAR.comOutras, semOutras: RECUSAR.semOutras });
    expect(j.negociacoes[0].accoes).toContain("desistir");
  });

  it("o site (página do link e conta) mostra «Recusar» com a pergunta e manda `desistir`", () => {
    const P = readFileSync(join(process.cwd(), "src/app/pedido/[token]/PropostasRecebidas.tsx"), "utf8");
    expect(P).toContain('n.accoes.includes("desistir") && !soParaVer');
    expect(P).toContain('if (window.confirm(perguntaDeRecusar(p.nome, activas.length > 1))) void agir(n.id, "desistir");');
  });
});

describe("S8 — recusar avisa o profissional, por qualquer porta", () => {
  const corpo = { accao: "desistir", pedidoId: 620, negociacaoId: 51 };

  it("pela app (Bearer)", async () => {
    const r = await agirNaConta(
      new NextRequest("https://clyon.pt/api/users/me/negociacao", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessao}` },
        body: JSON.stringify(corpo),
      }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "desistida" });
    expect(avisarQuemFicouSemOTrabalho).toHaveBeenCalledWith({
      pedidoId: 620,
      quem: [{ negociacaoId: 51, providerId: 7 }],
      porque: "desistiu",
    });
    expect(avisarQueOClienteRecusou).toHaveBeenCalledWith(
      expect.objectContaining({ paraEmail: "pro.teste@exemplo.pt", pedidoId: 620 }),
    );
  });

  it("pelo link do email", async () => {
    const r = await agirPeloLink(
      new NextRequest(`https://clyon.pt/api/negociacao/${TOKEN_DO_LINK}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      }),
      { params: Promise.resolve({ token: TOKEN_DO_LINK }) },
    );
    expect(r.status).toBe(200);
    expect(avisarQuemFicouSemOTrabalho).toHaveBeenCalledTimes(1);
    expect(avisarQueOClienteRecusou).toHaveBeenCalledTimes(1);
  });
});
