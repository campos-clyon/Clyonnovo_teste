import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * As rotas a sério, com a base a falhar — e não o texto delas.
 *
 * Os outros testes destas correcções lêem o código-fonte. Estes chamam as
 * rotas com a base simulada, porque o que interessa aqui é um comportamento:
 * o que a rota RESPONDE quando nada ficou gravado, e quando a galeria não
 * consegue ler a imagem.
 */

vi.mock("@/lib/db", () => ({
  createSimulatorOrder: vi.fn(),
  createLead: vi.fn(),
  createLeadEvent: vi.fn(() => Promise.resolve()),
  appendOrderHistory: vi.fn(() => Promise.resolve()),
  calculateOrderPriority: vi.fn(() => "normal"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/whatsapp", () => ({ notifyNewOrder: vi.fn() }));
vi.mock("@/lib/pricing-helper", () => ({ calculateFastEstimate: vi.fn(async () => null) }));
vi.mock("@/lib/work-gallery", () => ({ lerItemDaGaleria: vi.fn() }));

import * as db from "@/lib/db";
import * as galeria from "@/lib/work-gallery";
import { POST as heroQuote } from "@/app/api/hero-quote/route";
import { GET as imagemDaGaleria } from "@/app/api/media/gallery/render/[id]/route";

const PEDIDO = {
  primeiroNome: "Ana",
  ultimoNome: "Teste",
  indicativo: "+351",
  telefone: "912 345 678",
  rua: "Rua de Teste",
  codigoPostal: "2845-513",
  numeroPosta: "1",
  andar: "0",
  elevador: "no",
  tipoServico: "recolha_moveis",
};

function pedirOrcamento(corpo: unknown) {
  return heroQuote(
    new NextRequest("http://localhost/api/hero-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

beforeEach(() => {
  vi.mocked(db.createLead).mockReset();
  vi.mocked(db.createSimulatorOrder).mockReset();
  // As rotas registam as falhas no log; aqui as falhas são de propósito.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("o formulário da página inicial", () => {
  it("nada gravado: 500, com a frase para o cliente", async () => {
    vi.mocked(db.createLead).mockRejectedValue(new Error("base em baixo"));
    vi.mocked(db.createSimulatorOrder).mockRejectedValue(new Error("base em baixo"));
    const res = await pedirOrcamento(PEDIDO);
    expect(res.status).toBe(500);
    const corpo = await res.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toContain("WhatsApp");
  });

  it("só o lead falhou, mas o pedido ficou: é sucesso", async () => {
    vi.mocked(db.createLead).mockRejectedValue(new Error("base em baixo"));
    vi.mocked(db.createSimulatorOrder).mockResolvedValue(321);
    const res = await pedirOrcamento(PEDIDO);
    expect(res.status).toBe(200);
    expect((await res.json()).orderId).toBe(321);
  });

  it("só o pedido falhou, mas o lead ficou com o telefone: a equipa chega-lhe", async () => {
    vi.mocked(db.createLead).mockResolvedValue(undefined);
    vi.mocked(db.createSimulatorOrder).mockRejectedValue(new Error("base em baixo"));
    const res = await pedirOrcamento(PEDIDO);
    expect(res.status).toBe(200);
  });

  it("um telefone que não é telefone volta com a razão, no campo", async () => {
    const res = await pedirOrcamento({ ...PEDIDO, telefone: "12345" });
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.details.telefone[0]).toMatch(/9 dígitos/);
    expect(db.createSimulatorOrder).not.toHaveBeenCalled();
  });

  it("os outros campos voltam em português", async () => {
    const res = await pedirOrcamento({ ...PEDIDO, primeiroNome: "A", elevador: "talvez" });
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.details.primeiroNome).toEqual(["Mínimo 2 caracteres"]);
    expect(corpo.details.elevador).toEqual(["Indique se há elevador"]);
  });
});

describe("a imagem da galeria", () => {
  const pedirImagem = (id: string) =>
    imagemDaGaleria(new Request(`http://localhost/api/media/gallery/render/${id}`), {
      params: Promise.resolve({ id }),
    });

  it("com a base a falhar responde 503 passageiro, e não 404", async () => {
    vi.mocked(galeria.lerItemDaGaleria).mockRejectedValue(new Error("ECONNRESET"));
    const res = await pedirImagem("uma-real");
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uma imagem que não existe continua a ser 404", async () => {
    vi.mocked(galeria.lerItemDaGaleria).mockResolvedValue(null);
    const res = await pedirImagem("nao-existe");
    expect(res.status).toBe(404);
  });
});
