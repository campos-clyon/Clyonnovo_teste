import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// relógio: datas explícitas — o «Dispensar» não lê a data do modelo; o aviso de exemplo leva a sua.

/**
 * d72 (19-11-2026): os avisos do euPago que não movem dinheiro e o «Dispensar».
 *
 * A regra pura (`dispensar-aviso-do-eupago.ts`), a rota do «Dispensar» com uma
 * base em memória, e a porta: só o administrador geral, nunca o assistente com
 * a secção Pagamentos. O webhook está em `webhook-do-eupago-rota.test.ts`.
 */

type AvisoNaBase = {
  id: number;
  trid: string;
  estado: string;
  pagamentoId: number | null;
  valor: number | null;
  metodo: string | null;
  nota: string | null;
  recebidoEm: Date;
  aplicado: boolean;
};

const base = {
  avisos: new Map<number, AvisoNaBase>(),
  historico: [] as Array<{ pedidoId: number; message: string }>,
  registo: [] as Array<{ acontecimento: string; resumo?: string; pedidoId?: number | null }>,
  admin: true,
};

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdminGeral: async () =>
    base.admin
      ? { err: null, colab: { id: 1, nome: "Admin", isAdmin: true, papel: "admin" } }
      : { err: NextResponse.json({ error: "Apenas administradores." }, { status: 403 }), colab: null },
}));

vi.mock("@/lib/db", () => ({
  appendOrderHistory: async (pedidoId: number, e: { message: string }) => {
    base.historico.push({ pedidoId, message: e.message });
  },
  registarSemFalhar: async (r: { acontecimento: string; resumo?: string; pedidoId?: number | null }) => {
    base.registo.push(r);
  },
}));

vi.mock("@/lib/pagamentos-na-base", () => ({
  avisoPorId: async (id: number) => {
    const a = base.avisos.get(id);
    return a ? { ...a } : null;
  },
  // Como na base: só pega num aviso por aplicar, e nunca apaga.
  dispensarAviso: async (id: number, nota: string) => {
    const a = base.avisos.get(id);
    if (!a || a.aplicado) return false;
    a.aplicado = true;
    a.nota = nota;
    return true;
  },
  pagamentoPorId: async (id: number) => (id === 177 ? { id: 177, pedidoId: 501, negociacaoId: 70, providerId: 3 } : null),
}));

beforeAll(async () => {
  await import("@/app/api/admin/pagamentos/dispensar-aviso/route");
}, 60_000);

beforeEach(() => {
  base.avisos.clear();
  base.historico.length = 0;
  base.registo.length = 0;
  base.admin = true;
  base.avisos.set(9, {
    id: 9,
    trid: "T177",
    estado: "expirado",
    pagamentoId: 177,
    valor: 12,
    metodo: "multibanco",
    nota: "O pagamento já não estava pendente.",
    recebidoEm: new Date(),
    aplicado: false,
  });
});

async function dispensar(corpo: unknown) {
  const { POST } = await import("@/app/api/admin/pagamentos/dispensar-aviso/route");
  const req = new Request("https://clyon.pt/api/admin/pagamentos/dispensar-aviso", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer x" },
    body: JSON.stringify(corpo),
  });
  return POST(req as never);
}

describe("a regra pura", () => {
  it("expirado/cancelado/erro num pagamento já fechado → aplicado, com nota; pegou → aplicado sem nota", async () => {
    const { anotacaoDoFechoSemPagar } = await import("@/lib/dispensar-aviso-do-eupago");
    for (const e of ["expirado", "cancelado", "erro"] as const) {
      const n = anotacaoDoFechoSemPagar(e, { feito: false, porque: "O pagamento já não estava pendente." });
      expect(n.aplicado).toBe(true);
      expect(n.nota).toContain("não moveu dinheiro");
      expect(n.nota).toContain(e);
    }
    expect(anotacaoDoFechoSemPagar("expirado", { feito: true })).toEqual({ aplicado: true, nota: null });
  });

  it("o motivo é obrigatório e tem no máximo 200 caracteres", async () => {
    const { lerDispensa, notaDaDispensa } = await import("@/lib/dispensar-aviso-do-eupago");
    expect(lerDispensa({ avisoId: 9 }).ok).toBe(false);
    expect(lerDispensa({ avisoId: 9, motivo: "  " }).ok).toBe(false);
    expect(lerDispensa({ avisoId: 9, motivo: "x".repeat(201) }).ok).toBe(false);
    expect(lerDispensa({ motivo: "teste" }).ok).toBe(false);
    const ok = lerDispensa({ avisoId: "9", motivo: " referência   de teste " });
    expect(ok).toEqual({ ok: true, pedido: { avisoId: 9, motivo: "referência de teste" } });
    expect(notaDaDispensa("Admin", "teste")).toBe("Dispensado por Admin: teste");
    expect(notaDaDispensa("A", "x".repeat(300)).length).toBe(255);
  });
});

