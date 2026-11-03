import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { POST as referencia } from "@/app/api/cliente/referencia/route";
import {
  NOTA_DOS_PRECOS,
  ROTULO_DA_ESTIMATIVA_DA_MUDANCA,
  estimativaDaMudanca,
  linhaDeReferencia,
  linhaEscrita,
  precoDoItem,
  referenciaDoPedido,
  totalDosItens,
} from "./preco-de-referencia";
import { PRECO_POR_ITEM } from "./precos-publicos";
import { SERVICOS_PUBLICOS } from "./service-categories";
import { orcamentoDaMudanca } from "./tabela-das-mudancas";

/**
 * S13 — O PREÇO DE REFERÊNCIA, IGUAL NO SITE E NA APP (29-10-2026, P10 (a)).
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const chamar = (corpo: unknown) =>
  referencia(
    new NextRequest("https://clyon.pt/api/cliente/referencia", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );

describe("S13 — o preço de referência", () => {
  it("nenhum preço sem o valor com IVA ao lado", () => {
    for (const s of SERVICOS_PUBLICOS) {
      const l = linhaDeReferencia(s.id);
      if (l == null) continue;
      expect(l, s.id).toMatch(/^Preço de referência: /);
      expect(l, s.id).toContain("+ IVA");
      expect(l, s.id).toContain("com IVA");
    }
    // Por peça desde 03-11-2026 (d6 v2).
    expect(linhaDeReferencia("recolha_moveis")).toBe("Preço de referência: por peça: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50 € com IVA)");
    for (const t of ["pequeno", "medio", "grande"] as const) expect(precoDoItem(t)).toMatch(/€\/un \+ IVA \(.+ € com IVA\)$/);
    expect(precoDoItem("pequeno")).toBe("15 €/un + IVA (18,45 € com IVA)");
  });

  // d6 v2 (03-11-2026): sem mínimo por pedido.
  it("os móveis por item: o total com IVA ao lado, sem mínimo", () => {
    expect(totalDosItens({})).toBeNull();
    expect(totalDosItens({ grande: 2 })).toBe("100 € + IVA (123 € com IVA).");
    expect(totalDosItens({ pequeno: 1 })).toBe("15 € + IVA (18,45 € com IVA).");
  });

  it("os números dos itens só existem em precos-publicos.ts (o seletor e o motor leem de lá)", () => {
    expect(PRECO_POR_ITEM).toEqual({ pequeno: 15, medio: 30, grande: 50 });
    const SELETOR = semComentarios(ler("src/app/simulador/components/MovelItemSelector.tsx"));
    expect(SELETOR).not.toMatch(/\b(15|30|50)\s*€|[*×]\s*(15|30|50)\b|price:/);
    expect(SELETOR).not.toMatch(/Total: \{/);
    const MOTOR = ler("src/app/api/simulator/analyze/route.ts");
    expect(MOTOR).not.toMatch(/× (15|30|50) €|\* (15|30|50)\b|mínimo 80 €/);
    expect(MOTOR).toContain("PRECO_POR_ITEM.pequeno");
    // A cópia do /plataforma/pedir é o mesmo seletor.
    expect(ler("src/app/plataforma/pedir/components/MovelItemSelector.tsx")).toContain(
      'export { default } from "@/app/simulador/components/MovelItemSelector"',
    );
  });

  it("a R12 dá as mesmas linhas que o site, e a nota", async () => {
    const corpo = { servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1, grande: 1 } };
    const j = await (await chamar(corpo)).json();
    expect(j).toEqual({
      ok: true,
      ...referenciaDoPedido({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1, medio: 0, grande: 1 } }),
    });
    expect(j.nota).toBe(NOTA_DOS_PRECOS);
    // d6 v2: só a «Estimativa» — 15 + 50 = 65 € + IVA, sem a linha geral.
    expect(j.linhas.map(linhaEscrita)).toEqual(["Estimativa: 65 € + IVA (79,95 € com IVA)."]);
    expect((await chamar({})).status).toBe(400);
    expect((await chamar({ servico: "<script>" })).status).toBe(400);
  });

  it("a estimativa da mudança da R12 é igual, carácter a carácter, à do simulador do site", async () => {
    const pedido = {
      tipologia: "T2" as const,
      kmPercurso: 62,
      desmontagem: true,
      origem: { floor: "3", hasElevator: "no" },
      destino: { floor: "rés-do-chão", hasElevator: null },
    };
    const j = await (await chamar({ servico: "mudanca", ...pedido })).json();
    const doSite = `${ROTULO_DA_ESTIMATIVA_DA_MUDANCA}: ${estimativaDaMudanca(orcamentoDaMudanca(pedido))}`;
    // Desde a d6 o rótulo da R12 é «Estimativa»; o texto é o mesmo da caixa do site.
    expect(j.linhas.map(linhaEscrita)).toContain(`Estimativa: ${estimativaDaMudanca(orcamentoDaMudanca(pedido))}`);
    expect(doSite).toMatch(/^Estimativa para a sua mudança: cerca de [\d,]+ h — [\d ,]+ € \+ IVA \([\d ,]+ € com IVA\)\. O total sai das horas feitas no dia\.$/);
    // O simulador do site escreve a mesma frase pela mesma função.
    const SIM = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(SIM).toMatch(/\{ROTULO_DA_ESTIMATIVA_DA_MUDANCA\}: <strong>\{estimativaDaMudanca\(conta\)\}<\/strong>/);
    expect(SIM).toMatch(/<PrecoDeReferencia\s+servico=\{formData\.serviceType\}/);
  });
});
