import { afterEach, describe, expect, it } from "vitest";
import {
  NA_REFERENCIA_DA_MUDANCA,
  SEM_PARCEIROS,
  dizAHoraOuOMinimoDaReferencia,
  eurosDaLista,
  lembrarPrecoPublico,
  minimoDaMudancaParaOModelo,
  precoDaMudancaNoWhatsApp,
  precoPublicoDosCandidatos,
  regrasDaMudancaParaOModelo,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";
import { cartaoDoParceiro, faixaEmTexto, type CandidatoDaMudanca } from "./lista-de-parceiros-da-mudanca";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import { recolhaNova, responderNaRecolha, type EstadoDaRecolha } from "./whatsapp-recolha";
import { buildAnalysisPrompt } from "./prompt-do-orcamento";
import { getActivePricingRulesForGemini } from "./pricing-helper";
import { euroDasFontes, eurosNoTexto, oQueOSiteSabe } from "./o-que-o-site-sabe";

/**
 * A CONVERSA DE UMA MUDANÇA, PELA LISTA — 11-11-2026 (d7).
 *
 * A Vitória e o aviso ao modelo estimavam as mudanças pela hora, a equipa e o
 * mínimo da tabela de referência, como se fossem um preço da CLYON — até com
 * parceiros na lista («Para estimar usa a referência…»). Decisão do CEO,
 * aprovada pelo dono:
 *   · com a lista vazia, só a referência publicada, dita como referência;
 *   · com parceiros, o «desde» de 2 e de 3 pessoas, o mínimo do parceiro e um
 *     exemplo por tipologia com a proteção e os km.
 *
 * Os parceiros daqui são INVENTADOS (o repositório é público), e as tarifas
 * foram escolhidas longe dos números da referência, para os dois não se
 * confundirem.
 */

const AGORA = new Date("2026-11-11T10:00:00Z");

const BARATO: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 2,
  precoKm: 0.8,
  kmMinimo: 10,
  kmMaximo: 100,
  caixa: 2,
  cartaoMetro: 2,
  filmeRolo: 8,
  plasticoBolhaRolo: 15,
  aparecerNaLista: true,
};
const CARO: TarifaDasMudancas = { ...BARATO, precoHora2: 46, precoHora3: 64, minimoHoras: 4 };

function candidato(nome: string, tarifa: TarifaDasMudancas): CandidatoDaMudanca {
  return {
    nome,
    contaDeTeste: false,
    verificado: true,
    tarifa,
    notaMedia: null,
    avaliacoes: 0,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudanca"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
  } as CandidatoDaMudanca;
}

const CANDIDATOS = [candidato("Parceiro A", BARATO), candidato("Parceiro B", CARO)];
const COM = precoPublicoDosCandidatos(CANDIDATOS);

/** A hora e o mínimo da referência, escritos de qualquer das maneiras. */
const daReferencia = dizAHoraOuOMinimoDaReferencia;

afterEach(() => lembrarPrecoPublico(SEM_PARCEIROS));

/** A conversa: o cliente diz que quer uma mudança e pergunta o preço. */
function perguntaOPreco(preco: PrecoPublicoDasMudancas): string {
  lembrarPrecoPublico(preco);
  let estado: EstadoDaRecolha = recolhaNova();
  const primeira = responderNaRecolha(estado, "Bom dia, preciso de uma mudança de um T2", AGORA, false, false, {});
  estado = primeira.estado;
  expect(estado.dados.serviceType).toBe("mudanca");
  return responderNaRecolha(estado, "Quanto custa?", AGORA, true, false, {}).resposta;
}

describe("a leitura que os testes usam apanha as frases de antes", () => {
  it("a hora e o mínimo da referência, escritos de qualquer das maneiras", () => {
    for (const frase of [
      "Equipa de 3 a 50 €/h + IVA",
      "a referência é 50,00 € + IVA por hora (61,50 € com IVA), equipa de 3",
      "Para estimar usa a referência de 50 €/hora (equipa de 3)",
      "estima pela referência (50 € s/IVA por hora)",
      "61,50 €/hora com IVA",
      "mínimo 3 horas",
      "mínimo de 3 horas",
      "Mudança à hora: 50 € + IVA por hora (mínimo 3 h).",
    ]) {
      expect(daReferencia(frase), frase).toBe(true);
    }
    for (const frase of [
      "desde 40,00 € + IVA/h (49,20 € com IVA) com 2 pessoas",
      "O mais baixo hoje, com 2 pessoas: 40 €/hora; com 3 pessoas: 55 €/hora.",
      "alguns móveis 3 h · T0 / estúdio 3–4 h",
      "o mínimo de horas é o de cada parceiro (na lista de hoje: entre 2 e 4 horas)",
      "peça grande 50 € sem IVA",
      "150 €/hora",
    ]) {
      expect(daReferencia(frase), frase).toBe(false);
    }
  });
});

