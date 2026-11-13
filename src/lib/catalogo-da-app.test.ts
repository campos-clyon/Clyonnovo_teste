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
import { PEDIDO_URGENTE } from "@/lib/promessas-publicas";

async function ler() {
  const r = await catalogo(new NextRequest("https://clyon.pt/api/cliente/catalogo"));
  expect(r.status).toBe(200);
  return { r, j: await r.json() };
}

describe("S4 — GET /api/cliente/catalogo", () => {
  it("a frase única, carácter a carácter", async () => {
    const { j } = await ler();
    expect(j.textos.fraseUnica).toBe(
      "Parceiros fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento.",
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

  it("«Hoje» como no simulador, como pedido urgente sem prometer o dia (d8); sem «no próprio dia», sem big bags nem contentores", async () => {
    const { j } = await ler();
    // As perguntas e os testemunhos são os textos do site, guardados pela orquestra (S12, 29-10-2026).
    // O big bag só como a MEDIDA do que o cliente já tem, na pergunta «Que sacos são?» do entulho
    // (dono, 03-11-2026, d1) — a ajuda diz que a CLYON não os fornece nem aluga. Em mais lado nenhum.
    const semAMedida = JSON.parse(JSON.stringify(j));
    for (const s of semAMedida.servicos) {
      for (const p of s.perguntas ?? []) {
        if (s.id === "recolha_entulho" && p.id === "tipoDeSaco") {
          const bigbag = p.opcoes.find((o: { id: string }) => o.id === "bigbag");
          expect(bigbag.nome).toBe("Big bags (cerca de 1 m³)");
          expect(bigbag.ajuda).toMatch(/só a medida dos que já tem: a CLYON não fornece nem aluga big bags nem contentores\.$/);
          p.opcoes = p.opcoes.filter((o: { id: string }) => o.id !== "bigbag");
        }
        if (s.id === "recolha_entulho" && p.id === "quantidade") {
          delete p.unidadePor.unidades.bigbag;
          p.quando.tipoDeSaco = p.quando.tipoDeSaco.filter((x: string) => x !== "bigbag");
        }
      }
    }
    const texto = JSON.stringify({ ...semAMedida, perguntas: [], avaliacoes: null }).toLowerCase();
    for (const p of ["today", "próprio dia", "mesmo dia", "big bag", "bigbag", "contentor"]) expect(texto, p).not.toContain(p);
    expect(j.quando).toEqual(["hoje", "amanha", "esta_semana", "data", "flexivel"]);
    expect(j.textos.pedidoUrgente).toBe(PEDIDO_URGENTE);
    expect(PEDIDO_URGENTE).toMatch(/urgente/);
    expect(PEDIDO_URGENTE).toMatch(/não fica garantido/);
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
    // Por peça desde 03-11-2026 (d6 v2), com a recolha mínima desde a d7 (04-11-2026).
    expect(servico("recolha_moveis").precoReferencia).toBe(
      "por peça: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50 € com IVA); recolha mínima 40 € + IVA (49,20 € com IVA)",
    );
    expect(servico("outro").precoReferencia).toBeNull();
  });

  it("v2 (S12): como funciona, perguntas e os três passos são os mesmos textos das páginas", async () => {
    const { j } = await ler();
    const { PASSOS_DE_COMO_FUNCIONA } = await import("@/lib/como-funciona");
    const { PERGUNTAS_FREQUENTES } = await import("@/lib/perguntas-frequentes");
    const { TRES_PASSOS_DEPOIS_DE_ENVIAR } = await import("@/lib/textos-do-pedido");
    expect(j.comoFunciona.map((p: { texto: string }) => p.texto)).toEqual(PASSOS_DE_COMO_FUNCIONA.map((p) => p.texto));
    expect(j.perguntas.length).toBe(PERGUNTAS_FREQUENTES.flatMap((c) => c.questions).length);
    // Pela data do modelo (d16): antes de 15-11 são os de sempre.
    const { tresPassosDepoisDeEnviar } = await import("@/lib/textos-do-pedido");
    const { agoraDoModelo } = await import("@/lib/relogio-do-modelo");
    expect(j.textos.tresPassos).toEqual(tresPassosDepoisDeEnviar(agoraDoModelo()));
    expect(tresPassosDepoisDeEnviar(new Date("2026-11-13T12:00:00Z"))).toBe(TRES_PASSOS_DEPOIS_DE_ENVIAR);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pagina = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    // As páginas leem as mesmas constantes, e não uma cópia.
    expect(pagina("src/app/como-funciona/page.tsx")).toContain("passosDeComoFunciona(agoraDoModelo()).map(");
    // Desde a d7 (11-11-2026) pelo preço público das mudanças: a página e o catálogo lêem a mesma função.
    expect(pagina("src/app/faq/page.tsx")).toContain("const faqCategories = perguntasFrequentes(await precoPublicoDasMudancas(), agoraDoModelo());");
    expect(pagina("src/lib/catalogo-da-app.ts")).toContain("perguntas: perguntasFrequentes(precoPublicoConhecido(), agoraDoModelo()).flatMap(");
    const { perguntasFrequentes } = await import("@/lib/perguntas-frequentes");
    const { SEM_PARCEIROS } = await import("@/lib/preco-publico-das-mudancas");
    expect(perguntasFrequentes(SEM_PARCEIROS)).toBe(PERGUNTAS_FREQUENTES);
    // d16: o simulador lê os três passos pela data que o servidor lhe diz.
    expect(pagina("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("...passosDepoisDeEnviar[0]");
    expect(pagina("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("tresPassosDepoisDeEnviar(momentoDoModelo)");
    // Avaliações só do Google, com o mês da contagem.
    expect(j.avaliacoes.resumo).toMatch(/avaliações no Google \(\w+ de \d{4}\)$/);
  });

  it("em cache curta, público, com o WhatsApp da CLYON", async () => {
    const { r, j } = await ler();
    expect(r.headers.get("cache-control")).toContain("max-age=300");
    expect(j.whatsapp).toBe(TELEFONE_DA_CLYON);
  });
});
