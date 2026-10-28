import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { isValidElement, type ReactNode } from "react";
import { NextRequest } from "next/server";

/**
 * O CLIENTE NÃO VÊ O QUE É DO PROFISSIONAL NEM DA PLATAFORMA — TAMBÉM NO SITE
 * (d10, 28-10-2026).
 *
 * Três buracos, encontrados pelo agente das rotas da app de cliente:
 *
 *   1. o GET /api/pagamentos devolvia ao cliente as referências da DÍVIDA do
 *      profissional nos trabalhos pagos em dinheiro — o valor delas é o IVA e
 *      a comissão, isto é, a taxa;
 *   2. a página do link (/pedido/<token>) e a conta (/conta) mandavam ao
 *      browser o valor do profissional (`valorAcordado`), as propostas em bruto
 *      e a `taxaCliente`, para o ecrã fazer a conta;
 *   3. uma conta de cliente apagada renascia: /conta recriava-a a partir do
 *      cookie antigo.
 *
 * Os testes correm as respostas do servidor de verdade contra uma base de
 * mentira, e olham para o que sai. Dados de teste: telemóvel 912 345 678.
 */

// As páginas usam JSX sem importar o React (o Next trata disso; o vitest não).
(globalThis as { React?: typeof React }).React = React;

const EMAIL = "cliente@exemplo.pt";
const VALOR_DO_PRO = 350; // o que o profissional propôs — nunca pode sair para o cliente
const proposta = (valor: number) =>
  JSON.stringify([{ por: "profissional", valor, criadaEm: "2026-10-27T10:00:00Z", estado: "pendente" }]);

const PEDIDO = {
  id: 610,
  serviceType: "recolha_moveis",
  status: "pendente",
  city: "Lisboa",
  historyJson: null,
  trabalhoClyon: 0,
  valorFixoClyon: null,
  baseDoPreco: null,
  contactEmail: EMAIL,
  contactPhone: "912 345 678",
  precisaFatura: 0,
  description: "Um sofá.",
  filesJson: null,
  createdAt: new Date("2026-10-26T09:00:00Z"),
};

const NEGOCIACAO = {
  id: 7001,
  pedidoId: 610,
  providerId: 7,
  estado: "aberta",
  valorAcordado: null,
  propostasJson: proposta(VALOR_DO_PRO),
  taxaCliente: "0.0500",
  taxaProfissional: "0.0600",
  formaDePagamento: null,
  createdAt: new Date("2026-10-20T10:00:00Z"),
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
};

let semConta = false;
const consultas: string[] = [];
const execute = vi.fn(async (sql: string) => {
  consultas.push(sql);
  if (sql.includes("FROM users")) return [semConta ? [] : [{ id: 1, email: EMAIL }], []];
  if (sql.includes("AS totalOrders")) return [[{ totalOrders: 1, activeOrders: 1, lastOrderDate: null }], []];
  if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }], []];
  if (sql.includes("FROM negociacoes n")) return [[{ ...NEGOCIACAO }], []];
  if (sql.includes("FROM simulatorOrders o")) return [[{ ...PEDIDO }], []];
  return [[], []];
});

let pagamentosDaBase: Array<Record<string, unknown>> = [];
let negociacaoDoTrabalho: Record<string, unknown> = {};

vi.mock("@/lib/db", () => ({
  getPool: vi.fn(async () => ({ execute })),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureUsersSchema: vi.fn(async () => {}),
  withConnection: vi.fn(async (fn: (c: unknown) => unknown) => fn({ execute })),
  getSimulatorOrderById: vi.fn(async () => ({ ...PEDIDO })),
  negociacoesDoPedido: vi.fn(async () => [{ ...negociacaoDoTrabalho }]),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/pagamentos-na-base", () => ({
  pagamentosDaNegociacao: vi.fn(async () => pagamentosDaBase),
  abrirPagamento: vi.fn(),
  fecharSemPagar: vi.fn(),
  marcarFalhado: vi.fn(),
  marcarPedido: vi.fn(),
}));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/perfil-publico-do-profissional", () => ({
  perfilPublicoDoProfissional: vi.fn(async () => null),
}));

