import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORA_DO_PLANO, SERVICE_CATEGORIES, SERVICOS_PUBLICOS } from "./service-categories";
import { IDS_DA_LISTA, servicosPorExtenso } from "./servicos-da-vitoria";
import { naoFazemosEsseServico, O_QUE_PODE_FAZER, QUEM_FALA } from "./voz-da-vitoria";
import {
  fundirCampos,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  servicoDoTexto,
  servicoForaDoPlano,
  servicoPorPalavras,
  servicosDaLista,
  servicosDaListaNoFio,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { passoDaPergunta, recolhaPeloFio } from "./reler-a-conversa";
import { FORA_DO_PLANO_PARA_O_MODELO, SERVICOS_PARA_O_MODELO } from "./whatsapp-compreensao";
import { INSTRUCAO_DA_LEITURA } from "./leitura-das-conversas";
import { INSTRUCAO_DA_IMAGEM } from "./whatsapp-imagem";
import { paraTeclado } from "./whatsapp-cloud";

/**
 * A VITÓRIA E OS SERVIÇOS FORA DO PLANO — 25-10-2026.
 *
 * O dono decidiu que a montagem de móveis e a jardinagem e limpeza de
 * quintais saem do site e do simulador, e que a manutenção da casa
 * (reparações e remodelações) continua. A Vitória ainda as oferecia: na lista
 * numerada, no reconhecimento por palavras e nas opções que mandava ao
 * Gemini. Deixa de as oferecer; quem as pede ouve, com delicadeza, que de
 * momento a CLYON não as faz, e se precisa de outra coisa.
 *
 * E o número que o cliente escolhe continua a dar o serviço que estava ao
 * lado dele na lista que ELE viu — a de agora tem oito, a de antes tinha dez.
 */

// 14:00 em Lisboa — o horário de Inverno começou hoje, e Lisboa está em UTC.
const T0 = new Date("2026-10-25T14:00:00Z");

// A lista de dez de antes de 25-10-2026 — sem a garagem, o sótão e a cave, que só entraram a 29-10-2026.
const NOVOS_DE_29_10 = new Set(["esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]);
const ANTIGOS = SERVICE_CATEGORIES.filter((c) => !NOVOS_DE_29_10.has(c.id));
const LISTA_ANTIGA = ANTIGOS.map((c, i) => `${i + 1}. ${c.label}`).join("\n");
const IDS_ANTIGOS = ANTIGOS.map((c) => c.id);
const PERGUNTA_ANTIGA = `Boa tarde! ${QUEM_FALA}\n\nEm que posso ajudar? Diga-me o que precisa — se for mais fácil, responda com o número:\n${LISTA_ANTIGA}`;

const semAcentos = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const linhasDaLista = (texto: string) => texto.split("\n").filter((l) => /^\d+\. /.test(l));

describe("a lista numerada que a Vitória mostra", () => {
  it("é a do site: sem a montagem nem a jardinagem, e com a manutenção da casa", () => {
    const pergunta = perguntaDo("servico", {}, true, T0);
    expect(linhasDaLista(pergunta)).toEqual(SERVICOS_PUBLICOS.map((c, i) => `${i + 1}. ${c.label}`));
    expect(pergunta).toContain("Manutenção da casa");
    expect(pergunta).not.toMatch(/montagem|jardinagem|quintais/i);
  });

  it("cada número dá o serviço que está ao lado dele — pela lista mostrada, e não pela inteira", () => {
    const linhas = linhasDaLista(perguntaDo("servico", {}, true, T0));
    expect(linhas.length).toBe(SERVICOS_PUBLICOS.length);
    for (const linha of linhas) {
      const [, n, rotulo] = /^(\d+)\. (.+)$/.exec(linha)!;
      const id = SERVICE_CATEGORIES.find((c) => c.label === rotulo)!.id;
      expect(servicoDoTexto(n), linha).toBe(id);
      expect(servicoDoTexto(`${n}.`), linha).toBe(id);
    }
    // Desde 29-10-2026 a garagem, o sótão e a cave são o 6, o 7 e o 8; a manutenção da casa é o 10.
    expect(servicoDoTexto("7")).toBe("esvaziamento_sotao");
    expect(servicoDoTexto("10")).toBe("manutencao_casa");
    expect(servicoDoTexto("11")).toBe("outro");
    expect(servicoDoTexto("12")).toBeNull();
    expect(IDS_DA_LISTA).toEqual(SERVICOS_PUBLICOS.map((c) => c.id));
  });

  it("a lista que saiu no fio diz que número é que serviço — também a antiga, de dez", () => {
    const fio = [
      { direccao: "out", texto: paraTeclado(PERGUNTA_ANTIGA) },
      { direccao: "in", texto: "9" },
    ];
    const lista = servicosDaListaNoFio(fio);
    expect(lista).toEqual(IDS_ANTIGOS);
    expect(servicoDoTexto("9", lista)).toBe("manutencao_casa");
    expect(servicoDoTexto("10", lista)).toBe("outro");
    expect(servicoDoTexto("7", lista)).toBeNull();
    expect(servicoForaDoPlano("7", lista)).toBe("montagem_moveis");
    expect(servicoForaDoPlano("8", lista)).toBe("jardinagem");
    // A de agora, e a última que saiu é a que conta.
    const agora = paraTeclado(perguntaDo("servico", {}, true, T0));
    expect(servicosDaListaNoFio([...fio, { direccao: "out", texto: agora }])).toEqual([...IDS_DA_LISTA]);
    // Uma numeração qualquer não é a lista, e o que ele escreve também não.
    expect(servicosDaLista("1. Sofá\n2. Mesa\n3. Cadeiras")).toBeNull();
    expect(servicosDaListaNoFio([{ direccao: "in", texto: LISTA_ANTIGA }])).toBeNull();
  });

  it("quem viu a lista antiga e escolhe o 7 ouve que a montagem não se faz; o 9 é a manutenção", () => {
    const sete = responderNaRecolha(recolhaNova(), "7", T0, true, false, { lista: IDS_ANTIGOS });
    expect(sete.foraDoPlano).toBe("montagem_moveis");
    expect(sete.estado.passo).toBe("servico");
    expect(sete.estado.dados.serviceType).toBeUndefined();
    expect(sete.resposta).toContain(naoFazemosEsseServico("montagem_moveis"));

    const nove = responderNaRecolha(recolhaNova(), "9", T0, true, false, { lista: IDS_ANTIGOS });
    expect(nove.estado.dados.serviceType).toBe("manutencao_casa");
    expect(nove.foraDoPlano).toBeUndefined();
  });
});

describe("uma conversa pela lista numerada (sem o Gemini)", () => {
  it("«Olá» leva a lista, e o 10 é a manutenção da casa", () => {
    const ola = responderNaRecolha(recolhaNova(), "Olá", T0, false, false);
    expect(ola.resposta).toContain(QUEM_FALA);
    expect(ola.resposta).toContain("10. Manutenção da casa");
    expect(ola.resposta).not.toMatch(/montagem|jardinagem/i);

    const lista = servicosDaLista(paraTeclado(ola.resposta));
    const sete = responderNaRecolha(ola.estado, "10", T0, true, false, { lista });
    expect(sete.estado.dados.serviceType).toBe("manutencao_casa");
    expect(sete.resposta).toContain("manutenção da casa");
    expect(sete.estado.passo).toBe("nome");
  });

  it("e o 3 continua a ser o entulho, e o 1 os móveis", () => {
    expect(responderNaRecolha(recolhaNova(), "3", T0, true, false).estado.dados.serviceType).toBe("recolha_entulho");
    expect(responderNaRecolha(recolhaNova(), "1", T0, true, false).estado.dados.serviceType).toBe("recolha_moveis");
  });
});

describe("a montagem de móveis, pedida por palavras", () => {
  const PRIMEIRA =
    "Boa tarde. Fazem montagem de móveis? Comprei um roupeiro e uma cómoda e preciso de os montar.";

  it("a primeira mensagem leva a apresentação, o «não fazemos» e a pergunta se precisa de outra coisa", () => {
    const r = responderNaRecolha(recolhaNova(), PRIMEIRA, T0, false, false);
    expect(r.foraDoPlano).toBe("montagem_moveis");
    expect(r.estado.passo).toBe("servico");
    expect(r.estado.dados.serviceType).toBeUndefined();
    expect(r.resposta).toContain(QUEM_FALA);
    expect(r.resposta).toContain("Peço imensa desculpa, mas de momento a CLYON não faz montagem de móveis.");
    expect(r.resposta).toContain("Precisa de outra coisa?");
    // Pelos números, a lista vai com ela — a de agora.
    expect(linhasDaLista(r.resposta)).toEqual(SERVICOS_PUBLICOS.map((c, i) => `${i + 1}. ${c.label}`));
    expect(r.resposta).not.toMatch(/Fica anotado|recolha de móveis\./);
    // A releitura sabe que a pergunta em cima é a do serviço.
    expect(passoDaPergunta(paraTeclado(r.resposta))).toBe("servico");
  });

  it("e a seguir, se ele quer outra coisa, a conversa segue com essa", () => {
    const r1 = responderNaRecolha(recolhaNova(), PRIMEIRA, T0, false, false);
    const r2 = responderNaRecolha(r1.estado, "Ah, então e levam o roupeiro velho?", T0, true, false);
    expect(r2.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r2.foraDoPlano).toBeUndefined();
    expect(r2.estado.passo).not.toBe("servico");
  });

  it("à segunda vez oferece uma pessoa — e a frase não é a mesma, que o envio calaria", () => {
    const r1 = responderNaRecolha(recolhaNova(), PRIMEIRA, T0, false, false);
    const r2 = responderNaRecolha(r1.estado, "Mas é só montar os móveis, não dá mesmo?", T0, true, false);
    expect(r2.foraDoPlano).toBe("montagem_moveis");
    expect(r2.resposta).not.toContain(QUEM_FALA);
    expect(r2.resposta).toContain("falar com alguém");
    expect(r2.resposta).not.toBe(r1.resposta);
  });

  it("pelo Gemini, as palavras dele mandam sobre o palpite do modelo", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { servico: "recolha_moveis", descricao: "montar um roupeiro novo" } },
      T0,
      { texto: "Preciso de alguém para montar um roupeiro novo", jaCumprimentou: true },
    );
    expect(r.foraDoPlano).toBe("montagem_moveis");
    expect(r.estado.dados.serviceType).toBeUndefined();
    expect(r.estado.passo).toBe("servico");
    expect(r.resposta).toBe(
      `${naoFazemosEsseServico("montagem_moveis")} Precisa de outra coisa? Pode ser ${O_QUE_PODE_FAZER} — diga-me à vontade.`,
    );
    expect(passoDaPergunta(paraTeclado(r.resposta))).toBe("servico");
  });

  it("e o modelo não consegue pôr no pedido um serviço que a CLYON não faz", () => {
    expect(fundirCampos({}, { servico: "montagem_moveis" }).serviceType).toBeUndefined();
    expect(fundirCampos({}, { servico: "jardinagem" }).serviceType).toBeUndefined();
    expect(fundirCampos({}, { servico: "manutencao_casa" }).serviceType).toBe("manutencao_casa");
    expect(fundirCampos({}, { servico: "mudanca" }).serviceType).toBe("mudanca");
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { servico: "montagem_moveis" } },
      T0,
      { texto: "Preciso de ajuda com umas coisas do IKEA", jaCumprimentou: true },
    );
    expect(r.estado.dados.serviceType).toBeUndefined();
  });
});

