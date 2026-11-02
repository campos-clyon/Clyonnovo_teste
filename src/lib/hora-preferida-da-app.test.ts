import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * A HORA À ESCOLHA NO PEDIDO DA APP DE CLIENTE — 02-11-2026 (ordem do CEO com
 * o sim do dono, «o cliente escolhe dia e horário no calendário»).
 *
 * A app manda `horaPreferida` («HH:MM» de Lisboa, 08:00–20:00 de 30 em 30 min)
 * com a `dataPreferida`; a rota grava o dia e a hora no `dataAgendada` — o
 * mesmo campo que o backoffice mostra («para 13/11, 10:30»). Sem hora fica a
 * meia-noite de Lisboa («só o dia»), como antes.
 */

const gravado = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));

vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/cliente-auth", () => ({
  limitarPorContaDoCliente: vi.fn(async () => ({ erro: null })),
  sessaoDoCliente: vi.fn(async () => null),
  emailDoCliente: vi.fn(async () => "cliente.teste@exemplo.pt"),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  createSimulatorOrder: vi.fn(async (row: Record<string, unknown>) => {
    gravado.row = row;
    return 999999;
  }),
  // Não se lê de volta: a rota pára aqui (500), depois de montar a linha.
  getSimulatorOrderById: vi.fn(async () => null),
  appendOrderHistory: vi.fn(async () => undefined),
  calculateOrderPriority: vi.fn(() => "normal"),
  taxasActuais: vi.fn(async () => ({ taxaCliente: 0, taxaProfissional: 11 })),
}));

import { POST as enviarPedido } from "@/app/api/simulador/pedido/route";
import {
  HORA_ENTRE_8_E_20,
  HORA_SEM_DIA,
  horaDoAgendado,
  instanteDoDiaEHora,
  lerHoraPreferida,
} from "@/lib/pedido-da-app-de-cliente";
import { dataPreferidaTexto } from "@/lib/pedido-completo-para-a-app";
import { diaEHoraCurtosEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";

function pedido(order: Record<string, unknown>) {
  return new NextRequest("https://clyon.pt/api/simulador/pedido", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      order: {
        receiver: { name: "Cliente Teste", phone: "912345678", email: "cliente.teste@exemplo.pt" },
        origemPedido: "app_cliente",
        serviceType: "recolha_moveis",
        description: "Um sofá.",
        address: { formattedAddress: "Rua de Exemplo 1, Lisboa", city: "Lisboa", postalCode: "1000-001" },
        distanceFromBase: { distanceKm: 10 },
        ...order,
      },
    }),
  });
}

/** Um dia daqui a uns tempos, para estar sempre «de amanhã em diante». */
function diaFuturo(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

beforeEach(() => {
  gravado.row = null;
});

describe("a hora preferida — a leitura", () => {
  it("08:00 a 20:00, de 30 em 30 minutos; sem hora, nada", () => {
    expect(lerHoraPreferida("08:00")).toEqual({ ok: true, hora: "08:00" });
    expect(lerHoraPreferida("10:30")).toEqual({ ok: true, hora: "10:30" });
    expect(lerHoraPreferida("20:00")).toEqual({ ok: true, hora: "20:00" });
    for (const v of ["07:30", "20:30", "10:15", "9:00", "10h30", 1030, "24:00"]) {
      expect(lerHoraPreferida(v)).toEqual({ ok: false, erro: HORA_ENTRE_8_E_20 });
    }
    expect(lerHoraPreferida(undefined)).toEqual({ ok: true, hora: null });
    expect(lerHoraPreferida("")).toEqual({ ok: true, hora: null });
  });

  it("a hora é de Lisboa: Inverno UTC+0, Verão UTC+1", () => {
    expect(instanteDoDiaEHora("2026-11-13", "10:30").toISOString()).toBe("2026-11-13T10:30:00.000Z");
    expect(instanteDoDiaEHora("2027-07-13", "10:30").toISOString()).toBe("2027-07-13T09:30:00.000Z");
    expect(instanteDoDiaEHora("2026-11-13", null).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(horaDoAgendado(instanteDoDiaEHora("2027-07-13", "14:00"))).toBe("14:00");
    expect(horaDoAgendado(instanteDoDiaEHora("2027-07-13", null))).toBeNull();
  });

  it("o backoffice e a app lêem a hora do mesmo campo", () => {
    const agendado = instanteDoDiaEHora("2026-11-13", "10:30");
    expect(diaEHoraCurtosEmLisboa(agendado)).toBe("13/11, 10:30");
    expect(dataPreferidaTexto(agendado)).toBe("13/11/2026, às 10h30");
    expect(dataPreferidaTexto(instanteDoDiaEHora("2026-11-13", null))).toBe("13/11/2026");
    // Como vem da base (UTC, sem fuso).
    expect(dataPreferidaTexto("2026-11-13 10:30:00")).toBe("13/11/2026, às 10h30");
    expect(instanteDaBase("2026-11-13 10:30:00")?.getTime()).toBe(agendado.getTime());
  });
});

describe("a hora preferida — a rota do pedido", () => {
  it("com dia e hora: dataAgendada é o dia à hora de Lisboa", async () => {
    const dia = diaFuturo(10);
    await enviarPedido(pedido({ dataPreferida: dia, horaPreferida: "10:30" }));
    expect(gravado.row).not.toBeNull();
    const agendado = gravado.row!.dataAgendada as Date;
    expect(agendado.getTime()).toBe(instanteDoDiaEHora(dia, "10:30").getTime());
    expect(horaDoAgendado(agendado)).toBe("10:30");
  });

  it("só com o dia: a meia-noite de Lisboa, como antes", async () => {
    const dia = diaFuturo(10);
    await enviarPedido(pedido({ dataPreferida: dia }));
    const agendado = gravado.row!.dataAgendada as Date;
    expect(agendado.getTime()).toBe(instanteDoDiaEHora(dia, null).getTime());
    expect(horaDoAgendado(agendado)).toBeNull();
  });

  it("hora fora das 8h–20h ou fora dos 30 min → 400, sem gravar", async () => {
    const r = await enviarPedido(pedido({ dataPreferida: diaFuturo(10), horaPreferida: "21:00" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: HORA_ENTRE_8_E_20, campo: "horaPreferida" });
    expect(gravado.row).toBeNull();
  });

  it("hora sem dia → 400, sem gravar", async () => {
    const r = await enviarPedido(pedido({ urgency: "flexible", horaPreferida: "10:00" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: HORA_SEM_DIA, campo: "horaPreferida" });
    expect(gravado.row).toBeNull();
  });
});
