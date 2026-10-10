import { describe, it, expect } from "vitest";
import {
  andarDaResposta,
  andarNaFrase,
  desisteDoPedido,
  falaDeCoisas,
  falaDoAcesso,
  nomeDoTexto,
  pareceQuando,
  perguntaPeloPreco,
  remeteParaAsFotos,
} from "./leitor-da-recolha";

/**
 * O CADERNO DE TREINO DO ASSISTENTE — 10-10-2026.
 *
 * *«Treine-o para situações diversas, para ele ser mais inteligente e
 * perfeito para as suas tarefas.»*
 *
 * Cada linha daqui é uma frase que um cliente escreveu (ou podia ter escrito)
 * e o que o assistente tem de perceber dela. As que vêm com nome e data são
 * verdadeiras e foram lidas mal; ficam aqui para nunca mais o serem. Uma frase
 * nova lida mal entra aqui — é assim que o assistente aprende.
 */

describe("o nome", () => {
  const CASOS: Array<[string, boolean, string | null]> = [
    // [o que escreveu, a responder à pergunta do nome?, o nome]
    ["Obrigado Marco", true, "Marco"], // o Marco, 10-10 — ficou «Nome: Obrigado Marco»
    ["Obrigado Marco", false, "Marco"],
    ["Sou o Marco", true, "Marco"], // o Marco, 10-10 — ficou «Andar: Sou o Marco»
    ["Sou o Marco", false, "Marco"],
    ["Cristiano", true, "Cristiano"],
    ["João Rodrigues", true, "João Rodrigues"],
    ["joão rodrigues", true, "João Rodrigues"],
    [
      "Quero pedir valores para vagar um apartamento em Moscavide num 4 andar sem elevador.\nÉ um T2 pequeno.\nCumprimentos,\nJoão Rodrigues",
      false,
      "João Rodrigues",
    ], // o João, 08-10 — perguntaram-lhe o nome a seguir
    ["Olá! Falámos agora mesmo. O meu nome é Ana Ferreira e aqui estão as fotos", false, "Ana Ferreira"],
    ["Bom dia (...) Com os melhores cumprimentos, Sónia Agostinho", false, "Sónia Agostinho"],
    ["Chamo-me Maria de Fátima", false, "Maria de Fátima"],
    ["Olá, sou a Ana, tenho um sofá para levar", false, "Ana"],
    ["Maria de Fátima", true, "Maria de Fátima"],
    // O que NUNCA é um nome
    ["Já mandei as fotos.", true, null],
    ["Sim", true, null],
    ["Ok obrigado", true, null],
    ["Obrigado, está muito complicado. Prefiro desistir.", false, null],
    ["Ok. Obrigado. Não vamos avançar.", false, null],
    ["Anderson, conforme falamos esses são os móveis", false, null],
    ["Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa", true, null],
    ["Rua das Flores 12", true, null],
    ["Sou o dono da casa", false, null],
    ["Cristiano", false, null], // uma palavra solta, sem pergunta, não é um nome
    ["Qual o valor?", true, null],
  ];
  for (const [texto, emResposta, esperado] of CASOS) {
    it(`${JSON.stringify(texto).slice(0, 70)}${emResposta ? " (à pergunta do nome)" : ""} → ${esperado}`, () => {
      expect(nomeDoTexto(texto, emResposta)).toBe(esperado);
    });
  }
});

describe("o andar escrito na morada ou na frase", () => {
  const CASOS: Array<[string, string | null]> = [
    ["Travessa João Alves, 7, R/C Esq.\n1300-316 Lisboa", "0"], // o Marco — perguntaram-lhe o andar
    ["Rua Rodrigues de Freitas, N18, 1°esq. 1495-116 Algés", "1"], // o Cristiano
    ["Rua João Gomes patacão 7 -4dto Moscavide", "4"], // o João
    ["vagar um apartamento em Moscavide num 4 andar sem elevador", "4"], // o João
    ["Rua Cidade da Horta, 26. 4o andar. Lisboa. Sem elevador", "4"], // a Ana
    ["Rua X 12, 3º Dto", "3"],
    ["Av. da República 45, 2.º esq", "2"],
    ["rés-do-chão", "0"],
    ["Fica na cave", "-1"],
    ["terceiro andar", "3"],
    ["andar 5", "5"],
    // O número da porta não é o andar
    ["Rua das Flores 12", null],
    ["Rua Rodrigues de Freitas, N18", null],
    ["nº 26", null],
    // Nem o dia da semana
    ["2ª feira", null],
    ["na 4f pelas 15h", null],
    ["Sou o Marco", null],
  ];
  for (const [texto, esperado] of CASOS) {
    it(`${JSON.stringify(texto).slice(0, 60)} → ${esperado}`, () => {
      expect(andarNaFrase(texto)).toBe(esperado);
    });
  }

  it("à pergunta do andar, também o número sozinho e as palavras", () => {
    expect(andarDaResposta("4 andar")).toBe("4"); // o João
    expect(andarDaResposta("4")).toBe("4");
    expect(andarDaResposta("o 2")).toBe("2");
    expect(andarDaResposta("terceiro")).toBe("3");
    expect(andarDaResposta("É uma moradia")).toBe("0");
    expect(andarDaResposta("r/c")).toBe("0");
    // E o que não é andar não passa a ser
    expect(andarDaResposta("Sou o Marco")).toBeNull();
    expect(andarDaResposta("Não sei")).toBeNull();
  });
});

