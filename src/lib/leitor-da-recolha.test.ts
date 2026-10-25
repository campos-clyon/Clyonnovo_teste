import { describe, it, expect } from "vitest";
import {
  andarDaResposta,
  andarNaFrase,
  desisteDoPedido,
  falaDeCoisas,
  falaDoAcesso,
  nomeDoTexto,
  pareceQuando,
  perguntaDirectaPeloPreco,
  perguntaPeloPreco,
  remeteParaAsFotos,
  valeParaAmbos,
} from "./leitor-da-recolha";

describe("a mudança do Gaspar (10-10-2026) — as frases dele", () => {
  it("o preço perguntado sem rodeios, até na primeira mensagem", () => {
    expect(perguntaDirectaPeloPreco("Podem, por favor, indicar o preço total fechado, incluindo materiais de embalagem?")).toBe(true);
    expect(perguntaDirectaPeloPreco("Agradeço também a confirmação de que o IVA está incluído no valor apresentado.")).toBe(true);
    expect(perguntaDirectaPeloPreco("Gostaria de pedir um orçamento para uma pequena mudança")).toBe(false);
    expect(perguntaPeloPreco("Gostaria de saber o valor primeiro")).toBe(true);
  });

  it("«ambos», «as duas» valem para a origem e o destino", () => {
    expect(valeParaAmbos("As duas moradas ficam a poucas ruas de distância e ambos os prédios têm elevador.")).toBe(true);
    expect(valeParaAmbos("A porta de ambos")).toBe(true);
    expect(valeParaAmbos("Tem elevador")).toBe(false);
  });

  it("o que se embala também é o trabalho", () => {
    expect(falaDeCoisas("E quero que embale as roupas e a mudança")).toBe(true);
    expect(falaDeCoisas("Nao é necessário desembalar e arrumar")).toBe(true);
    expect(falaDeCoisas("Gostaria de saber o valor primeiro")).toBe(false);
  });

  it("«sábado 31/10 ou domingo 01/11» é uma data — e «suplementos de fim de semana» só por si também", () => {
    expect(pareceQuando("preferencialmente num sábado 31/10 ou domingo 01/11")).toBe(true);
  });
});

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
    ["Obrigado Bento", true, "Bento"], // o Bento, 10-10 — ficou «Nome: Obrigado Bento»
    ["Obrigado Bento", false, "Bento"],
    ["Sou o Bento", true, "Bento"], // o Bento, 10-10 — ficou «Andar: Sou o Bento»
    ["Sou o Bento", false, "Bento"],
    ["Emiliano", true, "Emiliano"],
    ["Simão Fragoso", true, "Simão Fragoso"],
    ["simão fragoso", true, "Simão Fragoso"],
    [
      "Quero pedir valores para vagar um apartamento em Moscavide num 4 andar sem elevador.\nÉ um T2 pequeno.\nCumprimentos,\nSimão Fragoso",
      false,
      "Simão Fragoso",
    ], // o Simão, 08-10 — perguntaram-lhe o nome a seguir
    ["Olá! Falámos agora mesmo. O meu nome é Rute Valadas e aqui estão as fotos", false, "Rute Valadas"],
    ["Bom dia (...) Com os melhores cumprimentos, Dália Quaresma", false, "Dália Quaresma"],
    ["Chamo-me Maria de Fátima", false, "Maria de Fátima"],
    ["Olá, sou a Ana, tenho um sofá para levar", false, "Ana"],
    ["Maria de Fátima", true, "Maria de Fátima"],
    // O que NUNCA é um nome
    ["Já mandei as fotos.", true, null],
    ["Sim", true, null],
    ["Ok obrigado", true, null],
    ["Obrigado, está muito complicado. Prefiro desistir.", false, null],
    ["Ok. Obrigado. Não vamos avançar.", false, null],
    ["Edson, conforme falamos esses são os móveis", false, null],
    ["Morada: Estrada do Vale do Lumiar, n47, 6D, 1600-913 Lisboa", true, null],
    ["Rua das Flores 12", true, null],
    ["Sou o dono da casa", false, null],
    ["Emiliano", false, null], // uma palavra solta, sem pergunta, não é um nome
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
    ["Travessa Abel Correia, 9, R/C Esq.\n1300-904 Lisboa", "0"], // o Bento — perguntaram-lhe o andar
    ["Rua Tomás de Lemos, N24, 1°esq. 1495-903 Algés", "1"], // o Emiliano
    ["Rua Abel Faria 12 -4dto Moscavide", "4"], // o Simão
    ["vagar um apartamento em Moscavide num 4 andar sem elevador", "4"], // o Simão
    ["Rua das Camélias Brancas, 31. 4o andar. Lisboa. Sem elevador", "4"], // a Rute
    ["Rua X 12, 3º Dto", "3"],
    ["Av. da República 45, 2.º esq", "2"],
    ["rés-do-chão", "0"],
    ["Fica na cave", "-1"],
    ["terceiro andar", "3"],
    ["andar 5", "5"],
    // O número da porta não é o andar
    ["Rua das Flores 12", null],
    ["Rua Tomás de Lemos, N24", null],
    ["nº 26", null],
    // Nem o dia da semana
    ["2ª feira", null],
    ["na 4f pelas 15h", null],
    ["Sou o Bento", null],
  ];
  for (const [texto, esperado] of CASOS) {
    it(`${JSON.stringify(texto).slice(0, 60)} → ${esperado}`, () => {
      expect(andarNaFrase(texto)).toBe(esperado);
    });
  }

  it("à pergunta do andar, também o número sozinho e as palavras", () => {
    expect(andarDaResposta("4 andar")).toBe("4"); // o Simão
    expect(andarDaResposta("4")).toBe("4");
    expect(andarDaResposta("o 2")).toBe("2");
    expect(andarDaResposta("terceiro")).toBe("3");
    expect(andarDaResposta("É uma moradia")).toBe("0");
    expect(andarDaResposta("r/c")).toBe("0");
    // E o que não é andar não passa a ser
    expect(andarDaResposta("Sou o Bento")).toBeNull();
    expect(andarDaResposta("Não sei")).toBeNull();
  });
});

describe("a desistência", () => {
  const DESISTE = [
    "Obrigado, está muito complicado. Prefiro desistir.", // o Bento
    "Obrigado, fica para outra oportunidade.", // o Bento
    "Ok. Obrigado. Não vamos avançar.", // o Emiliano
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
    "Primeiro quero saber o valor do orçamento", // o Emiliano
    "Sim, pode colocar nif. Mas quero orçamento", // o Emiliano
    "Aguardo orçamento para decidir", // o Emiliano
    "Qual o vlr visto que estou a analisar com outras empresas também", // o Emiliano
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
    for (const t of ["Sim", "Bom dia", "Boa tarde", "Sou o Bento", "Ao pé do marco do correio", "Depende de como estiver no momento os lugares", "O sofa, a caixa que acompanha a chaise e dois bancos.", "1885-906", "Já mandei as fotos."]) {
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
    for (const t of ["2ª feira", "Sim", "Emiliano", "Rua das Flores 12"]) {
      expect(falaDeCoisas(t), t).toBe(false);
    }
  });

  it("o que fala do acesso", () => {
    expect(falaDoAcesso("Depende de como estiver no momento os lugares")).toBe(true);
    expect(falaDoAcesso("É uma rua chata para estacionar.")).toBe(true);
    expect(falaDoAcesso("2ª feira")).toBe(false);
  });
});
