import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { caminhoDoLink, ECRA_DO_PAINEL_NA_APP } from "../../app-pro/src/lib/destino";
import {
  congelarTarifa,
  EXEMPLO_DA_MUDANCA,
  validarTarifa,
  valorDaMudanca,
} from "./conta-da-mudanca";

/**
 * OS PREÇOS DAS MUDANÇAS NA APP PRO — 10-11-2026 (fase 1).
 *
 * A app faz a conta do exemplo com a MESMA função do site (importada de
 * src/lib), com as regras que o GET manda: nenhuma taxa nem IVA escrito no
 * ecrã. O item do menu só aparece a quem tem a categoria «mudancas», como no
 * painel, e o link do painel `?ecra=precos-mudancas` abre o ecrã.
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ECRA = ler("app-pro/src/app/conta/mudancas.tsx");
const CONTA = ler("app-pro/src/app/(app)/conta.tsx");

describe("app Pro — preços das mudanças", () => {
  it("o link do painel abre o ecrã novo", () => {
    expect(ECRA_DO_PAINEL_NA_APP["precos-mudancas"]).toBe("/conta/mudancas");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=precos-mudancas")).toBe("/conta/mudancas");
  });

  it("a conta vem da lib do site, sem regras copiadas para a app", () => {
    expect(ECRA).toContain('from "../../../../src/lib/conta-da-mudanca"');
    for (const f of ["valorDaMudanca", "congelarTarifa", "validarTarifa", "EXEMPLO_DA_MUDANCA"]) expect(ECRA).toContain(f);
    expect(ECRA).toContain("/api/profissionais/tarifas-mudancas");
    // Nem a taxa nem o IVA escritos à mão.
    expect(ECRA).not.toMatch(/\b0[.,]1\b|\b0[.,]23\b|\b23 ?%|\b10 ?%/);
  });

  it("o item do menu só aparece a quem faz mudanças", () => {
    expect(CONTA).toMatch(/perfil\?\.categorias\.includes\("mudancas"\)\s*\?\s*\(\s*<ItemDoMenu[^<]{0,200}?"\/conta\/mudancas"/);
  });

  it("o exemplo dá o que o painel mostra (taxa de dentro, material com IVA)", () => {
    const v = validarTarifa({
      precoHora2: "40",
      precoHora3: null,
      minimoHoras: "3",
      precoKm: "0,80",
      kmMinimo: "10",
      kmMaximo: "100",
      caixa: "2,50",
      cartaoMetro: null,
      filmeRolo: null,
      plasticoBolhaRolo: null,
      aparecerNaLista: false,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const conta = valorDaMudanca(congelarTarifa(v.tarifa), EXEMPLO_DA_MUDANCA);
    expect(conta.ok).toBe(true);
    if (!conta.ok) return;
    // 5 h × 40 = 200; 30 km × 0,80 = 24; 10 caixas × 2,50 = 25.
    expect(conta.servicoCent).toBe(22_400);
    expect(conta.taxa.cent).toBe(2_240);
    expect(conta.semIvaCent).toBe(24_900);
    expect(conta.ivaCent).toBe(5_727);
    expect(conta.totalCent).toBe(30_627);
    expect(conta.profissionalCent).toBe(22_660);
  });
});
