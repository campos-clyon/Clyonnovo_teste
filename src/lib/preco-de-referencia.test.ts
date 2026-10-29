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
import { MINIMO_DOS_ITENS, PRECO_POR_ITEM } from "./precos-publicos";
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
    expect(linhaDeReferencia("recolha_moveis")).toBe("Preço de referência: 40 – 120 € + IVA (49,20 – 147,60 € com IVA)");
    for (const t of ["pequeno", "medio", "grande"] as const) expect(precoDoItem(t)).toMatch(/€\/un \+ IVA \(.+ € com IVA\)$/);
    expect(precoDoItem("pequeno")).toBe("25 €/un + IVA (30,75 € com IVA)");
  });

  it("os móveis por item: o total com IVA ao lado, e o mínimo do motor", () => {
    expect(totalDosItens({})).toBeNull();
    expect(totalDosItens({ grande: 2 })).toBe("120 € + IVA (147,60 € com IVA).");
    expect(totalDosItens({ pequeno: 1 })).toBe(`${MINIMO_DOS_ITENS} € + IVA (98,40 € com IVA), o mínimo de uma recolha por item.`);
  });

  it("os números dos itens só existem em precos-publicos.ts (o seletor e o motor leem de lá)", () => {
    expect(PRECO_POR_ITEM).toEqual({ pequeno: 25, medio: 50, grande: 60 });
    const SELETOR = semComentarios(ler("src/app/simulador/components/MovelItemSelector.tsx"));
    expect(SELETOR).not.toMatch(/\b(25|50|60)\s*€|[*×]\s*(25|50|60)\b|price:/);
    expect(SELETOR).not.toMatch(/Total: \{/);
    const MOTOR = ler("src/app/api/simulator/analyze/route.ts");
    expect(MOTOR).not.toMatch(/× (25|50|60) €|\* (25|50|60)\b|mínimo 80 €/);
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
    expect(j.linhas.map(linhaEscrita)).toEqual([
      "Preço de referência: 40 – 120 € + IVA (49,20 – 147,60 € com IVA)",
      "Total de referência: 85 € + IVA (104,55 € com IVA).",
    ]);
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
    expect(j.linhas.map(linhaEscrita)).toContain(doSite);
    expect(doSite).toMatch(/^Estimativa para a sua mudança: cerca de [\d,]+ h — [\d ,]+ € \+ IVA \([\d ,]+ € com IVA\)\. O total sai das horas feitas no dia\.$/);
    // O simulador do site escreve a mesma frase pela mesma função.
    const SIM = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(SIM).toMatch(/\{ROTULO_DA_ESTIMATIVA_DA_MUDANCA\}: <strong>\{estimativaDaMudanca\(conta\)\}<\/strong>/);
    expect(SIM).toContain("<PrecoDeReferencia servico={formData.serviceType} />");
  });
});