import { getServerSession } from "next-auth";
import { loadContaData } from "@/lib/conta-server";
import { GET as pedidosDaConta } from "@/app/api/users/me/orders/route";
import { GET as estadoDoPagamento } from "@/app/api/pagamentos/route";
import VistaDoPedido from "@/app/pedido/[token]/VistaDoPedido";
import PropostasRecebidas from "@/app/pedido/[token]/PropostasRecebidas";
import ContaPage from "@/app/conta/page";
import SessaoTerminou from "@/app/conta/SessaoTerminou";

/** O que nunca pode chegar ao browser do cliente. */
const PROIBIDO = ["valorAcordado", "taxaCliente", "taxaProfissional", "propostasJson", '"propostas"', "350,00", ":350"];

function semOProibido(texto: string) {
  for (const p of PROIBIDO) expect(texto, p).not.toContain(p);
}

beforeEach(() => {
  consultas.length = 0;
  semConta = false;
  pagamentosDaBase = [];
  negociacaoDoTrabalho = { ...NEGOCIACAO };
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: EMAIL, name: "Cliente" } } as never);
});

describe("d10 (1) — GET /api/pagamentos não devolve a dívida do profissional", () => {
  const DIVIDA = {
    id: 1,
    metodo: "multibanco",
    estado: "pendente",
    valor: 124.95,
    comFactura: true,
    referencia: "123456789",
    entidade: "12345",
    expiraEm: new Date("2026-11-05T10:00:00Z"),
    pagoEm: null,
    criadoEm: new Date("2026-10-27T10:00:00Z"),
  };

  it("em dinheiro com IVA incluído: nem a referência, nem o valor, nem o «pago»", async () => {
    negociacaoDoTrabalho = { ...NEGOCIACAO, estado: "acordada", valorAcordado: "350.00", formaDePagamento: "dinheiro" };
    for (const estado of ["pendente", "pago"]) {
      pagamentosDaBase = [{ ...DIVIDA, estado, pagoEm: estado === "pago" ? new Date() : null }];
      const r = await estadoDoPagamento(
        new NextRequest(`https://clyon.pt/api/pagamentos?pedidoId=610&negociacaoId=7001`),
      );
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.pagamentos).toEqual([]);
      expect(j.pago).toBe(false);
      expect(j.doCliente).toBe(false);
      const texto = JSON.stringify(j);
      expect(texto).not.toContain("123456789");
      expect(texto).not.toContain("124.95");
    }
  });

  it("pela plataforma, a referência do cliente continua a sair", async () => {
    negociacaoDoTrabalho = { ...NEGOCIACAO, estado: "acordada", valorAcordado: "350.00", formaDePagamento: null };
    pagamentosDaBase = [{ ...DIVIDA, valor: 452.03 }];
    const j = await (
      await estadoDoPagamento(new NextRequest(`https://clyon.pt/api/pagamentos?pedidoId=610&negociacaoId=7001`))
    ).json();
    expect(j.pagamentos).toHaveLength(1);
    expect(j.pagamentos[0].referencia).toBe("123456789");
  });
});

