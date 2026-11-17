/**
 * A VITÓRIA DEPOIS DA d60 — 17-11-2026 (d62/d63).
 *
 * A d60 mudou os preços no site, e a Vitória ainda lia a peça grande sem a
 * primeira, a moradia abaixo do «desde» publicado e os andares a pé a um valor
 * por andar só. Aqui: o que ela sabe (`oQueOSiteSabe`) e as mensagens prontas
 * dizem os números da d60, pelas fontes; e uma lição ou resposta livre com um
 * preço de antes fica bloqueada (`motivoParaBloquear`).
 */
import { describe, expect, it } from "vitest";
import traducoes from "./traducoes-fixas-da-vitoria.json";
import { ITENS_A_MAIS_PARA_O_CLIENTE } from "./itens-a-mais";
import { motivoParaBloquear } from "./licoes-da-vitoria";
import {
  EXEMPLO_DOS_ANDARES,
  MINIMO_DA_MUDANCA_COM,
  comIva,
  euroDasFontes,
  eurosNoTexto,
  oQueOSiteSabe,
} from "./o-que-o-site-sabe";
import * as perguntasFrequentes from "./perguntas-frequentes-da-vitoria";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { MORADIA_DESDE, PRECOS_ANTES_DA_D60, precoDeAntesDaD60 } from "./precos-antes-da-d60";
import {
  ESVAZIAMENTO_POR_TIPOLOGIA,
  GRANDES_EM_TEXTO,
  PRECO_DA_PRIMEIRA_GRANDE,
  PRECO_POR_ITEM,
  RECOLHA_MINIMA_DOS_MOVEIS,
  RECOLHA_POR_ANDAR_E_PECA_GRANDE,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  valorDeUmAndarAPe,
} from "./precos-publicos";
import { SEM_PARCEIROS, lembrarPrecoPublico } from "./preco-publico-das-mudancas";
import { MINIMO_DE_HORAS, PRECO_POR_HORA, PRECO_POR_HORA_DUAS_PESSOAS, RAIO_INCLUIDO_KM } from "./tabela-das-mudancas";
import * as voz from "./voz-da-vitoria";
import { notaDoPrecoPara } from "./whatsapp-recolha";
import * as recolha from "./whatsapp-recolha";
import { DEPOIS_DO_MODELO, comORelogioEm } from "./relogio-dos-testes";

// No modelo de hoje (depois de 15-11-2026), pelo relógio dos testes.
comORelogioEm(DEPOIS_DO_MODELO);

/** «79,95» — como os textos escrevem o com IVA. */
const v = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/** As constantes de texto de um módulo. */
const textosDe = (m: Record<string, unknown>) => Object.values(m).filter((x): x is string => typeof x === "string");

/** A guarda das frases do site: a peça grande sem a primeira e a moradia abaixo do «desde». */
function chumbaNaD60(texto: string): string[] {
  const erros: string[] = [];
  const motivo = precoDeAntesDaD60(texto);
  if (motivo) erros.push(motivo);
  // Por extenso, para o teste não depender só da guarda que ele próprio testa:
  for (const f of texto.split(/(?<=[.;!?])\s+|\n+/u)) {
    if (/grandes?\b[^.;!?\n]{0,15}?(?<![\d.,])50\s?€/iu.test(f) && !/(?<![\d.,])65\s?€|seguintes?|a mais|mais coisas|\bextras?\b/iu.test(f)) erros.push(`grande 50 € sem o 65: ${f}`);
    for (const m of f.matchAll(/moradias?\b[^.;!?\n]{0,40}?(?<![\d.,]|\d[  ])(\d+)\s?€/giu)) {
      if (Number(m[1]) < 900) erros.push(`moradia abaixo de 900: ${f}`);
    }
  }
  return erros;
}

