import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type EstadoDaRecolha,
  montaCargasNaFrase,
  oQueSeCorrigiu,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
} from "./whatsapp-recolha";
import { datasDitas, parteDoDiaNaFrase, quandoComVariasDatas } from "./datas-ditas";
import {
  chegouFotografiaDepois,
  eAUltimaDaRajada,
  ePedidoDeReenvio,
  ESPERA_ANTES_DE_PEDIR_A_FOTOGRAFIA_MS,
  fotografiasFalhadasDaRajada,
  haFalhadaMaisNova,
  imagensDaRajada,
  MARCA_DE_FOTOGRAFIA,
  MARCA_DE_FOTOGRAFIA_FALHADA,
  oQueSeViuNaRajada,
  textoDaRajada,
} from "./rajada-do-whatsapp";
import { PEDIR_PARA_REENVIAR_A_FOTOGRAFIA } from "./voz-da-vitoria";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { camposDaRecolha } from "./pedido-da-recolha";
import { pedidoParaOMotor } from "./custo-do-trabalho-do-pedido";
import { passoDaPergunta } from "./reler-a-conversa";
import { LICOES_DAS_CONVERSAS } from "./whatsapp-compreensao";
import { falaDeCoisas, pareceQuando } from "./leitor-da-recolha";

/**
 * A CONVERSA DO ROUPEIRO COM MONTA-CARGAS — 17-11-2026 (decisão d57).
 *
 * O caso é verdadeiro (um pedido de 17-11); o nome, a rua, a porta e o código
 * postal são INVENTADOS, com a mesma forma (o repositório é público). O
 * cliente escreveu, de uma vez, a peça, os módulos, a morada, o andar e o
 * monta-cargas, e mandou fotografias. Correu mal em quatro sítios:
 *
 *   1. uma fotografia não descarregou, o pedido para a reenviar saiu no
 *      instante e cortou a rajada — o texto dele ficou para trás;
 *   2. a Vitória respondeu «Fica anotado: recolha de móveis.», como se só
 *      tivesse lido o serviço, e a descrição ficou cortada a meio da morada;
 *   3. «Tem monta-cargas mas não tenho a certeza que cabe» foi lido como
 *      «elevador: sim»;
 *   4. «Amanhã ao final do dia depois das 17h ou quinta da parte da manhã»
 *      ficou só amanhã às 17:00 — a quinta foi lida como um sítio («Quinta da
 *      Parte»).
 *
 * Terça-feira, 17-11-2026, 15:00 em Lisboa (hora fixa: o teste não depende do
 * relógio nem do fuso da máquina).
 */
const AGORA = new Date("2026-11-17T15:00:00Z");

const PRIMEIRA =
  "Boa tarde. Preciso de retirar um roupeiro de 4 módulos, desmonta-se. Fica na Rua das Amendoeiras 14, 3º andar, 1500-123 Lisboa. Tem monta-cargas mas não tenho a certeza que cabe.";
const NOME = "Rui Teixo";
const QUANDO = "Amanhã ao final do dia depois das 17h ou quinta da parte da manhã";

function falaComORui() {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  const estados: EstadoDaRecolha[] = [];
  [PRIMEIRA, NOME, QUANDO].forEach((m, i) => {
    const r = responderNaRecolha(estado, m, AGORA, i > 0, false, { fotos: 2 });
    estado = r.estado;
    disse.push(r.resposta);
    estados.push(r.estado);
  });
  return { estado, disse, estados };
}