describe("d10 (2) — a conta e a página do link não mandam o valor do profissional, as propostas nem a taxa", () => {
  it("a API da conta (/api/users/me/orders)", async () => {
    const res = await pedidosDaConta(new NextRequest("https://clyon.pt/api/users/me/orders"));
    expect(res.status).toBe(200);
    const j = await res.json();
    const n = j.orders[0].negociacoes[0];
    // O preço que ELE paga, já pronto, e os mesmos textos da app.
    expect(n.preco.principal).toBe("452,03 € com IVA");
    expect(n.valores.aPagar).toBe(452.03);
    expect(n.esperaPorSi).toBe(true);
    semOProibido(JSON.stringify(j));
  });

  it("a primeira carga da conta (loadContaData)", async () => {
    const r = await loadContaData(EMAIL);
    expect(r.contaApagada).toBe(false);
    expect((r.orders[0] as { negociacoes: unknown[] }).negociacoes).toHaveLength(1);
    semOProibido(JSON.stringify(r.orders));
  });

  it("a página do link: o que vai no HTML para o componente do browser", async () => {
    const arvore = await VistaDoPedido({ pedido: { ...PEDIDO } as never, token: "t".repeat(43) });
    const props: unknown[] = [];
    const procurar = (no: ReactNode): void => {
      if (Array.isArray(no)) return no.forEach(procurar);
      if (!isValidElement(no)) return;
      const p = no.props as { children?: ReactNode };
      if (no.type === PropostasRecebidas) props.push(p);
      if (p.children !== undefined) procurar(p.children);
    };
    procurar(arvore);
    expect(props).toHaveLength(1);
    const texto = JSON.stringify(props[0]);
    expect(texto).toContain("452,03 € com IVA");
    semOProibido(texto);
  });

  it("as acções do site respondem só com o estado (como a app)", () => {
    const AGIR = readFileSync(join(process.cwd(), "src/lib/agir-como-cliente.ts"), "utf8").replace(
      /^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm,
      "",
    );
    expect(AGIR).toContain("return { status: 200, corpo: { ok: true, estado: nova.estado } };");
    // Nenhuma resposta leva os valores do motor (gravá-los na base continua, claro).
    expect(AGIR).not.toMatch(/corpo:\s*\{[^}]*valorAcordado/);
    expect(AGIR).not.toMatch(/corpo:\s*\{[^}]*propostas:/);
  });

  it("o ecrã do site não faz contas: não importa taxas, IVA nem o motor de preço", () => {
    for (const f of [
      "src/app/pedido/[token]/PropostasRecebidas.tsx",
      "src/app/pedido/[token]/AjusteNoLocal.tsx",
      "src/app/pedido/[token]/HistoricoDaProposta.tsx",
      "src/app/conta/components/OrderDetailModal.tsx",
      "src/app/conta/components/types.ts",
    ]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).not.toMatch(/from "@\/lib\/(taxas-plataforma|preco-do-cliente|sem-factura|negociacao-na-vista)"/);
      expect(s, f).not.toMatch(/\b(valorAcordado|taxaCliente|propostasJson)\b/);
    }
    // A carteira e o menu da conta somam o que vem feito (`precoDoCliente`).
    for (const f of ["src/app/conta/components/Carteira.tsx", "src/app/conta/ContaCliente.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).toContain("precoDoCliente: n.valores?.aPagar ?? null");
      expect(s, f).not.toMatch(/\b(valorAcordado|taxaCliente|propostasJson)\b/);
    }
  });
});

describe("d10 (3) — uma conta apagada não renasce", () => {
  it("loadContaData só lê: sem conta, diz que foi apagada e não grava nada", async () => {
    semConta = true;
    const r = await loadContaData(EMAIL);
    expect(r.contaApagada).toBe(true);
    expect(r.orders).toEqual([]);
    expect(consultas.some((s) => /INSERT INTO users/.test(s))).toBe(false);
  });

  it("/conta com o cookie de uma conta apagada mostra «A sua sessão terminou», sem redireccionar", async () => {
    semConta = true;
    const pagina = await ContaPage();
    expect(isValidElement(pagina) && pagina.type).toBe(SessaoTerminou);
    expect(consultas.some((s) => /INSERT INTO users/.test(s))).toBe(false);
    const ecra = readFileSync(join(process.cwd(), "src/app/conta/SessaoTerminou.tsx"), "utf8");
    expect(ecra).toContain("A sua sessão terminou — entre outra vez");
    expect(ecra).toMatch(/signOut\(\{ callbackUrl: "\/entrar" \}\)/);
  });

  it("com conta, /conta abre normalmente", async () => {
    const pagina = await ContaPage();
    expect(isValidElement(pagina) && pagina.type).not.toBe(SessaoTerminou);
  });
});
