import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O PEDIDO DA APP DE CLIENTE — o resto da R3 (d8 fase 2, S5, 28-10-2026).
 *
 * Critérios 10, 10a e 14: o dia escolhido (de amanhã em diante, em Lisboa) vai
 * para a Mesa; «hoje» vindo da app é recusado com 400; a origem é «app»; os
 * rascunhos de antes são só um número; sem sessão o pedido segue com o email
 * escrito, como no simulador.
 */

vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/cliente-auth", () => ({
  limitarPorContaDoCliente: vi.fn(async () => ({ erro: null })),
  sessaoDoCliente: vi.fn(async () => null),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));

import { POST as enviarPedido } from "@/app/api/simulador/pedido/route";
import {
  DIA_A_PARTIR_DE_AMANHA,
  SEM_HOJE_NA_APP,
  lerDataPreferida,
  lerRascunhosAntes,
  urgenciaDoDia,
} from "@/lib/pedido-da-app-de-cliente";

// 23:30 em Lisboa a 28-10-2026 (Inverno: UTC+0) — às 00:30 de 29 em Paris.
const AGORA = new Date("2026-10-28T23:30:00Z");

function pedido(order: Record<string, unknown>) {
  return new NextRequest("https://clyon.pt/api/simulador/pedido", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order: { receiver: { name: "Cliente Teste", phone: "912345678" }, ...order } }),
  });
}

describe("S5 — o dia preferido, em Lisboa", () => {
  it("de amanhã em diante: hoje e o passado não", () => {
    expect(lerDataPreferida("2026-10-28", AGORA)).toEqual({ ok: false, erro: DIA_A_PARTIR_DE_AMANHA });
    expect(lerDataPreferida("2026-10-27", AGORA)).toEqual({ ok: false, erro: DIA_A_PARTIR_DE_AMANHA });
    const amanha = lerDataPreferida("2026-10-29", AGORA);
    expect(amanha.ok && amanha.dia).toBe("2026-10-29");
    // O primeiro instante desse dia, em Lisboa.
    expect(amanha.ok && amanha.inicio?.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  });

  it("forma errada ou um dia que não existe: recusado; sem dia: nada", () => {
    for (const v of ["29/10/2026", "2026-02-30", 20261029, "amanhã"]) {
      expect(lerDataPreferida(v, AGORA).ok).toBe(false);
    }
    expect(lerDataPreferida(undefined, AGORA)).toEqual({ ok: true, dia: null, inicio: null });
  });

  it("a urgência sai do dia; os rascunhos são um inteiro de 0 a 50", () => {
    expect(urgenciaDoDia("2026-10-29", AGORA)).toBe("tomorrow");
    expect(urgenciaDoDia("2026-11-03", AGORA)).toBe("this_week");
    expect(urgenciaDoDia("2026-12-01", AGORA)).toBe("flexible");
    expect(lerRascunhosAntes(3)).toBe(3);
    expect(lerRascunhosAntes("2")).toBe(2);
    for (const v of [-1, 51, 2.5, "x", null]) expect(lerRascunhosAntes(v)).toBeNull();
  });
});

describe("S5 — a porta do pedido recusa antes de gravar", () => {
  it("«hoje» vindo da app → 400", async () => {
    const r = await enviarPedido(pedido({ origemPedido: "app_cliente", urgency: "today", serviceType: "recolha_moveis" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: SEM_HOJE_NA_APP, campo: "quando" });
  });

  it("uma dataPreferida de hoje (ou do passado) → 400", async () => {
    const r = await enviarPedido(pedido({ origemPedido: "app_cliente", dataPreferida: "2020-01-01" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: DIA_A_PARTIR_DE_AMANHA, campo: "dataPreferida" });
  });

  it("o dia vai para a Mesa (dataAgendada), e sem sessão segue com o email escrito", () => {
    const R = readFileSync(join(process.cwd(), "src/app/api/simulador/pedido/route.ts"), "utf8");
    expect(R).toContain("...(dataPreferida.inicio ? { dataAgendada: dataPreferida.inicio } : {}),");
    expect(R).toContain("const contactEmail = sessionEmail ?? formEmail;");
    // A origem e os rascunhos ficam no rawOrderJson (não se mostram ao cliente).
    expect(R).toContain("rawOrderJson: JSON.stringify(order),");
    expect(R).toContain("else order.rascunhosAntes = rascunhosAntes;");
  });
});