describe("a rota do «Dispensar»", () => {
  it("sem ser administrador → 403 e o aviso fica por aplicar", async () => {
    base.admin = false;
    const r = await dispensar({ avisoId: 9, motivo: "referência de teste" });
    expect(r.status).toBe(403);
    expect(base.avisos.get(9)!.aplicado).toBe(false);
    expect(base.registo).toHaveLength(0);
  });

  it("sem motivo, ou com mais de 200 caracteres → 400 e nada muda", async () => {
    expect((await dispensar({ avisoId: 9 })).status).toBe(400);
    expect((await dispensar({ avisoId: 9, motivo: "x".repeat(201) })).status).toBe(400);
    expect(base.avisos.get(9)!.aplicado).toBe(false);
  });

  it("administrador com motivo → aplicado, nota «Dispensado por…», histórico e registo; a linha fica", async () => {
    const r = await dispensar({ avisoId: 9, motivo: "referência de teste que expirou sem pagamento" });
    expect(r.status).toBe(200);
    const a = base.avisos.get(9)!;
    expect(a.aplicado).toBe(true);
    expect(a.nota).toBe("Dispensado por Admin: referência de teste que expirou sem pagamento");
    expect(base.historico).toHaveLength(1);
    expect(base.historico[0].pedidoId).toBe(501);
    expect(base.registo).toEqual([expect.objectContaining({ acontecimento: "aviso_dispensado", pedidoId: 501 })]);
    // Uma segunda vez não reescreve.
    expect((await dispensar({ avisoId: 9, motivo: "outra vez" })).status).toBe(409);
    expect(base.avisos.get(9)!.nota).toContain("expirou sem pagamento");
  });

  it("um aviso que não existe → 404", async () => {
    expect((await dispensar({ avisoId: 99, motivo: "teste" })).status).toBe(404);
  });
});

describe("a porta: só o administrador", () => {
  const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/pagamentos/dispensar-aviso/route.ts"), "utf8");
  const BASE = readFileSync(join(process.cwd(), "src/lib/pagamentos-na-base.ts"), "utf8");

  it("a rota chama o requireAdminGeral (o assistente nunca passa)", () => {
    expect(ROTA).toMatch(/await requireAdminGeral\(req\)/);
    expect(ROTA).not.toMatch(/await requireAdmin\(req\)/);
  });

  it("o assistente com a secção Pagamentos não pode chamar a rota", async () => {
    const { assistenteComSeccoesPodeChamar } = await import("@/lib/papel-do-painel");
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], "/api/admin/pagamentos/dispensar-aviso", "POST")).toBe(false);
  });

  it("dispensar nunca apaga: é um UPDATE que só pega num aviso por aplicar", () => {
    const f = BASE.slice(BASE.indexOf("export async function dispensarAviso"), BASE.indexOf("/** O código de erro do MySQL"));
    expect(f).toMatch(/UPDATE avisosDoEupago SET aplicado = 1, nota = \? WHERE id = \? AND aplicado = 0/);
    expect(f).not.toMatch(/DELETE/i);
  });

  it("o alarme e a lista contam só o que fica por aplicar", () => {
    const lista = BASE.slice(BASE.indexOf("export async function avisosPorAplicar"));
    expect(lista.slice(0, 600)).toMatch(/WHERE aplicado = 0 AND/);
    expect(BASE).toMatch(/SELECT COUNT\(\*\) AS n FROM avisosDoEupago WHERE aplicado = 0 AND/);
  });
});