describe("a jardinagem e a limpeza de quintais", () => {
  it("pelo Gemini, na primeira mensagem: a apresentação e o «não fazemos»", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { descricao: "cortar a relva e limpar o quintal" } },
      T0,
      { texto: "Bom dia, precisava de alguém para cortar a relva e limpar o quintal", jaCumprimentou: false },
    );
    expect(r.foraDoPlano).toBe("jardinagem");
    expect(r.resposta.startsWith("Boa tarde!")).toBe(true);
    expect(r.resposta).toContain(QUEM_FALA);
    expect(r.resposta).toContain("de momento a CLYON não faz jardinagem nem limpeza de quintais.");
    expect(r.resposta).toContain("Precisa de outra coisa?");
  });

  it("pelos números também", () => {
    const r = responderNaRecolha(recolhaNova(), "Fazem limpeza de quintais?", T0, true, false);
    expect(r.foraDoPlano).toBe("jardinagem");
    expect(r.resposta).toContain("não faz jardinagem nem limpeza de quintais");
  });
});

describe("quem pede o que não se faz, e quem não pede", () => {
  it("estes pedem a montagem ou a jardinagem", () => {
    const fora: Array<[string, string]> = [
      ["Montagem e desmontagem de móveis", "montagem_moveis"],
      ["preciso de montar uma cama", "montagem_moveis"],
      ["Fazem montagem de cozinhas?", "montagem_moveis"],
      ["Preciso de um jardineiro", "jardinagem"],
      ["poda de árvores no jardim", "jardinagem"],
      ["Fazem a manutenção do jardim?", "jardinagem"],
      ["Queria tratar do meu quintal", "jardinagem"],
      ["Limpeza de quintal com mato", "jardinagem"],
    ];
    for (const [frase, id] of fora) {
      expect(servicoForaDoPlano(frase), frase).toBe(id);
      expect(servicoDoTexto(frase), frase).toBeNull();
      expect(servicoPorPalavras(frase), frase).toBeNull();
    }
  });

  it("e estes não — dizer «não fazemos» a quem queria uma recolha perdia o cliente", () => {
    const dentro: Array<[string, string]> = [
      ["Tenho um roupeiro para desmontar e levar", "recolha_moveis"],
      ["Recolha de um sofá numa moradia com quintal", "recolha_moveis"],
      ["Tenho um sofá velho, a casa tem quintal", "recolha_moveis"],
      ["Levam o sofá velho e montam o novo?", "recolha_moveis"],
      ["Queria tirar uma dúvida: levam um frigorífico?", "recolha_monos"],
      ["Recolha de um colchão na Quinta do Conde", "recolha_monos"],
      ["Mudança de um T2, com desmontagem e montagem dos móveis", "mudanca"],
      ["três big bags com terra e pedras num jardim", "recolha_entulho"],
      ["Quero remodelar a casa de banho", "manutencao_casa"],
      ["Preciso de reparar uma torneira", "manutencao_casa"],
      ["Pintar o muro do quintal", "manutencao_casa"],
      ["Montar umas prateleiras e reparar a torneira", "manutencao_casa"],
    ];
    for (const [frase, id] of dentro) {
      expect(servicoForaDoPlano(frase), frase).toBeNull();
      expect(servicoDoTexto(frase), frase).toBe(id);
    }
    // Levar os restos de jardim é uma recolha: não se recusa (o serviço pergunta-se).
    expect(servicoForaDoPlano("Tenho ramos e restos de poda para levar")).toBeNull();
  });
});