describe("o «desde» da lista traz o mínimo dos parceiros e um exemplo por tipologia", () => {
  it("o «desde» de 2 e de 3 pessoas e o mínimo de horas, do mais baixo ao mais alto", () => {
    expect(COM.tipo).toBe("parceiros");
    if (COM.tipo !== "parceiros") return;
    expect(COM.desde).toEqual({ semIvaCent: 4000, comIvaCent: 4920 });
    expect(COM.desde3).toEqual({ semIvaCent: 5500, comIvaCent: 6765 });
    expect(COM.minimoHoras).toEqual({ de: 2, ate: 4 });
  });

  it("os exemplos são a conta do cartão da lista (proteção e km mínimos), pelo parceiro mais barato", () => {
    if (COM.tipo !== "parceiros") throw new Error("sem parceiros");
    expect(COM.exemplos?.map((e) => [e.tipologia, e.pessoas])).toEqual([
      ["T1", 2],
      ["T2", 2],
      ["T3", 3],
    ]);
    for (const e of COM.exemplos ?? []) {
      const cartao = cartaoDoParceiro(
        CANDIDATOS[0] as CandidatoDaMudanca & { tarifa: TarifaDasMudancas },
        { tipologia: e.tipologia, desmontagem: false, pessoas: 2, kmPercurso: 0, formaDePagamento: "na_plataforma", cidade: null },
        "x",
      );
      expect(cartao, e.tipologia).not.toBeNull();
      expect(e.minimo, e.tipologia).toEqual({ semIvaCent: cartao!.estimativa.minimo.semIvaCent, comIvaCent: cartao!.estimativa.minimo.comIvaCent });
      expect(e.maximo, e.tipologia).toEqual({ semIvaCent: cartao!.estimativa.maximo.semIvaCent, comIvaCent: cartao!.estimativa.maximo.comIvaCent });
      expect(e.comProtecao).toBe(true);
    }
    // À mão, o T2: 6,5–9 h × 40 € + 10 km × 0,80 € + 3 rolos de filme × 8 € + 10 m de cartão × 2 €.
    const t2 = COM.exemplos!.find((e) => e.tipologia === "T2")!;
    expect(t2.horas).toEqual([6.5, 9]);
    expect([t2.minimo.semIvaCent, t2.maximo.semIvaCent]).toEqual([31200, 41200]);
  });

  it("nunca abaixo do mínimo de horas do parceiro: sozinho, o de 4 horas conta 4 em alguns móveis", () => {
    const so = precoPublicoDosCandidatos([candidato("Parceiro B", CARO)]);
    if (so.tipo !== "parceiros") throw new Error("sem parceiros");
    expect(so.minimoHoras).toEqual({ de: 4, ate: 4 });
    expect(precoDaMudancaNoWhatsApp(so)).toContain("o seu mínimo de horas (hoje, 4 horas)");
  });

  it("sem parceiros, nem mínimo nem exemplos: a referência", () => {
    expect(precoPublicoDosCandidatos([])).toEqual(SEM_PARCEIROS);
    expect(precoPublicoDosCandidatos([candidato("De fora", { ...BARATO, aparecerNaLista: false })])).toEqual(SEM_PARCEIROS);
  });
});

describe("a conversa: «Quanto custa?» numa mudança", () => {
  it("com a lista vazia, a Vitória responde pela referência, dita como referência", () => {
    const resposta = perguntaOPreco(SEM_PARCEIROS);
    expect(resposta).toContain("cada parceiro tem o seu preço por hora e o seu mínimo de horas");
    expect(resposta).toContain(NA_REFERENCIA_DA_MUDANCA);
    expect(NA_REFERENCIA_DA_MUDANCA).toMatch(/^na referência, são /);
    expect(resposta).toContain("clyon.pt/simulador?servico=mudanca");
    // A hora e o mínimo da referência só aparecem na frase que diz «na referência».
    for (const frase of resposta.split(/(?<=[.!?])\s+/)) {
      if (daReferencia(frase)) expect(frase).toMatch(/na referência/);
    }
    // O sem IVA nunca sozinho, «parceiro» e nunca «profissional».
    expect(resposta).toMatch(/\+ IVA[^.]*com IVA/);
    expect(resposta).not.toMatch(/profissiona/i);
  });

  it("com parceiros na lista, o «desde» de 2 e de 3, o mínimo do parceiro e os exemplos — sem a referência", () => {
    const resposta = perguntaOPreco(COM);
    expect(resposta).toContain("cada parceiro tem o seu preço por hora e o seu mínimo de horas (hoje, entre 2 e 4 horas)");
    expect(resposta).toContain("desde 40,00 € + IVA/h (49,20 € com IVA) com 2 pessoas e desde 55,00 € + IVA/h (67,65 € com IVA) com 3");
    expect(resposta).toContain("pelo parceiro com o preço mais baixo, já com a proteção e os km");
    if (COM.tipo !== "parceiros") throw new Error("sem parceiros");
    const t2 = COM.exemplos!.find((e) => e.tipologia === "T2")!;
    expect(resposta).toContain(`um T2 com 2 pessoas (entre 6,5 e 9 h), ${faixaEmTexto(t2.minimo, t2.maximo)}`);
    expect(resposta).toMatch(/um T3 com 3 pessoas \(entre 7 e 9 h\), /);
    expect(daReferencia(resposta)).toBe(false);
    expect(resposta).not.toMatch(/refer[êe]ncia/i);
    expect(resposta).not.toMatch(/profissiona/i);
    // Cada valor sem IVA vai com o valor com IVA ao lado.
    expect(resposta).not.toMatch(/sem IVA(?![^(]*\))/);
  });

  it("um parceiro que não faz com 3: só o «desde» de 2, e os exemplos das casas que ele faz", () => {
    const p = precoPublicoDosCandidatos([candidato("Parceiro C", { ...BARATO, precoHora3: null })]);
    const resposta = precoDaMudancaNoWhatsApp(p);
    expect(resposta).toContain("desde 40,00 € + IVA/h (49,20 € com IVA) com 2 pessoas.");
    expect(resposta).not.toContain("com 3 pessoas");
  });
});

