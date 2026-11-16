import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const trackLeadEvent = vi.fn();
const origem = { atual: null as null | Record<string, string> };
vi.mock("@/lib/track-contact", () => ({ trackLeadEvent: (p: unknown) => trackLeadEvent(p) }));
vi.mock("@/lib/origem-da-visita", () => ({ origemDaVisita: () => origem.atual }));

import { trackSimulatorStepComplete } from "@/lib/analytics";
import {
  E_PAGO_SQL,
  EVENTO_DO_FUNIL,
  funilPorSemana,
  percentagemDoPasso,
  semanasDoFunil,
  tipoDaOrigem,
} from "@/lib/funil-do-simulador";

/* d56, 16-11-2026: o simulador medido passo a passo. */

const raiz = path.resolve(__dirname, "..", "..");
const ler = (f: string) => readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

describe("os três eventos do simulador", () => {
  afterEach(() => {
    trackLeadEvent.mockReset();
    delete (globalThis as { window?: unknown }).window;
    origem.atual = null;
  });

  it("vão ao GA4 com o passo, o serviço e a origem, e à base sem dados da pessoa", () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    origem.atual = { utm_source: "google", utm_medium: "cpc" };
    trackSimulatorStepComplete("passo_2", "mudanca");
    origem.atual = null;
    trackSimulatorStepComplete("passo_3", "recolha");
    trackSimulatorStepComplete("enviar", undefined);

    expect(gtag.mock.calls).toEqual([
      ["event", "simulator_step_complete", { step_number: 1, step_name: "passo_2", service: "mudanca", origem: "pago" }],
      ["event", "simulator_step_complete", { step_number: 2, step_name: "passo_3", service: "recolha", origem: "orgânico" }],
      ["event", "simulator_step_complete", { step_number: 3, step_name: "enviar", service: "sem_servico", origem: "orgânico" }],
    ]);
    const enviados = trackLeadEvent.mock.calls.map(([p]) => p as Record<string, unknown>);
    expect(enviados.map((p) => [p.type, p.label, p.service])).toEqual([
      [EVENTO_DO_FUNIL, "passo_2", "mudanca"],
      [EVENTO_DO_FUNIL, "passo_3", "recolha"],
      [EVENTO_DO_FUNIL, "enviar", "sem_servico"],
    ]);
    for (const p of enviados) {
      expect(p.name).toBeUndefined();
      expect(p.phone).toBeUndefined();
      expect(p.email).toBeUndefined();
      expect(p.location).toBeUndefined();
    }
  });

  it("o simulador conta do 1 para o 2, do 2 para o 3 e ao Enviar, uma vez cada", () => {
    const fonte = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(fonte).toMatch(/trackSimulatorStepComplete\(passo, formData\.serviceType\)/);
    for (const passo of ["passo_2", "passo_3", "enviar"]) {
      expect(fonte).toContain(`contarPasso("${passo}")`);
    }
    // O Enviar conta-se depois de passar a validação, não no clique recusado.
    const analisar = fonte.slice(fonte.indexOf("const handleAnalyze = async"));
    expect(analisar.indexOf("if (!canAnalyze)")).toBeLessThan(analisar.indexOf('contarPasso("enviar")'));
    expect(fonte).toContain("passosContados.current.clear()");
  });

  it("o cartão «Simulador» dos Leads não os conta (não começam por simulator_)", () => {
    expect(EVENTO_DO_FUNIL.startsWith("simulator_")).toBe(false);
  });
});

describe("o estacionamento aceita «Não sei», como o elevador", () => {
  it("nos dois selectores do simulador", () => {
    const fonte = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    const vezes = fonte.split('<option value="difficult">Estacionamento difícil</option>\n          <option value="unknown">Não sei</option>').length - 1;
    expect(vezes).toBe(2);
  });
});

describe("pago ou orgânico", () => {
  it("gclid ou meio pago é anúncio; o resto é orgânico", () => {
    expect(tipoDaOrigem({ gclid: "x" })).toBe("pago");
    expect(tipoDaOrigem({ utm_medium: "CPC" })).toBe("pago");
    expect(tipoDaOrigem({ utm_medium: "organic" })).toBe("orgânico");
    expect(tipoDaOrigem(null)).toBe("orgânico");
    expect(E_PAGO_SQL).toContain("'cpc'");
  });
});

describe("as semanas do funil", () => {
  it("começam à segunda-feira, à meia-noite de Lisboa", () => {
    // Domingo, 15-11-2026 às 23h30 em Lisboa (Inverno: UTC+0) — ainda é a semana de 09/11.
    const s = semanasDoFunil(3, new Date("2026-11-15T23:30:00Z"));
    expect(s.map((x) => x.inicio)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26"]);
    expect(s[0].desde.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    // No Verão, a meia-noite de Lisboa é às 23h UTC da véspera.
    const v = semanasDoFunil(1, new Date("2026-07-15T12:00:00Z"));
    expect(v[0].inicio).toBe("2026-07-13");
    expect(v[0].desde.toISOString()).toBe("2026-07-12T23:00:00.000Z");
  });

  it("juntam as linhas da base, com o total e a divisão", () => {
    const semanas = [{ inicio: "2026-11-16" }, { inicio: "2026-11-09" }];
    const f = funilPorSemana(
      [
        { semana: 0, etapa: "entradas", pago: 1, n: "10" },
        { semana: 0, etapa: "entradas", pago: 0, n: 30 },
        { semana: 0, etapa: "passo_2", pago: 0, n: 12 },
        { semana: 1, etapa: "enviar", pago: 1, n: 2 },
        { semana: 7, etapa: "enviar", pago: 1, n: 99 },
        { semana: 0, etapa: "outra", pago: 1, n: 99 },
      ],
      semanas,
    );
    expect(f[0].todos).toEqual({ entradas: 40, passo_2: 12, passo_3: 0, enviar: 0 });
    expect(f[0].pago.entradas).toBe(10);
    expect(f[0].organico.entradas).toBe(30);
    expect(f[1].pago.enviar).toBe(2);
    expect(percentagemDoPasso(12, 40)).toBe("30 %");
    expect(percentagemDoPasso(0, 0)).toBe("—");
  });
});