describe("a desistência", () => {
  const DESISTE = [
    "Obrigado, está muito complicado. Prefiro desistir.", // o Marco
    "Obrigado, fica para outra oportunidade.", // o Marco
    "Ok. Obrigado. Não vamos avançar.", // o Cristiano
    "Desisto",
    "já não preciso, obrigado",
    "Não estou interessada",
    "Cancele o pedido por favor",
    "Já resolvi com outra empresa",
    "isto é demasiado confuso",
  ];
  const NAO_DESISTE = [
    "Não preciso", // a factura
    "Não é necessário elevador", // o elevador
    "Não preciso de factura",
    "Não é necessário",
    "fica para a próxima semana", // uma data
    "Não há pressa",
    "Não",
    "Depende de como estiver no momento os lugares",
  ];
  for (const t of DESISTE) it(`desiste: ${t}`, () => expect(desisteDoPedido(t)).toBe(true));
  for (const t of NAO_DESISTE) it(`não desiste: ${t}`, () => expect(desisteDoPedido(t)).toBe(false));
});

describe("a pergunta pelo preço", () => {
  const PERGUNTA = [
    "Primeiro quero saber o valor do orçamento", // o Cristiano
    "Sim, pode colocar nif. Mas quero orçamento", // o Cristiano
    "Aguardo orçamento para decidir", // o Cristiano
    "Qual o vlr visto que estou a analisar com outras empresas também", // o Cristiano
    "Quanto custa?",
    "quanto fica mais ou menos",
    "E o preço?",
    "Qual é o valor?",
  ];
  const NAO_PERGUNTA = [
    "Gostava de pedir um orçamento à CLYON.",
    "Quero pedir valores para vagar um apartamento",
    "o mais rápido quanto antes",
    "Sim",
  ];
  for (const t of PERGUNTA) it(`pergunta: ${t}`, () => expect(perguntaPeloPreco(t)).toBe(true));
  for (const t of NAO_PERGUNTA) it(`não pergunta: ${t}`, () => expect(perguntaPeloPreco(t)).toBe(false));
});

describe("as fotografias, a data, as coisas e o acesso", () => {
  it("«já mandei as fotos» remete para as fotografias", () => {
    for (const t of ["Já mandei as fotos.", "está tudo nas fotos", "As fotos", "Vai nas fotografias", "enviei fotos"]) {
      expect(remeteParaAsFotos(t), t).toBe(true);
    }
    for (const t of ["Tirei duas fotos porque é um sofa com chaise longue", "Um sofá e duas cadeiras"]) {
      expect(remeteParaAsFotos(t), t).toBe(false);
    }
  });

  it("o que é uma data, e o que não é", () => {
    for (const t of ["2ª feira", "O mais breve possível", "Não há pressa", "amanhã de manhã", "na 4f pelas 15h", "14/10", "esta semana", "dia 20 de outubro", "Tem que ser antes de 3ª f"]) {
      expect(pareceQuando(t), t).toBe(true);
    }
    for (const t of ["Sim", "Bom dia", "Boa tarde", "Sou o Marco", "Depende de como estiver no momento os lugares", "O sofa, a caixa que acompanha a chaise e dois bancos.", "1885-007", "Já mandei as fotos."]) {
      expect(pareceQuando(t), t).toBe(false);
    }
  });

  it("o que fala das coisas para levar", () => {
    for (const t of [
      "O sofa, a caixa que acompanha a chaise e dois bancos.",
      "Nada de especial, tudo para lixo",
      "É um T2 pequeno.",
      "As medidas 2,35m (comprimento) x 0,89m (largura) x 0,68 m (altura)",
      "vagar um apartamento",
    ]) {
      expect(falaDeCoisas(t), t).toBe(true);
    }
    for (const t of ["2ª feira", "Sim", "Cristiano", "Rua das Flores 12"]) {
      expect(falaDeCoisas(t), t).toBe(false);
    }
  });

  it("o que fala do acesso", () => {
    expect(falaDoAcesso("Depende de como estiver no momento os lugares")).toBe(true);
    expect(falaDoAcesso("É uma rua chata para estacionar.")).toBe(true);
    expect(falaDoAcesso("2ª feira")).toBe(false);
  });
});