describe("a frase dela", () => {
  it("diz as famílias da lista do site, e nenhuma das que saíram", () => {
    const frase = semAcentos(O_QUE_PODE_FAZER);
    for (const c of SERVICOS_PUBLICOS.filter((s) => s.id !== "outro")) {
      const familia = semAcentos(c.label).split(" ")[0];
      expect(frase, c.id).toContain(familia);
    }
    expect(frase).not.toMatch(/montagem|jardin|quinta/);
  });

  it("tem um nome para cada serviço fora do plano, e é a voz de uma assistente online", () => {
    for (const id of FORA_DO_PLANO) {
      const f = naoFazemosEsseServico(id);
      expect(f, id).not.toContain("esse serviço");
      expect(f, id).not.toMatch(/\bIA\b|virtual|rob[oô]|intelig[eê]ncia artificial/i);
      expect(f, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("o que vai aos modelos", () => {
  it("as opções do serviço são as do site, com o aviso do que não se faz", () => {
    const ids = SERVICOS_PARA_O_MODELO.split("\n").map((l) => /^- (\w+):/.exec(l)?.[1]);
    expect(ids).toEqual(SERVICOS_PUBLICOS.map((c) => c.id));
    expect(SERVICOS_PARA_O_MODELO).not.toMatch(/montagem_moveis|jardinagem/);
    expect(FORA_DO_PLANO_PARA_O_MODELO).toContain("montagem e desmontagem de móveis");
    expect(FORA_DO_PLANO_PARA_O_MODELO).toContain("jardinagem e limpeza de quintais");
    expect(FORA_DO_PLANO_PARA_O_MODELO).toContain('NÃO preenchas "servico"');
  });

  it("e as duas leituras do pedido usam-nas — já não a lista inteira", () => {
    const codigo = readFileSync(join(process.cwd(), "src/lib/whatsapp-compreensao.ts"), "utf8").replace(
      /^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm,
      "",
    );
    expect(codigo).not.toContain("SERVICE_CATEGORIES");
    expect(codigo).not.toContain("recolhas, mudanças e limpezas");
    expect((codigo.match(/\[SERVICOS_PARA_O_MODELO, FORA_DO_PLANO_PARA_O_MODELO\]/g) ?? []).length).toBe(2);
  });

  it("a leitura das conversas e a das fotografias sabem da manutenção da casa", () => {
    expect(servicosPorExtenso()).toContain("manutenção da casa");
    for (const c of SERVICOS_PUBLICOS.filter((s) => s.id !== "outro")) {
      expect(servicosPorExtenso(), c.id).toContain(c.label.charAt(0).toLowerCase() + c.label.slice(1));
    }
    for (const instrucao of [INSTRUCAO_DA_LEITURA, INSTRUCAO_DA_IMAGEM]) {
      expect(instrucao).toContain(servicosPorExtenso());
      expect(instrucao).not.toMatch(/montagem|jardinagem/i);
    }
    expect(INSTRUCAO_DA_IMAGEM).toContain("reparar, pintar ou remodelar");
  });
});

describe("a primeira resposta e a releitura", () => {
  it("na primeira mensagem sai a resposta dela, e o número lê-se pela lista do fio", () => {
    const codigo = readFileSync(join(process.cwd(), "src/lib/whatsapp-negociacao.ts"), "utf8").replace(
      /^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm,
      "",
    );
    expect(codigo).toMatch(/r\.foraDoPlano\s*&&\s*!r\.desistir\s*\?\s*r\.resposta/);
    expect(codigo).toContain("servicosDaListaNoFio(fio)");
    expect((codigo.match(/visto,\s*lista\b/g) ?? []).length).toBe(2);
  });

  it("a releitura lê o número pela lista que ele viu", () => {
    const fio = [
      { direccao: "out", texto: paraTeclado(PERGUNTA_ANTIGA), criadoEm: "2026-10-25 12:00:00" },
      { direccao: "in", texto: "9", criadoEm: "2026-10-25 12:01:00" },
    ];
    const { dados } = recolhaPeloFio(fio, T0);
    expect(dados.serviceType).toBe("manutencao_casa");

    const montagem = recolhaPeloFio([fio[0], { ...fio[1], texto: "7" }], T0);
    expect(montagem.dados.serviceType).toBeUndefined();
    expect(montagem.passo).toBe("servico");
  });

  it("o estado que se guarda não leva o serviço recusado", () => {
    const e: EstadoDaRecolha = { passo: "servico", dados: { contactName: "Gaspar" } };
    const r = responderNaRecolha(e, "Preciso de montar uma cama", T0, true, false);
    expect(r.estado.dados.contactName).toBe("Gaspar");
    expect(r.estado.dados.serviceType).toBeUndefined();
  });
});