describe("a guarda dos preços de antes da d60", () => {
  it("é uma fonte única: o teste da orquestra e a Vitória lêem as mesmas regras", () => {
    expect(PRECOS_ANTES_DA_D60).toHaveLength(4);
    expect(MORADIA_DESDE).toBe(ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "moradia")?.minimo);
    expect(MORADIA_DESDE).toBeGreaterThanOrEqual(900);
  });

  it("apanha a recolha mínima de antes, a grande sem a primeira, a moradia barata, a hora e os km de antes", () => {
    for (const frase of [
      "A recolha mínima 40 € + IVA (49,20 € com IVA).",
      "Cada recolha tem um mínimo de 40 € + IVA.",
      "Por peça: pequena 15 €, média 30 €, grande 50 € + IVA.",
      "Um sofá é uma peça grande, 50 € + IVA (61,50 € com IVA).",
      "Esvaziamento de casa (moradia): desde 250 € sem IVA.",
      "Uma moradia completa fica desde 450 €.",
      "Equipa de 3 a 50 €/h + IVA.",
      "Até 50 km a deslocação está incluída.",
    ]) {
      expect(precoDeAntesDaD60(frase), frase).not.toBeNull();
    }
  });

  it("deixa os números da d60 e os itens a mais (que contam como as seguintes)", () => {
    for (const frase of [
      `Por peça: pequena 15 €, média 30 €, ${GRANDES_EM_TEXTO} + IVA.`,
      ITENS_A_MAIS_PARA_O_CLIENTE,
      "Se no local houver mais coisas, o extra paga-se à parte pela tabela (peça pequena 15 €, média 30 €, grande 50 € + IVA).",
      "Moradia completa: desde 900 € sem IVA (desde 1 107 € com IVA).",
      "Moradia completa: desde 900 € sem IVA (desde 1107 € com IVA).",
      `A recolha mínima é ${RECOLHA_MINIMA_DOS_MOVEIS} € + IVA (${v(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA).`,
      "Entulho até 10 sacos: 40 – 48 € sem IVA (49,20 – 59,04 € com IVA).",
      `Até ${RAIO_INCLUIDO_KM} km a deslocação está incluída.`,
    ]) {
      expect(precoDeAntesDaD60(frase), frase).toBeNull();
    }
  });
});

describe("uma lição ou resposta livre com um preço de antes fica bloqueada", () => {
  it("«recolha mínima 40 €» fica bloqueada", () => {
    const motivo = motivoParaBloquear("Claro! A recolha mínima 40 € + IVA (49,20 € com IVA), e os andares somam-se depois.");
    expect(motivo).not.toBeNull();
    expect(motivo).toMatch(/d60/);
  });

  it("a grande a 50 € sem a primeira e a moradia desde 250 € ficam bloqueadas", () => {
    expect(motivoParaBloquear("O sofá é uma peça grande: 50 € + IVA (61,50 € com IVA).")).not.toBeNull();
    expect(motivoParaBloquear("Uma moradia fica desde 250 € + IVA (307,50 € com IVA).")).not.toBeNull();
  });

  it("a mesma lição com os números de hoje passa", () => {
    expect(
      motivoParaBloquear(
        `A recolha mínima é ${RECOLHA_MINIMA_DOS_MOVEIS} € + IVA (${v(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA), e os andares somam-se depois.`,
      ),
    ).toBeNull();
    expect(
      motivoParaBloquear(
        `O sofá é uma peça grande: ${PRECO_DA_PRIMEIRA_GRANDE} € + IVA (${v(comIva(PRECO_DA_PRIMEIRA_GRANDE))} € com IVA) a primeira e ${PRECO_POR_ITEM.grande} € + IVA (${v(comIva(PRECO_POR_ITEM.grande))} € com IVA) as seguintes.`,
      ),
    ).toBeNull();
  });
});

