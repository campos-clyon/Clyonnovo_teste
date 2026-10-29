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
      "Parceiros verificados fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento.",
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
    // As perguntas e os testemunhos são os textos do site, guardados pela orquestra (S12, 29-10-2026).
    const texto = JSON.stringify({ ...j, perguntas: [], avaliacoes: null }).toLowerCase();
    for (const p of ["hoje", "today", "próprio dia", "big bag", "bigbag", "contentor"]) expect(texto, p).not.toContain(p);
    expect(j.quando).toEqual(["amanha", "esta_semana", "data", "flexivel"]);
  });

  it("v2 (S12): nenhum preço sem o valor com IVA ao lado, nenhum número para a app fazer contas", async () => {
    const { j } = await ler();
    const semIva: string[] = [];
    const andar = (v: unknown) => {
      if (typeof v === "string") {
        if (v.includes("€") && !v.includes("com IVA")) semIva.push(v);
      } else if (Array.isArray(v)) v.forEach(andar);
      else if (v && typeof v === "object") Object.values(v).forEach(andar);
    };
    andar(j);
    expect(semIva).toEqual([]);
    expect(JSON.stringify(j)).not.toMatch(/"(valor|valores|taxa|taxas|iva)"\s*:/i);
    const servico = (id: string) => j.servicos.find((s: { id: string }) => s.id === id);
    expect(servico("recolha_moveis").precoReferencia).toBe("40 – 120 € + IVA (49,20 – 147,60 € com IVA)");
    expect(servico("outro").precoReferencia).toBeNull();
  });

  it("v2 (S12): como funciona, perguntas e os três passos são os mesmos textos das páginas", async () => {
    const { j } = await ler();
    const { PASSOS_DE_COMO_FUNCIONA } = await import("@/lib/como-funciona");
    const { PERGUNTAS_FREQUENTES } = await import("@/lib/perguntas-frequentes");
    const { TRES_PASSOS_DEPOIS_DE_ENVIAR } = await import("@/lib/textos-do-pedido");
    expect(j.comoFunciona.map((p: { texto: string }) => p.texto)).toEqual(PASSOS_DE_COMO_FUNCIONA.map((p) => p.texto));
    expect(j.perguntas.length).toBe(PERGUNTAS_FREQUENTES.flatMap((c) => c.questions).length);
    expect(j.textos.tresPassos).toEqual(TRES_PASSOS_DEPOIS_DE_ENVIAR);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pagina = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    // As páginas leem as mesmas constantes, e não uma cópia.
    expect(pagina("src/app/como-funciona/page.tsx")).toContain("PASSOS_DE_COMO_FUNCIONA.map(");
    expect(pagina("src/app/faq/page.tsx")).toContain("const faqCategories = PERGUNTAS_FREQUENTES;");
    expect(pagina("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("...TRES_PASSOS_DEPOIS_DE_ENVIAR[0]");
    // Avaliações só do Google, com o mês da contagem.
    expect(j.avaliacoes.resumo).toMatch(/avaliações no Google \(\w+ de \d{4}\)$/);
  });

  it("em cache curta, público, com o WhatsApp da CLYON", async () => {
    const { r, j } = await ler();
    expect(r.headers.get("cache-control")).toContain("max-age=300");
    expect(j.whatsapp).toBe(TELEFONE_DA_CLYON);
  });
});
