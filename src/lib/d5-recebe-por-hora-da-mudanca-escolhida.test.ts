import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { congelarTarifa, REGRAS_DAS_MUDANCAS } from "./conta-da-mudanca";
import { mudancaEscolhida, taxasDaMudancaEscolhida } from "./mudanca-escolhida-pelo-cliente";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * d5 (26-11-2026): numa mudança escolhida pela lista, o «recebe por hora» é um só
 * — o da tarifa congelada — no cartão da lista, na caixa do painel e na da app
 * (que fazem a conta com as `taxas` que a rota manda). A taxa gravada na
 * negociação pode ser outra (dinheiro: toda do lado do cliente).
 */
const agora = instanteEmLisboa("2026-11-26T10:00") as Date;
const tarifa = congelarTarifa(
  { precoHora2: 40, precoHora3: 55, minimoHoras: 3, precoKm: 0.6, kmMinimo: 10, kmMaximo: 80, caixa: 2, cartaoMetro: null, filmeRolo: 10, plasticoBolhaRolo: 20, aparecerNaLista: true },
  REGRAS_DAS_MUDANCAS,
  agora,
);
const json = JSON.stringify(tarifa);
const escolhida = mudancaEscolhida(
  { tarifaCongeladaJson: json, pessoasEscolhidas: 2, prazoRespostaEm: null, horas: null, km: null, jaRespondeu: false, estado: "aberta", propostasJson: "[]" },
  agora,
)!;

describe("d5 — um só «recebe por hora» na mudança escolhida (40 €/h)", () => {
  it("o cartão da lista diz o líquido da tarifa congelada", () => {
    expect(escolhida.hora).toBe(40);
    expect(escolhida.recebeHora).toBeCloseTo(40 * (1 - REGRAS_DAS_MUDANCAS.taxa), 2);
  });

  it.each([
    ["taxa gravada de sempre (0 / 10 %)", { cliente: 0, profissional: 0.1 }],
    ["dinheiro (10 % do lado do cliente, 0 do dele)", { cliente: 0.1, profissional: 0 }],
    ["as das negociações normais (5 % / 6 %)", { cliente: 0.05, profissional: 0.06 }],
  ])("a caixa da hora (painel e app) dá o mesmo valor — %s", (_n, gravadas) => {
    const taxas = taxasDaMudancaEscolhida(json, gravadas);
    expect(quantoOProfissionalRecebe(40, taxas)).toBeCloseTo(escolhida.recebeHora, 2);
    // o painel e a app fazem a mesma conta, sobre o que a rota manda
    expect(quantoOProfissionalRecebe(escolhida.hora, taxas)).toBeCloseTo(escolhida.recebeHora, 2);
  });

  it("sem tarifa que se leia, ficam as taxas gravadas", () => {
    const g = { cliente: 0.05, profissional: 0.06 };
    expect(taxasDaMudancaEscolhida(null, g)).toEqual(g);
    expect(taxasDaMudancaEscolhida("não é json", g)).toEqual(g);
  });

  it("a rota usa as taxas da tarifa congelada e a app Pro não ganha regras", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/meus-pedidos/route.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(rota).toContain("taxasDaMudancaEscolhida(escolhidaDela.tarifaCongeladaJson, gravadasDela)");
    const app = readFileSync(join(process.cwd(), "app-pro/src/componentes/ConfirmarAHora.tsx"), "utf8");
    expect(app).toContain("quantoOProfissionalRecebe(numero, taxas)");
  });
});
