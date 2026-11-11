import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMBALAMENTO_POR_TIPOLOGIA,
  HORAS_COM_DUAS_PESSOAS,
  HORAS_COM_TRES_PESSOAS,
  HORAS_DA_DESMONTAGEM,
  PROTECAO_POR_TIPOLOGIA,
  TIPOLOGIAS,
  intervaloDeHoras,
  intervaloDeHorasEmTexto,
  orcamentoDaMudanca,
  pessoasParaACasa,
  soComTresPessoas,
} from "./tabela-das-mudancas";
import { SEM_PARCEIROS, precoDaMudancaNoWhatsApp, regrasDaMudancaParaOModelo } from "./preco-publico-das-mudancas";

/*
 * AS HORAS DAS MUDANÇAS EM INTERVALO — 11-11-2026 (ordem do CEO, com o sim do
 * dono). O dono viu cerca de 300 € para um T3 e achou irreal: o preço da hora
 * estava certo, as horas é que estavam curtas. Um T3 é um dia inteiro.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("a tabela das horas, uma só fonte", () => {
  it("3 pessoas e 2 pessoas, como a ordem as deu", () => {
    expect(HORAS_COM_TRES_PESSOAS).toEqual({ itens: [3, 3], T0: [3, 4], T1: [4, 5], T2: [5, 7], T3: [7, 9], "T4+": [9, 12] });
    expect(HORAS_COM_DUAS_PESSOAS).toEqual({ itens: [3, 3], T0: [4, 5], T1: [5, 6.5], T2: [6.5, 9], T3: null, "T4+": null });
    expect(HORAS_DA_DESMONTAGEM).toEqual({ itens: 0.5, T0: 1, T1: 1, T2: 1.5, T3: 2, "T4+": 3 });
  });

  it("T3 e T4+ só com 3 pessoas", () => {
    expect(TIPOLOGIAS.filter(soComTresPessoas)).toEqual(["T3", "T4+"]);
    expect(pessoasParaACasa("T3", 2)).toBe(3);
    expect(pessoasParaACasa("T2", 2)).toBe(2);
    expect(intervaloDeHoras("T3", false, 2)).toEqual([7, 9]);
  });

  it("nunca abaixo do mínimo de horas", () => {
    expect(intervaloDeHoras("T0", false, 3, 5)).toEqual([5, 5]);
    expect(intervaloDeHoras("itens", false, 3)).toEqual([3, 3]);
  });

  it("o texto: «entre 7 e 9 h», ou «3 h»", () => {
    expect(intervaloDeHorasEmTexto([7, 9])).toBe("entre 7 e 9 h");
    expect(intervaloDeHorasEmTexto([5, 6.5])).toBe("entre 5 e 6,5 h");
    expect(intervaloDeHorasEmTexto([3, 3])).toBe("3 h");
  });
});

describe("o material em dois níveis", () => {
  it("a proteção e o embalamento completo, por tipologia", () => {
    expect(PROTECAO_POR_TIPOLOGIA.T0).toEqual({ filmeRolos: 1 });
    expect(PROTECAO_POR_TIPOLOGIA.T1).toEqual({ filmeRolos: 2, cartaoRolos: 1 });
    expect(PROTECAO_POR_TIPOLOGIA.T2).toEqual({ filmeRolos: 3, cartaoRolos: 1 });
    expect(PROTECAO_POR_TIPOLOGIA.T3).toEqual({ filmeRolos: 4, cartaoRolos: 1, plasticoBolhaRolos: 1 });
    expect(PROTECAO_POR_TIPOLOGIA["T4+"]).toEqual({ filmeRolos: 6, cartaoRolos: 2, plasticoBolhaRolos: 1 });
    expect(TIPOLOGIAS.map((t) => EMBALAMENTO_POR_TIPOLOGIA[t]?.caixas ?? null)).toEqual([null, 20, 30, 45, 70, 100]);
    expect(TIPOLOGIAS.map((t) => EMBALAMENTO_POR_TIPOLOGIA[t]?.plasticoBolhaRolos ?? null)).toEqual([null, 1, 1, 2, 1, 2]);
  });

  it("na referência, um T3 com a proteção: 442–542 € + IVA (era 250 €)", () => {
    const o = orcamentoDaMudanca({ tipologia: "T3", protecao: true });
    expect([o.totalSemIvaMinimo, o.totalSemIvaMaximo]).toEqual([442, 542]);
    const comCaixas = orcamentoDaMudanca({ tipologia: "T3", protecao: true, embalamento: true });
    // 70 caixas × 2 € + 1 rolo de plástico bolha × 22 €.
    expect(comCaixas.totalSemIvaMinimo - o.totalSemIvaMinimo).toBe(70 * 2 + 22);
  });
});

describe("a Vitória e o modelo dizem as horas em intervalo", () => {
  it("o aviso ao modelo tem as duas tabelas e a nota do T4", () => {
    const r = regrasDaMudancaParaOModelo(SEM_PARCEIROS);
    expect(r).toContain("T3 7–9 h");
    expect(r).toContain("T2 6,5–9 h");
    expect(r).toContain("T3 só com 3 pessoas");
    expect(r).toContain("4 pessoas ou duas viaturas");
    expect(r).not.toMatch(/T3 5h/);
  });

  it("a Vitória diz as horas pela tabela", () => {
    expect(precoDaMudancaNoWhatsApp(SEM_PARCEIROS)).toContain("um T3 entre 7 e 9 h");
  });
});

describe("o simulador do site: as 2 pessoas desligadas num T3 ou maior, e a opção das caixas", () => {
  const ecra = ler("src/app/simulador/components/ParceirosDaMudanca.tsx");
  it("desliga o botão e usa a equipa da conta", () => {
    expect(ecra).toContain("const desligado = n === 2 && soComTres;");
    expect(ecra).toContain("disabled={desligado}");
    expect(ecra).toContain("equipa de {pessoasDaConta}");
    expect(ecra).toContain("pessoas: pessoasDaConta,");
  });
  it("tem a opção «Também preciso de caixas e embalamento»", () => {
    expect(ecra).toContain("PEDIR_EMBALAMENTO");
    expect(ecra).toContain("estimativaComEmbalamento");
  });
});
