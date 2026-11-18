import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IBAN_E_MBWAY_OBRIGATORIOS_ATE,
  MEIO_DE_RECEBER_OBRIGATORIO_DESDE,
  REGIME_DE_IVA_EM_AVISO_ATE,
  REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO,
  REGIME_DE_IVA_OBRIGATORIO_DESDE,
  VERSAO_DOS_TERMOS,
} from "./novo-modelo";
import { dadosImpedemAceitar, estadoDosDadosParaReceber, temPorOndeReceber } from "./dados-para-receber";
import { prontoParaReceber, TITULO_DO_PRONTO_PARA_RECEBER } from "./pronto-para-receber";
import { pecasEmLisboa } from "./hora-de-lisboa";
import { avisoDosDadosParaReceber } from "../../app-pro/src/lib/novo-modelo";

/*
 * d1 (CEO e dono, 18-11-2026): os dois prazos. A partir de 23-11 só fica
 * impedido quem não tem por onde receber (nem IBAN com titular, nem MB WAY); o
 * regime de IVA é aviso até 30-11 e só impede a partir de 01-12. As datas em
 * hora de Lisboa: os instantes de teste escrevem-se com o fuso, nunca no da
 * máquina (que não está em Lisboa). relógio: datas explícitas, passadas a cada função.
 */

const DIA_18 = new Date("2026-11-18T12:00:00Z");
const DIA_22_FIM = new Date("2026-11-22T23:59:00Z"); // 23:59 em Lisboa (UTC em Novembro)
const DIA_23 = new Date("2026-11-23T09:00:00Z");
const DIA_30_FIM = new Date("2026-11-30T23:59:30Z");
const DIA_1_12 = new Date("2026-12-01T00:00:01Z");

const aprovadoAntes = { estado: "aprovado", aprovadoEm: "2026-10-01T10:00:00Z" };
const aprovadoDepois = { estado: "aprovado", aprovadoEm: "2026-11-16T10:00:00Z" };
const regimeOk = { regimeIva: "normal", regimeIvaConfirmadoEm: "2026-11-16T10:00:00Z" };
const semRegime = { regimeIva: "normal", regimeIvaConfirmadoEm: null };
const iban = { iban: "PT50000000000000000000000", ibanTitular: "Titular" };
const mbway = { mbway: "912345678" };

describe("d1 — as datas são de Lisboa", () => {
  it("o meio de receber impede a partir de 00:00 de 23-11 em Lisboa, o regime a partir de 00:00 de 01-12", () => {
    expect(pecasEmLisboa(MEIO_DE_RECEBER_OBRIGATORIO_DESDE)).toMatchObject({ ano: 2026, mes: 11, dia: 23, hora: 0, minuto: 0 });
    expect(MEIO_DE_RECEBER_OBRIGATORIO_DESDE.getTime()).toBe(IBAN_E_MBWAY_OBRIGATORIOS_ATE.getTime() + 1000);
    expect(pecasEmLisboa(REGIME_DE_IVA_OBRIGATORIO_DESDE)).toMatchObject({ ano: 2026, mes: 12, dia: 1, hora: 0, minuto: 0 });
    expect(pecasEmLisboa(REGIME_DE_IVA_EM_AVISO_ATE)).toMatchObject({ ano: 2026, mes: 11, dia: 30, hora: 23, minuto: 59, segundo: 59 });
    const porExtenso = REGIME_DE_IVA_EM_AVISO_ATE.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" });
    expect(porExtenso.replace(/ de /g, " ")).toBe(REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO.replace(/ de /g, " "));
  });
});

describe("d1 — basta um meio de receber", () => {
  it("um aprovado só sem o regime propõe a 23-11 (aviso), e não propõe a 01-12", () => {
    const p = { ...iban, ...mbway, ...semRegime, ...aprovadoAntes };
    expect(dadosImpedemAceitar(p, DIA_23)).toBe(false);
    const e = estadoDosDadosParaReceber(p, DIA_23);
    expect(e.estado).toBe("aviso");
    expect(e.estado === "aviso" && e.falta).toEqual(["regime"]);
    expect(e.estado === "aviso" && e.frase).toContain("30 de novembro de 2026");
    expect(dadosImpedemAceitar(p, DIA_30_FIM)).toBe(false);
    expect(dadosImpedemAceitar(p, DIA_1_12)).toBe(true);
    const depois = estadoDosDadosParaReceber(p, DIA_1_12);
    expect(depois.estado === "impede" && depois.falta).toEqual(["regime"]);
    // A app leva-o à Faturação (só o regime falta).
    expect(avisoDosDadosParaReceber(depois)?.destino).toBe("/conta/faturacao");
  });

  it("o regime é aviso até 30-11 também para os aprovados depois de 15-11", () => {
    expect(dadosImpedemAceitar({ ...mbway, ...semRegime, ...aprovadoDepois }, DIA_18)).toBe(false);
    expect(dadosImpedemAceitar({ ...mbway, ...semRegime, ...aprovadoDepois }, DIA_1_12)).toBe(true);
  });

  it("sem IBAN nem MB WAY não propõe a 23-11; até 22-11 o aprovado antes só tem aviso", () => {
    const p = { iban: "", ibanTitular: "", mbway: "", ...regimeOk, ...aprovadoAntes };
    expect(estadoDosDadosParaReceber(p, DIA_22_FIM).estado).toBe("aviso");
    expect(dadosImpedemAceitar(p, DIA_23)).toBe(true);
    const e = estadoDosDadosParaReceber(p, DIA_23);
    expect(e.estado === "impede" && e.falta).toEqual(["iban", "titular", "mbway"]);
    expect(avisoDosDadosParaReceber(e)?.destino).toBe("/conta/banco");
    // O aprovado depois de 15-11 precisa de um desde o primeiro dia.
    expect(dadosImpedemAceitar({ ...p, ...aprovadoDepois }, DIA_18)).toBe(true);
  });

  it("nenhum profissional com o IBAN (e titular) ou com o MB WAY fica impedido a 23-11", () => {
    const casos = [
      { ...iban, mbway: "", ...regimeOk },
      { iban: "", ibanTitular: "", ...mbway, ...regimeOk },
      { ...iban, mbway: "", ...semRegime },
      { iban: "", ibanTitular: "", ...mbway, ...semRegime },
      { iban: "PT50000000000000000000000", ibanTitular: "", ...mbway, ...semRegime },
    ];
    for (const aprovado of [aprovadoAntes, aprovadoDepois]) {
      for (const c of casos) {
        const p = { ...c, ...aprovado };
        expect(temPorOndeReceber(p)).toBe(true);
        expect(dadosImpedemAceitar(p, DIA_23)).toBe(false);
      }
    }
    // Com um meio e o regime confirmado, não há aviso nenhum.
    expect(estadoDosDadosParaReceber({ ...mbway, ...regimeOk, ...aprovadoAntes }, DIA_23).estado).toBe("completos");
  });

  it("o IBAN sem o titular não conta como meio de receber", () => {
    const p = { iban: "PT50000000000000000000000", ibanTitular: "", mbway: "", ...regimeOk, ...aprovadoAntes };
    expect(temPorOndeReceber(p)).toBe(false);
    expect(dadosImpedemAceitar(p, DIA_23)).toBe(true);
    const e = estadoDosDadosParaReceber(p, DIA_23);
    expect(e.estado === "impede" && e.falta).toEqual(["titular", "mbway"]);
  });
});

