import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * R7 — O CATÁLOGO DA APP DE CLIENTE (d8 fase 2, S4, 28-10-2026).
 *
 * A frase única carácter a carácter; sem «hoje» nem big bags; nenhum preço; os
 * serviços são os do simulador, com os nomes de `NOMES_DOS_SERVICOS`.
 */

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { GET as catalogo } from "@/app/api/cliente/catalogo/route";
import { SERVICOS_PUBLICOS, NOMES_DOS_SERVICOS } from "@/lib/service-categories";
import { TELEFONE_DA_CLYON } from "@/lib/telefone-da-clyon";

async function ler() {
  const r = await catalogo(new NextRequest("https://clyon.pt/api/cliente/catalogo"));
  expect(r.status).toBe(200);
  return { r, j: await r.json() };
}

describe("S4 — GET /api/cliente/catalogo", () => {
  it("a frase única, carácter a carácter", async () => {
    const { j } = await ler();
    expect(j.textos.fraseUnica).toBe(
      "Profissionais verificados fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento.",
    );
  });

  it("os serviços são os do simulador, com os nomes de NOMES_DOS_SERVICOS", async () => {
    const { j } = await ler();
    expect(j.servicos.map((s: { id: string }) => s.id)).toEqual(SERVICOS_PUBLICOS.map((c) => c.id));
    for (const s of j.servicos) expect(s.nome).toBe(NOMES_DOS_SERVICOS[s.id]);
    // Fora do plano (montagem, jardinagem) não entram.
    expect(j.servicos.map((s: { id: string }) => s.id)).not.toContain("jardinagem");
    expect(j.servicos.map((s: { id: string }) => s.id)).not.toContain("montagem_moveis");
  });

  it("sem «hoje», sem «no próprio dia», sem big bags nem contentores", async () => {
    const { j } = await ler();
    const texto = JSON.stringify(j).toLowerCase();
    for (const p of ["hoje", "today", "próprio dia", "big bag", "bigbag", "contentor"]) expect(texto, p).not.toContain(p);
    expect(j.quando).toEqual(["amanha", "esta_semana", "data", "flexivel"]);
  });

  it("nenhum preço", async () => {
    const { j } = await ler();
    const texto = JSON.stringify(j);
    expect(texto).not.toContain("€");
    expect(texto).not.toMatch(/"(preco|precos|valor|valores|taxa|taxas|iva|minimo)"\s*:/i);
    expect(texto).not.toMatch(/\d+,\d{2}/);
  });

  it("em cache curta, público, com o WhatsApp da CLYON", async () => {
    const { r, j } = await ler();
    expect(r.headers.get("cache-control")).toContain("max-age=300");
    expect(j.whatsapp).toBe(TELEFONE_DA_CLYON);
  });
});