describe("o aviso ao modelo estima pela lista, e só pela referência quando ela está vazia", () => {
  const regras = async (p: PrecoPublicoDasMudancas) => {
    lembrarPrecoPublico(p);
    const doMotor = await getActivePricingRulesForGemini();
    return [regrasDaMudancaParaOModelo(p), buildAnalysisPrompt("(o pedido)", doMotor), oQueOSiteSabe(), minimoDaMudancaParaOModelo(p)];
  };

  it("com parceiros: o «desde» de 2 e de 3, o mínimo do parceiro, os exemplos — e nem a hora nem o mínimo da referência", async () => {
    const [r, prompt, vitoria, minimo] = await regras(COM);
    expect(r).toContain("O mais baixo hoje, com 2 pessoas: 40 €/hora; com 3 pessoas: 55 €/hora.");
    expect(r).toContain("O mínimo de horas é o de cada parceiro (na lista de hoje: entre 2 e 4 horas).");
    expect(r).toContain("ESTIMA PELO «DESDE» DA LISTA");
    expect(r).toMatch(/EXEMPLOS DE HOJE[^\n]*T1, 2 pessoas, 5–6,5 h, com a proteção: [^|]+\| T2, 2 pessoas, 6,5–9 h, com a proteção: [^|]+\| T3, 3 pessoas, 7–9 h, com a proteção: /);
    expect(r).toContain("Deslocação: os km são os da tarifa de cada parceiro");
    expect(prompt).toContain(r);
    expect(prompt).toContain("A estimativa da mudança faz-se pelo «desde» da lista (acima)");
    expect(prompt).not.toContain("EXEMPLOS NA REFERÊNCIA");
    expect(minimo).toBe("o mínimo de horas é o da tarifa de cada parceiro");
    for (const texto of [r, prompt, vitoria, minimo]) {
      expect(texto.split("\n").filter(daReferencia)).toEqual([]);
    }
  });

  it("com a lista vazia: a referência, dita como referência, e nunca como preço da CLYON", async () => {
    const [r, prompt, vitoria, minimo] = await regras(SEM_PARCEIROS);
    expect(r).toContain("estima só pela REFERÊNCIA publicada");
    expect(r).toContain("di-la sempre como referência («na referência…»), nunca como o preço da CLYON nem de um parceiro");
    expect(prompt).toContain("EXEMPLOS NA REFERÊNCIA: ");
    expect(prompt).toContain("Para MUDANÇA usa EXCLUSIVAMENTE a regra 2.d: o preço por hora e o mínimo de horas são os de cada parceiro.");
    expect(minimo).toMatch(/^o mínimo de horas é o de cada parceiro; na referência \(sem parceiros na lista\), /);
    for (const texto of [r, prompt, vitoria, minimo]) {
      for (const linha of texto.split("\n")) {
        if (daReferencia(linha)) expect(linha).toMatch(/refer[êe]ncia/i);
      }
    }
  });

  it("os euros da lista são fonte para quem confere os números (as lições da Vitória)", () => {
    lembrarPrecoPublico(COM);
    const resposta = precoDaMudancaNoWhatsApp(COM);
    expect(eurosNoTexto(resposta).length).toBeGreaterThan(8);
    expect(eurosNoTexto(resposta).filter((n) => !euroDasFontes(n))).toEqual([]);
    expect(eurosDaLista(SEM_PARCEIROS)).toEqual([]);
    lembrarPrecoPublico(SEM_PARCEIROS);
    expect(euroDasFontes(67.65)).toBe(false);
  });
});
