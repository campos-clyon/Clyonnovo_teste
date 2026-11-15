import { describe, it, expect } from "vitest";
import {
  REGRAS_DAS_MUDANCAS,
  congelarTarifa,
  contaDaFolhaFinal,
  valorDaMudanca,
  type ContaDaFolhaFinal,
  type EntradaDaFolhaFinal,
  type TarifaDasMudancas,
} from "./conta-da-mudanca";

/**
 * d38 v2 (15-11-2026) — A CONTA DA FOLHA FINAL PELA EQUIPA, na fonte única.
 * Um caso parecido com o #524 (números inventados): horas a um preço dado
 * pela equipa, deslocação em euros, material por linhas; taxa só sobre horas
 * + deslocação; material sem taxa e com IVA.
 */

const ok = (e: EntradaDaFolhaFinal): ContaDaFolhaFinal => {
  const c = contaDaFolhaFinal(e);
  if (!c.ok) throw new Error(c.erro);
  return c;
};

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 1.2,
  kmMinimo: 20,
  kmMaximo: 100,
  caixa: 2.5,
  cartaoMetro: null,
  filmeRolo: 12,
  plasticoBolhaRolo: 8,
  aparecerNaLista: true,
};

describe("contaDaFolhaFinal", () => {
  it("um caso como o #524: 6 h 15 min a 60 €/h + 95 € de deslocação + 40 € de material", () => {
    const c = ok({
      tarifa: null,
      pessoas: 3,
      horas: 6.25,
      precoHoraCent: 6000,
      deslocacao: { tipo: "euros", cent: 9500 },
      materiais: [
        { descricao: "Plástico e filme", cent: 2500 },
        { descricao: "Cartão", cent: 1500 },
      ],
    });
    expect(c.horas.cent).toBe(37500);
    expect(c.servicoCent).toBe(47000); // horas + deslocação
    expect(c.taxa.cent).toBe(4700); // 10 % só sobre os 470 €
    expect(c.materiais.cent).toBe(4000);
    expect(c.semIvaCent).toBe(51000); // de dentro: 470 + 40
    expect(c.ivaCent).toBe(11730); // o material também leva IVA
    expect(c.totalCent).toBe(62730);
    expect(c.profissionalCent).toBe(46300); // 470 − 47 + 40
  });

  it("as regras são as de hoje: 10 %, de dentro, material com IVA", () => {
    expect(REGRAS_DAS_MUDANCAS.taxa).toBe(0.1);
    expect(REGRAS_DAS_MUDANCAS.modo).toBe("de_dentro");
    expect(REGRAS_DAS_MUDANCAS.materialComIva).toBe(true);
  });

  it("com tarifa congelada e km, dá o mesmo que a conta de sempre", () => {
    const t = congelarTarifa(TARIFA);
    const antiga = valorDaMudanca(t, { pessoas: 2, horas: 5, km: 30, materiais: { caixas: 10 } });
    const nova = ok({ tarifa: t, pessoas: 2, horas: 5, deslocacao: { tipo: "km", km: 30 }, materiais: [{ descricao: "10 caixas", cent: 2500 }] });
    if (!antiga.ok) throw new Error(antiga.erro);
    expect(nova.semIvaCent).toBe(antiga.semIvaCent);
    expect(nova.taxa.cent).toBe(antiga.taxa.cent);
    expect(nova.ivaCent).toBe(antiga.ivaCent);
    expect(nova.profissionalCent).toBe(antiga.profissionalCent);
  });

  it("com tarifa, o mínimo de horas e de km contam; a equipa pode dar outro preço da hora", () => {
    const t = congelarTarifa(TARIFA);
    const c = ok({ tarifa: t, pessoas: 2, horas: 2, deslocacao: { tipo: "km", km: 5 } });
    expect(c.horas.cobradas).toBe(3);
    expect(c.deslocacao.kmCobrados).toBe(20);
    const outra = ok({ tarifa: t, pessoas: 2, horas: 4, precoHoraCent: 3500, deslocacao: { tipo: "euros", cent: 0 } });
    expect(outra.horas.cent).toBe(14000);
  });

  it("recusa o que não se pode contar", () => {
    const base: EntradaDaFolhaFinal = { tarifa: null, pessoas: 2, horas: 4, precoHoraCent: 5000, deslocacao: { tipo: "euros", cent: 0 } };
    expect(contaDaFolhaFinal({ ...base, precoHoraCent: null }).ok).toBe(false);
    expect(contaDaFolhaFinal({ ...base, horas: 0 }).ok).toBe(false);
    expect(contaDaFolhaFinal({ ...base, deslocacao: { tipo: "km", km: 10 } }).ok).toBe(false); // sem preço do km
    expect(contaDaFolhaFinal({ ...base, deslocacao: { tipo: "euros", cent: -1 } }).ok).toBe(false);
    expect(contaDaFolhaFinal({ ...base, materiais: [{ descricao: "", cent: 500 }] }).ok).toBe(false);
    expect(contaDaFolhaFinal({ ...base, materiais: [{ descricao: "Caixas", cent: 12.5 }] }).ok).toBe(false);
    // uma linha vazia ignora-se
    expect(ok({ ...base, materiais: [{ descricao: " ", cent: 0 }] }).materiais.linhas).toHaveLength(0);
  });
});