describe("d1 — o cartão «Pronto para receber pedidos»", () => {
  it("antes de 15-11 não há cartão", () => {
    expect(prontoParaReceber({ ...aprovadoAntes }, new Date("2026-11-10T12:00:00Z"))).toBeNull();
  });

  it("lista o que falta, linha a linha, com o caminho de cada uma", () => {
    const c = prontoParaReceber(
      { ...mbway, iban: "", ibanTitular: "", ...semRegime, ...aprovadoAntes, categorias: '["recolha_entulho"]', versaoDosTermosAceite: null },
      DIA_23,
    )!;
    expect(c.titulo).toBe(TITULO_DO_PRONTO_PARA_RECEBER);
    expect(c.titulo).toBe("Pronto para receber pedidos");
    expect(c.pronto).toBe(false);
    expect(c.podePropor).toBe(true);
    const porId = Object.fromEntries(c.linhas.map((l) => [l.id, l]));
    expect(c.linhas.map((l) => l.id)).toEqual(["termos", "iban", "mbway", "regime", "guia"]);
    expect(porId.termos).toMatchObject({ estado: "falta", caminho: "termos", app: null, impede: false });
    expect(porId.iban).toMatchObject({ estado: "opcional", caminho: "banco", app: "/conta/banco", impede: false });
    expect(porId.mbway).toMatchObject({ estado: "feito", botao: null });
    expect(porId.regime).toMatchObject({ estado: "falta", caminho: "faturacao", app: "/conta/faturacao", impede: false });
    expect(porId.guia).toMatchObject({ estado: "falta", caminho: "faturacao", impede: false });
  });

  it("a guia só aparece a quem faz entulho; sem a leitura dos Termos a linha não sai", () => {
    const c = prontoParaReceber({ ...iban, ...mbway, ...regimeOk, ...aprovadoAntes, categorias: "mudancas" }, DIA_23)!;
    expect(c.linhas.map((l) => l.id)).toEqual(["iban", "mbway", "regime"]);
    expect(c.pronto).toBe(true);
  });

  it("o que impede assinala-se: sem meio de receber a 23-11, as duas linhas do meio", () => {
    const c = prontoParaReceber(
      { iban: "", ibanTitular: "", mbway: "", ...regimeOk, ...aprovadoAntes, versaoDosTermosAceite: VERSAO_DOS_TERMOS },
      DIA_23,
    )!;
    expect(c.podePropor).toBe(false);
    const porId = Object.fromEntries(c.linhas.map((l) => [l.id, l]));
    expect(porId.termos.estado).toBe("feito");
    expect(porId.iban.impede).toBe(true);
    expect(porId.mbway.impede).toBe(true);
    expect(porId.regime.impede).toBe(false);
  });

  it("a 01-12 sem o regime, a linha do regime impede", () => {
    const c = prontoParaReceber({ ...mbway, ...semRegime, ...aprovadoAntes }, DIA_1_12)!;
    expect(c.podePropor).toBe(false);
    expect(c.linhas.find((l) => l.id === "regime")?.impede).toBe(true);
  });
});

describe("d1 — a rota e o painel", () => {
  const ler = (f: string) => readFileSync(join(__dirname, "..", "..", f), "utf8");

  it("a carteira serve o cartão (o painel e a app CLYON Pro lêem a mesma lista)", () => {
    const rota = ler("src/app/api/profissionais/carteira/route.ts");
    expect(rota).toContain("prontoParaReceber: perfil ? prontoParaReceber({ ...perfil, versaoDosTermosAceite }, agoraDoNovoModelo) : null");
  });

  it("o Início do painel desenha o cartão do servidor, sem pílula por cima do título", () => {
    const painel = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
    expect(painel).toContain("<ProntoParaReceber");
    const cartao = ler("src/app/profissionais/painel/ProntoParaReceber.tsx");
    expect(cartao).toContain("{cartao.titulo}");
    expect(cartao).not.toMatch(/rounded-full[^"]*"[^>]*>\s*<[A-Z]/);
  });
});
