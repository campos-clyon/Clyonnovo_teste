import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d24 (10-11-2026) — O EMAIL DE UM PEDIDO SÓ O MUDA O ADMINISTRADOR.
 *
 * É por `contactEmail` que o pedido aparece na conta do cliente: mudá-lo é
 * mudar o pedido de conta. Nos três sítios do backoffice que o gravam (editar
 * o pedido, a ficha e a lista), um assistente recebe 403 e o administrador
 * consegue, com a mudança no registo permanente. Dados de teste.
 */

const quem: { colab: { id: number; nome: string; papel: "admin" | "assistente" } } = {
  colab: { id: 1, nome: "Rui Exemplo", papel: "admin" },
};
const gravados: Array<Record<string, unknown>> = [];
const registos: Array<Record<string, unknown>> = [];
const PEDIDO = { id: 601, contactEmail: "cliente.teste@exemplo.pt", status: "novo", serviceType: "recolha_moveis" };

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: quem.colab })),
  requireAdminGeral: vi.fn(async () => ({ err: null, colab: quem.colab })),
}));
vi.mock("@/lib/avisar-cancelamento", () => ({ avisarDoCancelamento: vi.fn(async () => {}) }));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getSimulatorOrderById: vi.fn(async (id: number) => (id === 601 ? { ...PEDIDO } : undefined)),
  updateSimulatorOrder: vi.fn(async (_id: number, dados: Record<string, unknown>) => {
    gravados.push(dados);
  }),
  appendOrderHistory: vi.fn(async () => {}),
  negociacoesDoPedido: vi.fn(async () => []),
  registarSemFalhar: vi.fn(async (l: Record<string, unknown>) => {
    registos.push(l);
  }),
}));

import { PATCH as ficha } from "@/app/api/admin/pedidos/[id]/route";
import { PATCH as lista } from "@/app/api/admin/pedidos/route";
import { POST as editar } from "@/app/api/admin/pedidos/[id]/editar/route";
import { emailDoPedidoMuda } from "./email-do-pedido";

const pedido = (url: string, metodo: string, corpo: Record<string, unknown>) =>
  new NextRequest(url, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: "Bearer x" },
    body: JSON.stringify(corpo),
  });
const naFicha = async (corpo: Record<string, unknown>) =>
  (await ficha(pedido("https://clyon.pt/api/admin/pedidos/601", "PATCH", corpo), { params: Promise.resolve({ id: "601" }) }))!;
const naLista = async (corpo: Record<string, unknown>) =>
  (await lista(pedido("https://clyon.pt/api/admin/pedidos", "PATCH", { id: 601, ...corpo })))!;
const aEditar = async (corpo: Record<string, unknown>) =>
  (await editar(pedido("https://clyon.pt/api/admin/pedidos/601/editar", "POST", corpo), { params: Promise.resolve({ id: "601" }) }))!;

beforeEach(() => {
  gravados.length = 0;
  registos.length = 0;
  quem.colab = { id: 1, nome: "Rui Exemplo", papel: "admin" };
});

describe("a regra", () => {
  it("maiúsculas, espaços e o campo que não veio não contam como mudança", () => {
    expect(emailDoPedidoMuda("cliente.teste@exemplo.pt", " Cliente.Teste@exemplo.pt ").muda).toBe(false);
    expect(emailDoPedidoMuda("cliente.teste@exemplo.pt", undefined).muda).toBe(false);
    expect(emailDoPedidoMuda(null, "").muda).toBe(false);
    expect(emailDoPedidoMuda("cliente.teste@exemplo.pt", "outra.pessoa@exemplo.pt")).toEqual({
      muda: true,
      antes: "cliente.teste@exemplo.pt",
      depois: "outra.pessoa@exemplo.pt",
    });
    // Apagar o email também é mudá-lo de conta.
    expect(emailDoPedidoMuda("cliente.teste@exemplo.pt", "").muda).toBe(true);
  });
});

describe("um assistente", () => {
  beforeEach(() => {
    quem.colab = { id: 7, nome: "Assistente de Teste", papel: "assistente" };
  });

  it("recebe 403 nos três sítios, e nada se grava", async () => {
    expect((await naFicha({ contactEmail: "outra.pessoa@exemplo.pt" })).status).toBe(403);
    expect((await naLista({ contactEmail: "outra.pessoa@exemplo.pt" })).status).toBe(403);
    const r = await aEditar({ address: "Rua Exemplo 1", contactEmail: "outra.pessoa@exemplo.pt" });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe("Só o administrador muda o email de um pedido.");
    expect(gravados).toHaveLength(0);
    expect(registos).toHaveLength(0);
  });

  it("continua a gravar o resto quando o email fica igual", async () => {
    const r = await naFicha({ contactEmail: "Cliente.Teste@exemplo.pt", contactName: "Rui Exemplo" });
    expect(r.status).toBe(200);
    expect(gravados).toHaveLength(1);
    expect(registos).toHaveLength(0);
  });
});

describe("o administrador", () => {
  it("muda o email do pedido, e fica no registo com quem e o antes e o depois", async () => {
    expect((await naFicha({ contactEmail: "outra.pessoa@exemplo.pt" })).status).toBe(200);
    expect(gravados[0]).toMatchObject({ contactEmail: "outra.pessoa@exemplo.pt" });
    expect(registos).toHaveLength(1);
    expect(registos[0]).toMatchObject({
      acontecimento: "pedido_email_mudado",
      pedidoId: 601,
      clienteEmail: "outra.pessoa@exemplo.pt",
      autorTipo: "clyon",
      autorNome: "Rui Exemplo",
    });
    expect(registos[0]!.detalhe).toMatchObject({
      porId: 1,
      papel: "admin",
      mudancas: { email: { antes: "cliente.teste@exemplo.pt", depois: "outra.pessoa@exemplo.pt" } },
    });
  });

  it("pela lista também", async () => {
    expect((await naLista({ contactEmail: "outra.pessoa@exemplo.pt" })).status).toBe(200);
    expect(registos).toHaveLength(1);
    expect(registos[0]).toMatchObject({ acontecimento: "pedido_email_mudado", pedidoId: 601 });
  });

  it("no editar, a mudança regista-se depois de gravar", () => {
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/pedidos/[id]/editar/route.ts"), "utf8");
    const recusa = ROTA.indexOf('if (emailDoPedido.muda && colab?.papel !== "admin")');
    const grava = ROTA.indexOf("await updateSimulatorOrder(pedidoId, {");
    const regista = ROTA.indexOf("await registarEmailDoPedidoMudado({");
    expect(recusa).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(recusa);
    expect(regista).toBeGreaterThan(grava);
  });
});