describe("o que a Vitória sabe diz os números da d60, pelas fontes", () => {
  lembrarPrecoPublico(SEM_PARCEIROS);
  const texto = oQueOSiteSabe(DEPOIS_DO_MODELO);

  it("sem nenhum preço de antes: nem a grande a 50 € sem os 65, nem a moradia abaixo de 900", () => {
    expect(chumbaNaD60(texto)).toEqual([]);
    expect(texto).not.toMatch(/moradia\)?:\s*desde 250/iu);
  });

  it("a peça grande pela frase da fonte, com o com IVA ao lado", () => {
    expect(texto).toContain(GRANDES_EM_TEXTO);
    expect(texto).toContain(`grande ${v(comIva(PRECO_DA_PRIMEIRA_GRANDE))} € a primeira e ${v(comIva(PRECO_POR_ITEM.grande))} € as seguintes`);
  });

  it("os andares da d60: 8 € por andar e por peça grande, nunca menos de 15 €; e o exemplo do site (72 €)", () => {
    expect(texto).toContain(`${RECOLHA_POR_ANDAR_E_PECA_GRANDE} € + IVA (${v(comIva(RECOLHA_POR_ANDAR_E_PECA_GRANDE))} € com IVA) por andar e por peça grande`);
    expect(texto).toContain(`nunca menos de ${RECOLHA_POR_ANDAR_SEM_ELEVADOR} € + IVA`);
    expect(EXEMPLO_DOS_ANDARES.valor).toBe(valorDeUmAndarAPe(3) * 3);
    expect(EXEMPLO_DOS_ANDARES.valor).toBe(72);
    expect(texto).toContain(`${EXEMPLO_DOS_ANDARES.valor} € + IVA (${v(comIva(EXEMPLO_DOS_ANDARES.valor))} € com IVA)`);
  });

  it("a mudança: o mínimo com 2 e com 3 pessoas e os km incluídos", () => {
    expect(MINIMO_DA_MUDANCA_COM[2]).toBe(PRECO_POR_HORA_DUAS_PESSOAS * MINIMO_DE_HORAS);
    expect(MINIMO_DA_MUDANCA_COM[3]).toBe(PRECO_POR_HORA * MINIMO_DE_HORAS);
    expect(texto).toContain(`${MINIMO_DA_MUDANCA_COM[2]} € + IVA (${v(comIva(MINIMO_DA_MUDANCA_COM[2]))} € com IVA) com 2 pessoas`);
    expect(texto).toContain(`${MINIMO_DA_MUDANCA_COM[3]} € + IVA (${v(comIva(MINIMO_DA_MUDANCA_COM[3]))} € com IVA) com 3`);
    expect(texto).toContain(`até ${RAIO_INCLUIDO_KM} km está incluída`);
  });

  it("o esvaziamento desde o T0/T1 e os monos desde a recolha mínima", () => {
    const desde = Math.min(...ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => t.minimo));
    expect(texto).toContain(`Esvaziamento de casa: desde ${desde} € sem IVA (desde ${v(comIva(desde))} € com IVA)`);
    expect(texto).toContain(`Recolha de monos: desde ${RECOLHA_MINIMA_DOS_MOVEIS} € sem IVA (desde ${v(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA)`);
  });

  it("cada euro que ela lê é das fontes", () => {
    const fora = eurosNoTexto(texto).filter((n) => !euroDasFontes(n));
    expect(fora).toEqual([]);
  });
});

describe("as mensagens prontas da Vitória não dizem preços de antes da d60", () => {
  it("as frases fixas, as traduções revistas, as respostas frequentes e a nota do preço", () => {
    lembrarPrecoPublico(SEM_PARCEIROS);
    const textos: Record<string, string> = {};
    textosDe(voz).forEach((t, i) => (textos[`voz-da-vitoria #${i}`] = t));
    textosDe(perguntasFrequentes).forEach((t, i) => (textos[`perguntas-frequentes-da-vitoria #${i}`] = t));
    textosDe(recolha).forEach((t, i) => (textos[`whatsapp-recolha #${i}`] = t));
    (traducoes as { frases: string[][] }).frases.forEach((f, i) => (textos[`traduções fixas #${i}`] = f[0]));
    for (const p of ["Quanto custa?", "É preciso pagar adiantado?", "Têm contentores?", "Quem faz o trabalho?"]) {
      const r = respostaFrequente(p);
      if (r) textos[`resposta a «${p}»`] = r;
    }
    for (const s of ["recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "mudanca", "manutencao_casa"]) {
      textos[`nota do preço (${s})`] = notaDoPrecoPara("Quanto custa?", "quando", false, s);
    }
    const erros = Object.entries(textos).flatMap(([onde, t]) => chumbaNaD60(t).map((e) => `${onde}: ${e}`));
    expect(erros).toEqual([]);
    expect(Object.keys(textos).length).toBeGreaterThan(10);
  });
});
