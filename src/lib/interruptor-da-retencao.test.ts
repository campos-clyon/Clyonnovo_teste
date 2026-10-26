import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * O INTERRUPTOR DAS REGRAS NOVAS DA RETENÇÃO, NO CRON DA PURGA — d32, 26-10-2026.
 *
 * *«As regras novas entram em MODO ENSAIO. (…) Só passam a valer a sério quando
 * o dono as ligar. As regras de hoje continuam a correr como estão.»*
 *
 * Aqui prova-se a ligação, com a base e as regras fingidas: desligado, a purga
 * de hoje corre como corria e as regras novas só contam; ligado e com a purga
 * armada, as regras novas fazem-se a sério; ligado sem a purga armada, nada
 * se faz a sério. E todas as noites fica uma linha no registo (parte G).
 */

const estado = vi.hoisted(() => ({ ligado: false }));
const ZERO = {
  elegiveis: 0,
  expurgados: 0,
  falhados: [],
  fotosApagadas: 0,
  eventosApagados: 0,
  eventosQueFicaram: 0,
  eventosNaoEncontrados: 0,
  restantes: 0,
  aSerio: true,
  naMira: [],
};

vi.mock("@/lib/db", () => ({
  interruptorDasRegrasNovas: vi.fn(async () => ({ ligado: estado.ligado, mudadoEm: null, porQuem: null })),
  purgarPedidosTerminados: vi.fn(async (_dias: number, o: { aSerio: boolean }) => ({ ...ZERO, aSerio: o.aSerio })),
  purgarRecolhasDoWhatsApp: vi.fn(async () => ({ abandonadas: 0, orfas: 0, aSerio: false })),
  purgarFotosPendentesDoWhatsApp: vi.fn(async () => 0),
  purgarContactosAMeio: vi.fn(async () => 0),
  anonimizarArquivoAntigo: vi.fn(async () => ({ anonimizadas: 0, restantes: 0, aSerio: false })),
  tentarOsEventosPorApagar: vi.fn(async () => ({ tentados: 0, apagados: 0, ficaram: 0, desistidos: 0 })),
  registarSemFalhar: vi.fn(async () => {}),
}));

vi.mock("@/lib/regras-novas-na-base", () => ({
  purgarComAsRegrasNovas: vi.fn(async (o: { aSerio: boolean }) => ({ ...ZERO, aSerio: o.aSerio })),
  regrasNovasDaNoite: vi.fn(async (o: { aSerio: boolean }) => ({ aSerio: o.aSerio, e: { lista: ["simulador/x.jpg"] } })),
  regrasNovasEmPalavras: vi.fn((r: { aSerio: boolean }) =>
    r.aSerio ? "Regras novas LIGADAS: …" : "Regras novas em ENSAIO (nada mudou): …",
  ),
}));

import * as db from "@/lib/db";
import * as novas from "@/lib/regras-novas-na-base";
import { GET as purgar } from "@/app/api/cron/purgar-pedidos/route";

const pedir = () =>
  purgar(new NextRequest("http://localhost/api/cron/purgar-pedidos", { headers: { authorization: "Bearer segredo" } }));

const resumoDaNoite = () => {
  const chamadas = vi.mocked(db.registarSemFalhar).mock.calls;
  expect(chamadas).toHaveLength(1);
  return chamadas[0][0] as { resumo: string; detalhe: { regrasNovas: { e: { lista: string[] } }; regrasNovasLigadas: boolean } };
};

const antes = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.CRON_SECRET = "segredo";
});
afterEach(() => {
  process.env = { ...antes };
  estado.ligado = false;
});

describe("desligado (é assim que nasce): as regras de hoje correm como estão, as novas só contam", () => {
  it("com a purga armada", async () => {
    process.env.PURGA_ARMADA = "sim";
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(db.purgarPedidosTerminados).toHaveBeenCalledWith(60, { aSerio: true, diasDosAbandonados: 90 });
    expect(novas.purgarComAsRegrasNovas).not.toHaveBeenCalled();
    expect(novas.regrasNovasDaNoite).toHaveBeenCalledWith({ aSerio: false });
    const linha = resumoDaNoite();
    expect(linha.resumo).toContain("ENSAIO");
    expect(linha.detalhe.regrasNovasLigadas).toBe(false);
  });

  it("com a purga em modo seco", async () => {
    delete process.env.PURGA_ARMADA;
    await pedir();
    expect(db.purgarPedidosTerminados).toHaveBeenCalledWith(60, { aSerio: false, diasDosAbandonados: 90 });
    expect(novas.regrasNovasDaNoite).toHaveBeenCalledWith({ aSerio: false });
  });
});

describe("ligado pelo dono", () => {
  it("com a purga armada, as regras novas fazem-se a sério — e a purga de hoje não corre", async () => {
    process.env.PURGA_ARMADA = "sim";
    estado.ligado = true;
    await pedir();
    expect(novas.purgarComAsRegrasNovas).toHaveBeenCalledWith({ aSerio: true });
    expect(db.purgarPedidosTerminados).not.toHaveBeenCalled();
    expect(novas.regrasNovasDaNoite).toHaveBeenCalledWith({ aSerio: true });
    const linha = resumoDaNoite();
    expect(linha.resumo).toContain("com as regras novas");
    expect(linha.resumo).toContain("LIGADAS");
    expect(linha.detalhe.regrasNovasLigadas).toBe(true);
  });

  it("sem a purga armada, nada se faz a sério", async () => {
    delete process.env.PURGA_ARMADA;
    estado.ligado = true;
    await pedir();
    expect(novas.purgarComAsRegrasNovas).not.toHaveBeenCalled();
    expect(db.purgarPedidosTerminados).toHaveBeenCalledWith(60, { aSerio: false, diasDosAbandonados: 90 });
    expect(novas.regrasNovasDaNoite).toHaveBeenCalledWith({ aSerio: false });
  });
});

describe("G — uma linha no registo todas as noites", () => {
  it("mesmo sem nada para fazer: «purga correu, 0 elegíveis», com as contagens do ensaio", async () => {
    process.env.PURGA_ARMADA = "sim";
    await pedir();
    const linha = resumoDaNoite();
    expect(linha.resumo).toMatch(/^Purga correu: 0 elegíveis, nada apagado\. Regras novas em ENSAIO/);
  });

  it("e sem os nomes dos ficheiros no registo, que é para sempre", async () => {
    process.env.PURGA_ARMADA = "sim";
    await pedir();
    expect(resumoDaNoite().detalhe.regrasNovas.e.lista).toEqual([]);
  });

  it("se as regras novas falharem, a linha escreve-se na mesma, a dizê-lo", async () => {
    process.env.PURGA_ARMADA = "sim";
    vi.mocked(novas.regrasNovasDaNoite).mockRejectedValueOnce(new Error("base em baixo"));
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(resumoDaNoite().resumo).toContain("o ensaio falhou esta noite (base em baixo)");
  });
});

describe("o interruptor fica desligado na dúvida", () => {
  it("sem base nenhuma, lê-se desligado — e as regras novas não valem, nem com a purga armada", async () => {
    const real = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
    const urlAntes = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    process.env.PURGA_ARMADA = "sim";
    try {
      await expect(real.interruptorDasRegrasNovas()).resolves.toEqual({ ligado: false, mudadoEm: null, porQuem: null });
      await expect(real.regrasNovasValem()).resolves.toBe(false);
    } finally {
      if (urlAntes !== undefined) process.env.DATABASE_URL = urlAntes;
    }
    // Importar o db.ts verdadeiro a meio da suite inteira leva tempo (é um ficheiro grande).
  }, 120_000);
});
