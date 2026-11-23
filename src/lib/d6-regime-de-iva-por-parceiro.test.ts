import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVISO_DO_REGIME_DE_IVA_ENVIADO_EM,
  NOVO_MODELO_DESDE,
  REGIME_DE_IVA_OBRIGATORIO_DESDE,
  VERSAO_DOS_TERMOS,
  VERSAO_DOS_TERMOS_ATUAL,
  regimeDeIvaImpedeDesde,
} from "./novo-modelo";
import { dadosImpedemAceitar, estadoDosDadosParaReceber } from "./dados-para-receber";

/**
 * D6 (CEO e dono, 23-11-2026) — o regime de IVA só bloqueia a 1/12 quem já
 * aceitou os Termos; a quem não aceitou, o P2B pede 15 dias de aviso.
 */
const comMeio = { iban: "PT50000000000000000000000", ibanTitular: "Parceiro de teste", mbway: "", estado: "aprovado", aprovadoEm: "2026-10-01" };
const semRegime = { ...comMeio, regimeIva: "", regimeIvaConfirmadoEm: null };
const DIA_30_11 = new Date("2026-11-30T12:00:00Z");
const DIA_2_12 = new Date("2026-12-02T12:00:00Z");

describe("d6 — o prazo do regime de IVA é por parceiro", () => {
  it("a versão dos Termos tem constante própria, separada de NOVO_MODELO_DESDE", () => {
    expect(VERSAO_DOS_TERMOS_ATUAL).toBe("2026-11-15");
    expect(VERSAO_DOS_TERMOS).toBe(VERSAO_DOS_TERMOS_ATUAL);
    const fonte = readFileSync(join(process.cwd(), "src/lib/novo-modelo.ts"), "utf8");
    expect(fonte).toMatch(/export const VERSAO_DOS_TERMOS_ATUAL = "\d{4}-\d{2}-\d{2}";/);
    expect(fonte).not.toMatch(/VERSAO_DOS_TERMOS_ATUAL\s*=\s*NOVO_MODELO_DESDE/);
    expect(NOVO_MODELO_DESDE.toISOString().slice(0, 10)).toBe("2026-11-15");
  });

  it("quem aceitou os Termos é bloqueado a 01-12; até lá, só o aviso", () => {
    const p = { ...semRegime, aceitouOsTermosAtuais: true };
    expect(estadoDosDadosParaReceber(p, DIA_30_11).estado).toBe("aviso");
    expect(dadosImpedemAceitar(p, DIA_30_11)).toBe(false);
    expect(dadosImpedemAceitar(p, DIA_2_12)).toBe(true);
    expect(regimeDeIvaImpedeDesde(true)?.getTime()).toBe(REGIME_DE_IVA_OBRIGATORIO_DESDE.getTime());
  });

  it("sem os Termos aceites e sem aviso enviado, continua a propor a 01-12 (e depois)", () => {
    expect(AVISO_DO_REGIME_DE_IVA_ENVIADO_EM).toBeNull();
    for (const p of [semRegime, { ...semRegime, aceitouOsTermosAtuais: false }]) {
      expect(dadosImpedemAceitar(p, DIA_2_12)).toBe(false);
      const e = estadoDosDadosParaReceber(p, DIA_2_12);
      expect(e.estado).toBe("aviso");
      // a frase não inventa uma data
      if (e.estado === "aviso") expect(e.frase).not.toMatch(/30 de novembro/);
    }
  });

  it("com o aviso enviado, o bloqueio vem 15 dias depois (e nunca antes de 01-12)", () => {
    const aviso = new Date("2026-11-27T10:00:00Z");
    const desde = regimeDeIvaImpedeDesde(false, aviso)!;
    expect(desde.getTime()).toBe(new Date("2026-12-12T10:00:00Z").getTime());
    expect(regimeDeIvaImpedeDesde(false, new Date("2026-11-10T10:00:00Z"))!.getTime()).toBe(REGIME_DE_IVA_OBRIGATORIO_DESDE.getTime());
    expect(regimeDeIvaImpedeDesde(false, null)).toBeNull();
  });

  it("o impedimento do servidor lê se aceitou os Termos", () => {
    const f = readFileSync(join(process.cwd(), "src/lib/novo-modelo-no-servidor.ts"), "utf8");
    expect(f).toContain("aceitouOsTermosAtuais: await aceitouOsTermosAtuais(providerId)");
  });
});
