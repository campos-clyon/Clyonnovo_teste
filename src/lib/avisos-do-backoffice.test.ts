import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * S19 — OS AVISOS DO BACKOFFICE (29-10-2026): as três falhas graves da matriz
 * B3. O contratado pela Mesa é avisado (BO12); os cancelamentos, pela Mesa
 * (BO23) e pelo cliente (BO24), avisam os profissionais com o motivo e, quando
 * é a CLYON, o cliente. Dados de teste.
 */

const pushes: Array<{ email: string; porque: string; motivo?: string | null }> = [];
const whatsapps: Array<{ para: string; texto: string }> = [];
const doCliente: Array<{ id: number; tipo: string; motivo?: string | null }> = [];

vi.mock("@/lib/db", () => ({
  perfilDoProfissional: vi.fn(async (id: number) => ({ email: `pro${id}@exemplo.pt`, phone: "912 345 678", name: "Pro" })),
  negociacoesDoPedido: vi.fn(async () => []),
}));
vi.mock("@/lib/avisar-por-push", () => ({
  avisarProfissionalSemOTrabalhoPorPush: vi.fn(async (d: { email: string; porque: string; motivo?: string | null }) => {
    pushes.push({ email: d.email, porque: d.porque, motivo: d.motivo });
  }),
}));
vi.mock("@/lib/whatsapp-cloud", () => ({
  enviarAvisoWhatsApp: vi.fn(async (para: string, texto: string) => {
    whatsapps.push({ para, texto });
    return true;
  }),
}));
vi.mock("@/lib/avisos-ao-cliente", async (original) => ({
  ...(await original<typeof import("@/lib/avisos-ao-cliente")>()),
  avisarOClienteDoPedido: vi.fn(async (id: number, tipo: string, extra: { motivo?: string | null } = {}) => {
    doCliente.push({ id, tipo, motivo: extra.motivo });
  }),
}));

import { avisarDoCancelamento } from "./avisar-cancelamento";
import { avisoSemOTrabalho } from "./textos-dos-avisos-ao-profissional";
import { avisoAoCliente } from "./avisos-ao-cliente";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

beforeEach(() => {
  pushes.length = 0;
  whatsapps.length = 0;
  doCliente.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const NEGOCIACOES = [
  { id: 1, estado: "acordada", providerId: 11 },
  { id: 2, estado: "aberta", providerId: 12 },
  { id: 3, estado: "morta", providerId: 13 },
  { id: 4, estado: "desistida", providerId: 14 },
];

describe("S19 — os cancelamentos avisam", () => {
  it("pela Mesa (BO23): os profissionais com proposta ou contratados, com o motivo; o contratado também por WhatsApp; e o cliente", async () => {
    await avisarDoCancelamento({ pedidoId: 801, negociacoes: NEGOCIACOES, motivo: "O cliente mudou de casa.", porQuem: "clyon" });
    expect(pushes.map((p) => p.email).sort()).toEqual(["pro11@exemplo.pt", "pro12@exemplo.pt"]);
    expect(pushes.every((p) => p.porque === "cancelado" && p.motivo === "O cliente mudou de casa.")).toBe(true);
    expect(whatsapps).toEqual([{ para: "912 345 678", texto: "O pedido #801 foi cancelado. Motivo: O cliente mudou de casa." }]);
    expect(doCliente).toEqual([{ id: 801, tipo: "cancelado", motivo: "O cliente mudou de casa." }]);
  });

  it("pelo cliente (BO24): os profissionais sabem, e o cliente não recebe aviso do que ele próprio fez", async () => {
    await avisarDoCancelamento({ pedidoId: 802, negociacoes: NEGOCIACOES, motivo: null, porQuem: "cliente" });
    expect(pushes).toHaveLength(2);
    expect(doCliente).toEqual([]);
  });

  it("os textos (G8)", () => {
    expect(avisoSemOTrabalho({ pedidoId: 9, porque: "cancelado", motivo: null })).toEqual({
      title: "Pedido #9 cancelado",
      body: "O pedido #9 foi cancelado.",
    });
    expect(avisoAoCliente("cancelado", { pedidoId: 9, motivo: "Sem disponibilidade." }).body).toBe(
      "O pedido #9 foi cancelado. Sem disponibilidade.",
    );
  });

  it("as duas portas do cancelamento chamam o aviso, com as negociações lidas antes de cancelar", () => {
    const MESA = ler("src/app/api/admin/negociacoes/cancelar/route.ts");
    expect(MESA.indexOf("const existentes = await negociacoesDoPedido(pedidoId);")).toBeLessThan(
      MESA.indexOf("await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo, porQuem: \"clyon\" });"),
    );
    expect(MESA).toContain('porQuem: "clyon"');
    expect(ler("src/lib/agir-como-cliente.ts")).toContain('avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo, porQuem: "cliente" })');
  });
});

describe("S19 — o contratado pela Mesa é avisado (BO12)", () => {
  it("a rota da Mesa chama o mesmo aviso de contratação do link do cliente (email com a morada e telemóvel)", () => {
    const R = ler("src/app/api/admin/negociacoes/agir/route.ts");
    expect(R).toMatch(/if \(nova\.estado === "acordada" && estadoActual\.estado !== "acordada"\) \{\s+await avisarQueFoiContratadoSemFalhar\(/);
    expect(ler("src/lib/agir-como-cliente.ts")).toMatch(/export async function avisarQueFoiContratadoSemFalhar\(/);
  });

  it("o aviso genérico de mudança de estado leva o pedido (a app abre-o)", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("const push = STATUS_PUSH[newStatus];");
    expect(i).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 600)).toMatch(/pedidoId: id,/);
  });
});