describe("a conversa do roupeiro (d57)", () => {
  it("a primeira resposta diz o que leu: a peça, os módulos, a morada, o andar e o monta-cargas", () => {
    const { disse } = falaComORui();
    expect(disse[0]).toContain("Fica anotado: recolha de móveis — um roupeiro de 4 módulos (desmonta-se)");
    expect(disse[0]).toContain("morada Rua das Amendoeiras 14, Lisboa");
    expect(disse[0]).toContain("3.º andar, com monta-cargas (falta confirmar se cabe)");
    // O que se leu não é uma pergunta: a pergunta é a do nome, a seguir.
    expect(passoDaPergunta(disse[0].split("\n\n").find((p) => p.includes("Fica anotado")) ?? "")).toBeNull();
    expect(disse[0]).not.toMatch(/\b(IA|virtual)\b/);
  });

  it("não volta a pedir o que já disse: nem a morada, nem o andar, nem o elevador", () => {
    const { estados, disse } = falaComORui();
    expect(estados[0].passo).toBe("nome");
    expect(estados[1].passo).not.toMatch(/^(morada|codigoPostal|andar|elevador)$/);
    expect(disse.slice(1).join("\n")).not.toMatch(/elevador no prédio|tem elevador\?|qual é a morada/i);
  });

  it("o monta-cargas fica monta-cargas, com a dúvida — e o motor conhece o valor", () => {
    const { estado } = falaComORui();
    expect(estado.dados.montaCargas).toEqual({ cabe: "nao_sei" });
    expect(estado.dados.hasElevator).toBe("small");
    const campos = camposDaRecolha("351910000000", estado.dados);
    expect(campos.hasElevator).toBe("small");
    expect(campos.description).toMatch(/monta-cargas/);
    const motor = pedidoParaOMotor({ serviceType: "recolha_moveis", floor: "3", hasElevator: campos.hasElevator, rawOrderJson: "{}" });
    expect(motor?.acesso.elevador).toBe("sim");
    expect(motor?.notas.join(" ")).not.toMatch(/Elevador por saber/);
  });

  it("a descrição não fica cortada a meio da morada", () => {
    const { estado } = falaComORui();
    expect(estado.dados.description).toContain("roupeiro de 4 módulos, desmonta-se");
    expect(estado.dados.description).not.toMatch(/Fica na\./);
  });

  it("o resumo: monta-cargas pelo nome, e as duas datas, cada uma com a sua parte do dia", () => {
    const { estado } = falaComORui();
    const r = resumo(estado.dados);
    expect(r).toContain("elevador: monta-cargas (não sabe se cabe)");
    expect(r).toContain("Quando: quarta 18/11 ao fim do dia (depois das 17h) ou quinta 19/11 de manhã");
  });

  it("pelo caminho do modelo, que leu «elevador: sim», o monta-cargas manda na mesma", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      {
        intencao: "informar",
        campos: {
          servico: "recolha_moveis",
          morada: "Rua das Amendoeiras 14",
          codigoPostal: "1500-123 Lisboa",
          andar: "3",
          elevador: "sim",
          descricao: "Roupeiro de 4 módulos, desmonta-se",
        },
      },
      AGORA,
      { texto: PRIMEIRA },
    );
    expect(r.estado.dados.hasElevator).toBe("small");
    expect(r.estado.dados.montaCargas).toEqual({ cabe: "nao_sei" });
    expect(r.resposta).toContain("com monta-cargas (falta confirmar se cabe)");
    expect(r.estado.passo).toBe("nome");
  });

  it("a correcção diz o quando tratado, e não as palavras dele tal e qual", () => {
    const { estados } = falaComORui();
    const antes = { ...estados[1].dados, quandoTexto: "sexta", dataDesejada: null, quandoComTodas: null };
    expect(oQueSeCorrigiu(antes, estados[2].dados)).toContain(
      "quando: quarta 18/11 ao fim do dia (depois das 17h) ou quinta 19/11 de manhã",
    );
  });
});

describe("o caderno de frases do caso (d57)", () => {
  it("o monta-cargas, com e sem dúvida", () => {
    expect(montaCargasNaFrase("Tem monta-cargas mas não tenho a certeza que cabe")).toBe("nao_sei");
    expect(montaCargasNaFrase("tem monta cargas, não sei se cabe")).toBe("nao_sei");
    expect(montaCargasNaFrase("Há um monta-cargas no prédio")).toBe("sim");
    expect(montaCargasNaFrase("Não tem monta-cargas")).toBeNull();
    expect(montaCargasNaFrase("Tem elevador")).toBeNull();
  });

  it("os módulos, as partes e o «divide-se» são o trabalho", () => {
    expect(falaDeCoisas("São 4 módulos")).toBe(true);
    expect(falaDeCoisas("Divide-se em duas partes")).toBe(true);
    expect(falaDeCoisas("Desmonta-se")).toBe(true);
  });

  it("«quinta da parte da manhã» é o dia, e a Quinta do Anjo continua a ser um sítio", () => {
    expect(pareceQuando("quinta da parte da manhã")).toBe(true);
    expect(datasDitas("Moro na Quinta do Anjo", AGORA)).toEqual([]);
  });

  it("«hoje», «amanhã» e «depois de amanhã» contam como datas, pela ordem", () => {
    const d = datasDitas(QUANDO, AGORA);
    expect(d.map((x) => [x.dia, x.parteDoDia])).toEqual([
      ["2026-11-18", "ao fim do dia (depois das 17h)"],
      ["2026-11-19", "de manhã"],
    ]);
    expect(quandoComVariasDatas("depois de amanhã de manhã ou sexta à tarde", AGORA)).toBe(
      "quinta 19/11 de manhã ou sexta 20/11 à tarde",
    );
    expect(quandoComVariasDatas("hoje a partir das 18h ou amanhã", AGORA)).toBe(
      "terça 17/11 a partir das 18h ou quarta 18/11",
    );
  });

  it("a parte do dia só se cola a uma data", () => {
    expect(quandoComVariasDatas("de manhã", AGORA)).toBeNull();
    expect(datasDitas("de manhã, depois das 17h", AGORA)).toEqual([]);
    expect(parteDoDiaNaFrase("ao final do dia depois das 17h")).toBe("ao fim do dia (depois das 17h)");
    expect(parteDoDiaNaFrase("da parte da manha")).toBe("de manhã");
    expect(parteDoDiaNaFrase("as 10h")).toBe("às 10h");
    expect(parteDoDiaNaFrase("4 modulos")).toBe("");
  });

  it("o aviso ao modelo sabe do monta-cargas e das partes do dia", () => {
    expect(LICOES_DAS_CONVERSAS).toMatch(/UM MONTA-CARGAS NÃO É UM ELEVADOR QUALQUER/);
    expect(LICOES_DAS_CONVERSAS).toMatch(/CADA DATA COM A SUA PARTE DO DIA/);
  });
});

