import { describe, it, expect } from "vitest";
import {
  COMO_CHEGA_O_PRECO,
  LEMBRETE_DO_RESUMO,
  lerAsPartesDaRajada,
  metrosNaFrase,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  simOuNao,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import { aPerguntaFoiFeita, passoDaPergunta } from "./reler-a-conversa";
import {
  linguaClara,
  linguaDepoisDaMensagem,
  linguaPedida,
  semPedidoDeLingua,
} from "./lingua-do-cliente";
import { CLARO_QUE_SIM, PERGUNTA_ANOTADA } from "./voz-da-vitoria";
import { COMO_FUNCIONA, perguntaComoFunciona, respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { datasDitas, quandoComTodasAsDatas } from "./datas-ditas";
import { descricaoOrganizada } from "./descricao-do-pedido";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { lerARespostaDirecta } from "./ler-a-resposta";
import { andarDaResposta } from "./leitor-da-recolha";

/**
 * A CONVERSA DO OLIVER — 28-10-2026, decisão d35.
 *
 * O caso é verdadeiro; o nome, a rua, o número da porta e o código postal são
 * INVENTADOS (o repositório é público). A localidade fica. Como aconteceu:
 *
 *   CLIENTE: [em português] desmontar e recolher uma cama IKEA com colchão,
 *            em Marvila; idealmente sexta 30/10 ou sábado 31/10, no máximo
 *            até domingo 1/11; orçamento com IVA
 *   VITÓRIA: (registou recolha de monos — bem)
 *   CLIENTE: [o nome] · Hiii · Do you speak English?
 *   VITÓRIA: Boa pergunta! Deixo-a anotada para uma pessoa da CLYON…  ← e seguiu em português
 *   CLIENTE: Third · Yes · But needs dismantling · Yes like 50 meters
 *   CLIENTE: How much is the total value?   ← só esta resposta saiu em inglês
 *   VITÓRIA: [a fatura, o resumo, as confirmações — em português]
 *            Quando: domingo, 1 de novembro      ← perdeu a sexta e o sábado
 *            estacionar à porta: não             ← ele disse «uns 50 metros»
 *   CLIENTE: so how does it work now?
 *   VITÓRIA: [o resumo inteiro outra vez, em português]
 *
 * E no painel, ao mesmo tempo: «Tradutor: 2 falha(s) — gemini-3.6-flash:
 * demorou mais de 8 s — saiu em português (en)». A equipa escreveu à mão.
 */

// Quarta-feira, 28 de outubro de 2026, 10:00 em Lisboa (já na hora de Inverno: UTC+0).
const AGORA = new Date("2026-10-28T10:00:00Z");

const NOME = "Oliver"; // inventado
const RUA = "Rua dos Choupos Brancos 17, 1950-123 Lisboa"; // inventada, com a forma de uma de Marvila

const PRIMEIRA =
  "Bom dia, preciso de desmontar e recolher uma cama IKEA com colchão, em Marvila. " +
  "Idealmente na sexta-feira, 30 de outubro, ou no sábado, 31 de outubro. No máximo, até domingo, 1 de novembro. " +
  "Podem dar-me o orçamento com IVA?";

const RAJADAS: string[][] = [
  [PRIMEIRA],
  [NOME, "Hiii", "Do you speak English?"],
  [RUA],
  ["Third"],
  ["Yes", "But needs dismantling"],
  ["Yes like 50 meters"],
  ["How much is the total value?"],
  ["Yes"],
  ["so how does it work now?"],
  ["y"],
];

/**
 * O que o modelo podia ter lido — do lado pior: a data só com o último dia,
 * a carrinha só «não», e o «how does it work» lido como um sim ao resumo.
 */
const LEITURAS: Record<string, { intencao: Intencao; campos: CamposCrus }> = {
  [PRIMEIRA]: {
    intencao: "informar",
    campos: { servico: "recolha_monos", descricao: "desmontar e recolher uma cama IKEA com colchão", quando: "domingo, 1 de novembro", codigoPostal: "Marvila" },
  },
  "Hiii\nDo you speak English?": { intencao: "informar", campos: {} },
  [RUA]: { intencao: "informar", campos: { morada: RUA } },
  Third: { intencao: "informar", campos: { andar: "3" } },
  "Yes\nBut needs dismantling": { intencao: "informar", campos: { elevador: "sim" } },
  "But needs dismantling": { intencao: "informar", campos: {} },
  "Yes like 50 meters": { intencao: "informar", campos: { estacionamento: "não" } },
  "How much is the total value?": { intencao: "informar", campos: {} },
  Yes: { intencao: "informar", campos: { fatura: "sim" } },
  "so how does it work now?": { intencao: "confirmar", campos: {} },
  y: { intencao: "confirmar", campos: {} },
};

type Fala = { estado: EstadoDaRecolha; disse: string[]; respostas: RespostaDaRecolha[]; lidos: string[] };

function conversa(comModelo: boolean): Fala {
  let estado = recolhaNova();
  const fio: Array<{ direccao: string; texto: string }> = [];
  const disse: string[] = [];
  const respostas: RespostaDaRecolha[] = [];
  const lidos: string[] = [];
  RAJADAS.forEach((rajada, i) => {
    const texto = rajada.join("\n");
    for (const m of rajada) fio.push({ direccao: "in", texto: m });
    const partes = lerAsPartesDaRajada(estado, texto, AGORA, aPerguntaFoiFeita(fio, estado.passo));
    lidos.push(partes.texto);
    const r = comModelo
      ? responderComCompreensao(partes.estado, LEITURAS[partes.texto] ?? { intencao: "informar", campos: {} }, AGORA, {
          texto: partes.texto,
          jaCumprimentou: i > 0,
          perguntaPorFazer: partes.perguntaPorFazer,
        })
      : responderNaRecolha(partes.estado, partes.texto, AGORA, i > 0, false, { perguntaPorFazer: partes.perguntaPorFazer });
    estado = r.estado;
    disse.push(r.resposta);
    respostas.push(r);
    if (r.resposta) fio.push({ direccao: "out", texto: r.resposta });
  });
  return { estado, disse, respostas, lidos };
}

describe("a língua revista a cada mensagem", () => {
  it("«Do you speak English?» muda para inglês — e é um pedido, nunca uma pergunta para a equipa", () => {
    expect(linguaPedida("Do you speak English?")).toBe("en");
    expect(linguaDepoisDaMensagem("Do you speak English?", null)).toBe("en");
    expect(linguaDepoisDaMensagem("Parlez-vous français ?", null)).toBe("fr");
    expect(linguaDepoisDaMensagem("¿Habla español?", "en")).toBe("es");
    expect(linguaDepoisDaMensagem("Can we continue in English, please?", null)).toBe("en");
    expect(linguaDepoisDaMensagem("Falam inglês?", null)).toBe("en");
  });

  it("uma palavra solta em inglês não muda a língua — nem um nome, nem um cumprimento", () => {
    for (const solta of ["ok", "Yes", "yes", "Third", "Hiii", NOME, "Thanks", "y", "Yes!"]) {
      expect(linguaDepoisDaMensagem(solta, null)).toBeNull();
    }
  });

  it("três palavras claras noutra língua mudam: as respostas dele em inglês", () => {
    expect(linguaDepoisDaMensagem("But needs dismantling", null)).toBe("en");
    expect(linguaDepoisDaMensagem("Yes like 50 meters", null)).toBe("en");
    expect(linguaDepoisDaMensagem("How much is the total value?", null)).toBe("en");
    expect(linguaDepoisDaMensagem("so how does it work now?", null)).toBe("en");
  });

  it("e volta ao português quando ele volta — mas não por uma morada nem por um «sim»", () => {
    expect(linguaDepoisDaMensagem("Boa tarde, afinal prefiro falar em português, obrigado", "en")).toBe("pt");
    expect(linguaDepoisDaMensagem("Fala português?", "en")).toBe("pt");
    expect(linguaDepoisDaMensagem("Sim", "en")).toBeNull();
    expect(linguaDepoisDaMensagem("Obrigado!", "en")).toBeNull();
    // A morada é o nome da rua, não a língua de quem a escreve.
    expect(linguaDepoisDaMensagem(RUA, "en")).toBeNull();
    expect(linguaDepoisDaMensagem("Rua das Flores dos Santos 12, 3 andar, Lisboa", "en")).toBeNull();
    expect(linguaClara("Rua das Flores dos Santos 12, 3 andar")).toBeNull();
  });

  it("«I don't speak Portuguese» é inglês, e não um pedido de português", () => {
    expect(linguaPedida("Sorry, I don't speak Portuguese")).toBeNull();
    expect(linguaDepoisDaMensagem("Sorry, I don't speak Portuguese", null)).toBe("en");
  });

  it("o pedido e os cumprimentos saem do que se lê; o resto fica", () => {
    expect(semPedidoDeLingua("Hiii\nDo you speak English?")).toBe("");
    expect(semPedidoDeLingua("Hello! Do you speak English? I need a sofa removed.")).toBe("I need a sofa removed.");
  });
});

describe.each([
  ["sem o modelo", false],
  ["com o modelo", true],
])("a conversa do Oliver, %s", (_, comModelo) => {
  it("«Do you speak English?» leva «Claro que sim!» e a pergunta seguinte — nunca «deixo-a anotada»", () => {
    const { disse, estado } = conversa(comModelo);
    expect(disse[1].startsWith(`${CLARO_QUE_SIM} `)).toBe(true);
    expect(passoDaPergunta(disse[1])).toBe("morada");
    expect(disse.join("\n")).not.toContain(PERGUNTA_ANOTADA);
    expect(estado.dados.contactName).toBe(NOME);
  });

  it("as respostas em inglês leem-se: o andar, o elevador, os 50 metros", () => {
    const d = conversa(comModelo).estado.dados;
    expect(d.floor).toBe("3");
    expect(d.hasElevator).toBe("yes");
    expect(d.metrosAtePorta).toBe(50);
    expect(d.parkingDistance).toBe("far");
  });

  it("guarda TODAS as datas, pela ordem; o campo de data fica com a primeira preferida", () => {
    const d = conversa(comModelo).estado.dados;
    expect(d.quandoComTodas).toBe("sexta 30/10 ou sábado 31/10; no máximo domingo 1/11");
    expect(d.dataDesejada?.slice(0, 10)).toBe("2026-10-30");
  });

  it("o resumo diz as três datas e os metros — e não «domingo» sozinho nem «estacionar à porta: não»", () => {
    const { disse } = conversa(comModelo);
    const oResumo = disse.find((m) => passoDaPergunta(m) === "confirmar" && m.includes("Confirme, por favor"));
    expect(oResumo).toBeDefined();
    expect(oResumo).toContain("Quando: sexta 30/10 ou sábado 31/10; no máximo domingo 1/11");
    expect(oResumo).toContain("estacionar à porta: a carrinha fica a cerca de 50 m");
    expect(oResumo).not.toContain("estacionar à porta: não");
  });

  it("«How much is the total value?» leva como chega o preço, e a pergunta seguinte", () => {
    const { disse } = conversa(comModelo);
    expect(disse[6]).toContain(COMO_CHEGA_O_PRECO.slice(0, 40));
  });

  it("«so how does it work now?» responde à pergunta e lembra o SIM — sem repetir o resumo, sem registar", () => {
    const { disse, respostas } = conversa(comModelo);
    const r = respostas[8];
    expect(r.registar).toBeFalsy();
    expect(disse[8]).toBe(`${COMO_FUNCIONA}\n\n${LEMBRETE_DO_RESUMO}`);
    expect(disse[8]).not.toContain("Confirme, por favor");
    expect(passoDaPergunta(disse[8])).toBe("confirmar");
  });

  it("«y» confirma — e regista", () => {
    const { respostas } = conversa(comModelo);
    expect(respostas.at(-1)?.registar).toBe(true);
  });

  it("a descrição do pedido diz as datas todas e a distância", () => {
    const d = conversa(comModelo).estado.dados;
    const desc = descricaoOrganizada(d) ?? "";
    expect(desc).toContain("Quando: sexta 30/10 ou sábado 31/10; no máximo domingo 1/11 (ditas pelo cliente).");
    expect(desc).toContain("Estacionamento: a carrinha fica a cerca de 50 m da porta.");
  });

  it("tudo o que a Vitória disse a partir do «Do you speak English?» tem tradução fixa em inglês", () => {
    const { disse } = conversa(comModelo);
    for (const m of disse.slice(1).filter(Boolean)) {
      const en = traducaoFixa(m, "en");
      expect(en, m).not.toBeNull();
    }
    expect(traducaoFixa(disse[1], "en")).toMatch(/^Yes, of course! What is the address, please\?/);
    const oResumo = disse.find((m) => m.includes("Confirme, por favor")) ?? "";
    const resumoEn = traducaoFixa(oResumo, "en") ?? "";
    expect(resumoEn).toContain("When: Friday 30/10 or Saturday 31/10; at the latest Sunday 1/11");
    expect(resumoEn).toContain("parking at the door: the van stays about 50 m away");
    expect(resumoEn).toContain("reply YES");
    expect(traducaoFixa(disse[8], "en")).toContain("To register it, reply YES to the summary above.");
  });
});

describe("as datas ditas", () => {
  it("pela ordem da frase, com o papel de cada uma", () => {
    const d = datasDitas(PRIMEIRA, AGORA);
    expect(d.map((x) => [x.dia, x.papel])).toEqual([
      ["2026-10-30", "preferida"],
      ["2026-10-31", "preferida"],
      ["2026-11-01", "limite"],
    ]);
    expect(quandoComTodasAsDatas(d)).toBe("sexta 30/10 ou sábado 31/10; no máximo domingo 1/11");
  });

  it("em inglês também, e o limite dito depois («at the latest»)", () => {
    const d = datasDitas("Friday 30th October or Saturday, but Sunday 1 November at the latest", AGORA);
    expect(d.map((x) => [x.dia, x.papel])).toEqual([
      ["2026-10-30", "preferida"],
      ["2026-10-31", "preferida"],
      ["2026-11-01", "limite"],
    ]);
  });

  it("uma morada com data no nome, uma quinta e um sábado que já passou não são datas", () => {
    expect(datasDitas("Rua 25 de Abril 3, Quinta do Conde", AGORA)).toEqual([]);
    expect(datasDitas("no seguimento da conversa do sábado passado", AGORA)).toEqual([]);
    expect(datasDitas("são uns 1.5 m³ de entulho", AGORA)).toEqual([]);
  });
});

describe("os pormenores da conversa", () => {
  it("os metros, em português e em inglês", () => {
    expect(metrosNaFrase("Yes like 50 meters")).toBe(50);
    expect(metrosNaFrase("fica a uns 50 metros")).toBe(50);
    expect(metrosNaFrase("20m da porta")).toBe(20);
    expect(metrosNaFrase("2 m3 de entulho")).toBeNull();
    expect(metrosNaFrase("Yes")).toBeNull();
  });

  it("o andar em inglês", () => {
    expect(andarDaResposta("Third")).toBe("3");
    expect(andarDaResposta("3rd floor")).toBe("3");
    expect(andarDaResposta("ground floor")).toBe("0");
  });

  it("o sim e o não de quem escreve noutra língua", () => {
    for (const s of ["y", "yes", "Yes!", "oui", "sí", "Yes like 50 meters", "of course"]) expect(simOuNao(s)).toBe("sim");
    for (const n of ["non", "nope", "No, it is far"]) expect(simOuNao(n)).toBe("nao");
    // Numa proposta (dinheiro), «yes» fecha; o «y» sozinho não.
    expect(lerARespostaDirecta("yes")?.tipo).toBe("sim");
    expect(lerARespostaDirecta("y")).toBeNull();
  });

  it("«como funciona?» é pergunta do site; «como funciona o pagamento?» é outra", () => {
    expect(perguntaComoFunciona("so how does it work now?")).toBe(true);
    expect(perguntaComoFunciona("Como funciona?")).toBe(true);
    expect(perguntaComoFunciona("Comment ça marche ?")).toBe(true);
    expect(perguntaComoFunciona("Como funciona o pagamento?")).toBe(false);
    expect(respostaFrequente("How does it work?")).toContain(COMO_FUNCIONA);
  });

  it("«Do you speak English?» como primeira mensagem: a apresentação, «Claro que sim!» e o que precisa", () => {
    const r = responderNaRecolha(recolhaNova(), "Hi! Do you speak English?", AGORA, false);
    expect(r.respondidaAntes).toBe(true);
    expect(r.resposta).toContain("Aqui é a Vitória");
    expect(r.resposta).toContain(`${CLARO_QUE_SIM} Em que posso ajudar?`);
    expect(r.resposta).not.toContain(PERGUNTA_ANOTADA);
    expect(traducaoFixa(r.resposta, "en")).toMatch(/Yes, of course! How can I help\?/);
  });

  it("«e agora?» a meio do registo: como funciona, e a pergunta que falta", () => {
    const r = responderNaRecolha({ passo: "andar", dados: { serviceType: "recolha_monos", contactName: NOME } }, "E agora?", AGORA, true);
    expect(r.resposta).toBe(`${COMO_FUNCIONA}\n\nE em que andar é?`);
    expect(r.estado.passo).toBe("andar");
  });

  it("o resumo inteiro, para um resumo à mão", () => {
    const d = conversa(false).estado.dados;
    expect(resumo(d)).toContain("Fatura: sim (com IVA de 23%)");
  });
});
