import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * JUNTAR À CONTA UM PEDIDO SEM EMAIL SÓ PELA MESA — 29-10-2026 (achado alto
 * da Segurança, R13). A app pede; a Mesa confirma, recusa ou desliga; o
 * contacto do pedido é avisado. Dados de teste.
 */

const estado: { pedida: string | null; email: string | null; juntadaEm: Date | null } = { pedida: null, email: null, juntadaEm: null };
const historico: string[] = [];

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "Equipa", papel: "admin" } })),
}));
vi.mock("@/lib/avisar-contacto-do-pedido", () => ({ avisarContactoDoPedido: vi.fn(async () => true) }));
vi.mock("@/lib/db", () => ({
  getSimulatorOrderById: vi.fn(async (id: number) =>
    id === 601 ? { id, contactPhone: "912 345 678", contactEmail: estado.email, juntarAContaPedidoPor: estado.pedida } : undefined,
  ),
  aprovarJuncaoAConta: vi.fn(async () => {
    if (!estado.pedida || estado.email) return null;
    estado.email = estado.pedida;
    estado.pedida = null;
    estado.juntadaEm = new Date();
    return estado.email;
  }),
  recusarJuncaoAConta: vi.fn(async () => {
    if (!estado.pedida) return false;
    estado.pedida = null;
    return true;
  }),
  desligarDaConta: vi.fn(async () => {
    if (!estado.email || !estado.juntadaEm) return null;
    const e = estado.email;
    estado.email = null;
    estado.juntadaEm = null;
    return e;
  }),
  appendOrderHistory: vi.fn(async (_id: number, e: { message: string }) => {
    historico.push(e.message);
  }),
}));

import { POST as conta } from "@/app/api/admin/pedidos/[id]/conta/route";
import { avisarContactoDoPedido } from "@/lib/avisar-contacto-do-pedido";
import { foiJuntadoPelaApp } from "@/lib/juntado-pela-app";

const chamar = (accao: unknown, id = "601") =>
  conta(
    new NextRequest(`https://clyon.pt/api/admin/pedidos/${id}/conta`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer x" },
      body: JSON.stringify({ accao }),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  estado.pedida = "cliente.teste@exemplo.pt";
  estado.email = null;
  estado.juntadaEm = null;
  historico.length = 0;
  vi.clearAllMocks();
});

describe("R13 — a Mesa decide a junção de um pedido sem email", () => {
  it("confirmar liga o pedido, regista e avisa o contacto", async () => {
    const r = await chamar("aprovar");
    expect(r.status).toBe(200);
    expect(estado.email).toBe("cliente.teste@exemplo.pt");
    expect(historico).toEqual(["Pedido juntado à conta c•••@exemplo.pt (confirmado na Mesa)."]);
    expect(vi.mocked(avisarContactoDoPedido).mock.calls[0][1]).toBe(
      "O pedido #601 ficou ligado à conta c•••@exemplo.pt na app da CLYON. Não reconhece este pedido? Responda a esta mensagem.",
    );
    // Duas vezes não liga duas vezes.
    expect((await chamar("aprovar")).status).toBe(409);
  });

  it("recusar deixa o pedido sem conta", async () => {
    expect((await chamar("recusar")).status).toBe(200);
    expect(estado.email).toBeNull();
    expect(estado.pedida).toBeNull();
    expect(historico).toEqual(["Pedido de junção à conta recusado na Mesa."]);
  });

  it("desligar tira o email de um pedido ligado pela app; num pedido que não foi ligado assim, 409", async () => {
    await chamar("aprovar");
    expect((await chamar("desligar")).status).toBe(200);
    expect(estado.email).toBeNull();
    expect((await chamar("desligar")).status).toBe(409);
  });

  it("acção desconhecida → 400; pedido desconhecido → 404", async () => {
    expect((await chamar("apagar")).status).toBe(400);
    expect((await chamar("aprovar", "999")).status).toBe(404);
  });

  it("o histórico antigo «juntado pela app» conta como ligado pela app; o resto não", () => {
    expect(foiJuntadoPelaApp(JSON.stringify([{ message: "Pedido juntado à conta c•••@exemplo.pt pela app de cliente." }]))).toBe(true);
    expect(foiJuntadoPelaApp(JSON.stringify([{ message: "Pedido criado pelo simulador." }]))).toBe(false);
    expect(foiJuntadoPelaApp("lixo")).toBe(false);
  });

  it("a rota é só da equipa, e o desligar só mexe em pedidos ligados pela app", () => {
    const R = readFileSync(join(process.cwd(), "src/app/api/admin/pedidos/[id]/conta/route.ts"), "utf8");
    expect(R).toContain("requireAdmin(req)");
    const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const corpo = DB.slice(DB.indexOf("export async function desligarDaConta("), DB.indexOf("export async function appendOrderHistory("));
    expect(corpo).toMatch(/if \(!o\.contaJuntadaEm && !foiJuntadoPelaApp\(o\.historyJson\)\) return null;/);
  });
});