describe("a fotografia que falhou não corta a rajada (d57)", () => {
  const TEXTO = "Preciso de retirar um roupeiro de 4 módulos";

  it("[texto][falhada][pedido de reenvio] → o texto continua por responder, e lê-se", () => {
    const fio = [
      { id: 1, direccao: "out", texto: "Olá! Em que posso ajudar?" },
      { id: 2, direccao: "in", texto: TEXTO },
      { id: 3, direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA },
      { id: 4, direccao: "out", texto: PEDIR_PARA_REENVIAR_A_FOTOGRAFIA },
    ];
    expect(textoDaRajada(fio)).toBe(TEXTO);
    expect(eAUltimaDaRajada(2, fio)).toBe(true);
    expect(fotografiasFalhadasDaRajada(fio)).toBe(1);
    expect(imagensDaRajada(fio)).toBe(0);
  });

  it("as fotografias vistas antes do pedido de reenvio também ficam", () => {
    const fio = [
      { id: 1, direccao: "in", texto: `${MARCA_DE_FOTOGRAFIA} um roupeiro branco` },
      { id: 2, direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA },
      { id: 3, direccao: "out", texto: PEDIR_PARA_REENVIAR_A_FOTOGRAFIA },
      { id: 4, direccao: "in", texto: TEXTO },
    ];
    expect(imagensDaRajada(fio)).toBe(1);
    expect(oQueSeViuNaRajada(fio)).toEqual(["um roupeiro branco"]);
    expect(textoDaRajada(fio)).toBe(TEXTO);
  });

  it("uma resposta da Vitória corta a rajada, como sempre", () => {
    const fio = [
      { id: 1, direccao: "in", texto: TEXTO },
      { id: 2, direccao: "out", texto: "Com todo o gosto! Com quem tenho o gosto de falar?" },
      { id: 3, direccao: "in", texto: NOME },
    ];
    expect(textoDaRajada(fio)).toBe(NOME);
  });

  it("o pedido de reenvio reconhece-se também traduzido", () => {
    expect(ePedidoDeReenvio(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA)).toBe(true);
    for (const l of ["en", "fr", "es"] as const) {
      const t = traducaoFixa(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA, l);
      if (t) expect(ePedidoDeReenvio(t)).toBe(true);
    }
    expect(ePedidoDeReenvio("Obrigada!")).toBe(false);
  });

  it("espera-se cerca de 20 s; uma fotografia com bytes depois, ou outra falhada, e não pede esta", () => {
    expect(ESPERA_ANTES_DE_PEDIR_A_FOTOGRAFIA_MS).toBe(20_000);
    const fio = [
      { id: 1, direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA },
      { id: 2, direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
    ];
    expect(chegouFotografiaDepois(fio, 1)).toBe(true);
    expect(chegouFotografiaDepois(fio, 2)).toBe(false);
    expect(haFalhadaMaisNova([...fio, { id: 3, direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA }], 1)).toBe(true);
    expect(haFalhadaMaisNova(fio, 1)).toBe(false);
  });
});

describe("a ponte tenta a fotografia três vezes (d57)", () => {
  const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8");

  it("espera 1,5 s e 4 s antes de a dar por perdida, e diz o tipo do ficheiro e a versão da página", () => {
    expect(PONTE).toContain("const ESPERAS_DA_FOTOGRAFIA_MS = [1500, 4000];");
    expect(PONTE).toContain("const media = await descarregarComTentativas(msg, telefone);");
    const i = PONTE.indexOf("async function descarregarComTentativas");
    const bloco = PONTE.slice(i, PONTE.indexOf("\n}\n", i));
    expect(bloco).toContain("msg.downloadMedia()");
    expect(bloco).toContain("mimetype");
    expect(bloco).toContain("versaoDaPaginaCarregada");
    expect(PONTE).toContain("versaoDaPaginaCarregada = versao;");
  });
});
