import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * S16 — A SESSÃO DE CONVIDADO (29-10-2026; regras R2–R7, R12, R15, R16 da
 * Segurança; critérios 39–40). Dados de teste.
 */

const sessoes = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/db", () => ({
  sessaoDeConvidadoPorHash: vi.fn(async (h: string) => sessoes.get(h) ?? null),
  tocarSessaoDeConvidado: vi.fn(async () => {}),
  ensureUsersSchema: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({ execute: vi.fn(async () => [[], undefined]) })),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));

import {
  CABECALHO_DO_APARELHO,
  convidadoDoPedido,
  novaChaveDeConvidado,
  resumoDaChave,
  validarConvidado,
} from "./sessao-de-convidado";
import { provaDoCodigo } from "./entrada-na-app";
import { emailDoCliente, assinarSessaoDoCliente } from "./cliente-auth";
import { verificarSessaoDoProfissional } from "./profissional-auth";
import { verifyColaboradorToken } from "./colaborador-auth";

const CODIGO = "k".repeat(43);
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

function sessao(o: Partial<Record<string, unknown>> = {}) {
  const { chave, hash } = novaChaveDeConvidado();
  sessoes.set(hash, {
    id: 1,
    pedidoId: 801,
    provaDoAparelho: provaDoCodigo(CODIGO),
    criadaEm: new Date(Date.now() - 60_000),
    expiraEm: new Date(Date.now() + 86_400_000),
    revogadaEm: null,
    convidadosDesde: null,
    contactEmail: null,
    ...o,
  });
  return chave;
}
const pedido = (chave: string, codigo = CODIGO) =>
  new NextRequest("https://clyon.pt/api/cliente/pedidos/801", {
    headers: { authorization: `Bearer ${chave}`, [CABECALHO_DO_APARELHO]: codigo },
  });

beforeEach(() => {
  sessoes.clear();
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-convidado";
});

describe("o leitor do convidado", () => {
  it("vale só com a chave e o código do aparelho certos, e só para o seu pedido", async () => {
    const chave = sessao();
    expect(await convidadoDoPedido(pedido(chave), 801)).toMatchObject({ pedidoId: 801, prova8: provaDoCodigo(CODIGO).slice(0, 8) });
    // Copiada para outro telemóvel (outro código): 401 (critério 39).
    expect(await convidadoDoPedido(pedido(chave, "z".repeat(43)), 801)).toBeNull();
    // Noutro pedido (critério 40).
    expect(await convidadoDoPedido(pedido(chave), 802)).toBeNull();
  });

  it("revogada, expirada, de antes do corte, ou num pedido que já tem conta: recusada", async () => {
    expect(await validarConvidado(sessao({ revogadaEm: new Date() }), CODIGO)).toBeNull();
    expect(await validarConvidado(sessao({ expiraEm: new Date(Date.now() - 1000) }), CODIGO)).toBeNull();
    expect(await validarConvidado(sessao({ convidadosDesde: new Date() }), CODIGO)).toBeNull();
    expect(await validarConvidado(sessao({ contactEmail: "dono@exemplo.pt" }), CODIGO)).toBeNull();
  });

  it("separação estrita: os outros leitores recusam a chave, e o do convidado recusa os tokens deles (critério 40)", async () => {
    const chave = sessao();
    expect(await emailDoCliente(pedido(chave))).toBeNull();
    expect(await verificarSessaoDoProfissional(chave)).toBeNull();
    expect(await verifyColaboradorToken(chave)).toBeNull();
    const { token } = await assinarSessaoDoCliente("cliente.teste@exemplo.pt", "link");
    expect(await validarConvidado(token, CODIGO)).toBeNull();
  });

  it("na base só o resumo da chave; a chave não se escreve em registos", () => {
    const { chave, hash } = novaChaveDeConvidado();
    expect(hash).toBe(resumoDaChave(chave));
    expect(hash).not.toContain(chave.slice(3));
    const L = ler("src/lib/sessao-de-convidado.ts");
    expect(L).not.toMatch(/console\.(log|error|warn)/);
  });
});

describe("o que o convidado vê e não faz", () => {
  it("a vista própria: a zona e não a morada, nunca o telefone, o email ou o NIF (R12)", () => {
    const L = ler("src/lib/pedidos-do-cliente.ts");
    const i = L.indexOf("export async function pedidoDoConvidadoParaAApp(");
    expect(i).toBeGreaterThan(-1);
    const corpo = L.slice(i);
    expect(corpo).toContain("zona: p.cidade,");
    expect(corpo).not.toMatch(/\b(morada|address|contactPhone|contactEmail|nif|NIF)\b\s*:/);
    // E o histórico sem o nome de quem escreveu na equipa.
    expect(corpo).toMatch(/historico: v\.historico\.map\(\(e\) => \(\{ type: e\.type, message: e\.message, createdAt: e\.createdAt, quandoTexto: e\.quandoTexto \}\)\)/);
  });

  it("pagar com a sessão de convidado: 403 «Para pagar, crie a conta.» (R15)", () => {
    expect(ler("src/app/api/pagamentos/route.ts")).toMatch(
      /if \(chaveDoPedidoHttp\(req\)\) \{\s+return NextResponse\.json\(\{ ok: false, error: "Para pagar, crie a conta\." \}, \{ status: 403 \}\);/,
    );
  });

  it("as rotas que aceitam o convidado são só a R5, a R8, a R13 e a R14 (R16)", () => {
    const comConvidado = [
      "src/app/api/cliente/pedidos/[id]/route.ts",
      "src/app/api/users/me/negociacao/route.ts",
      "src/app/api/cliente/pedidos/[id]/alteracao/route.ts",
      "src/app/api/cliente/pedidos/[id]/resposta/route.ts",
    ];
    for (const f of comConvidado) expect(ler(f), f).toMatch(/convidadoDoPedido\(req, pedidoId\)/);
    // A lista de pedidos não o aceita.
    expect(ler("src/app/api/cliente/pedidos/route.ts")).not.toMatch(/convidadoDoPedido/);
  });

  it("o limite de 3 telemóveis conta-se na base, numa transacção com o pedido bloqueado (R8)", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function abrirSessaoDeConvidado(");
    const corpo = DB.slice(i, DB.indexOf("export type SessaoDeConvidadoNaBase", i));
    expect(corpo).toContain("await conn.beginTransaction();");
    expect(corpo).toContain("FROM simulatorOrders WHERE id = ? FOR UPDATE");
    expect(corpo).toMatch(/provas\.size >= TELEMOVEIS_POR_PEDIDO/);
    expect(corpo).not.toMatch(/checkRateLimit|redis/i);
  });
});
