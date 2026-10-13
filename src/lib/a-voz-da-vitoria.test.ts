import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agradecimento,
  apresentacao,
  eClienteDeVolta,
  perguntaSeFazemos,
  reclamaDoAtendimento,
} from "./voz-da-vitoria";
import {
  type EstadoDaRecolha,
  jaCumprimentouNesteFio,
  mensagemDePedidoRegistado,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
} from "./whatsapp-recolha";
import { MARCA_DE_PEDIDO_REGISTADO, passoDaPergunta } from "./reler-a-conversa";

/**
 * A VOZ DA VITÓRIA — 13-10-2026.
 *
 * A primeira reclamação no Google por causa do assistente: o Lázaro, 1
 * estrela, «arrogância e grosseria». O dono: «uma mulher delicada, simpática
 * e atenciosa, sempre cordial e com energias positivas». Chama-se Vitória,
 * é a «assistente online da CLYON» (nem IA nem virtual), e o emoji é com conta.
 */

// 15:10 em Lisboa, no Verão (UTC+1).
const TARDE = new Date("2026-10-06T14:10:00Z");

function conversa(mensagens: string[], agora = TARDE) {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  const respostas = mensagens.map((m, i) => {
    const r = responderNaRecolha(estado, m, agora, i > 0);
    estado = r.estado;
    disse.push(r.resposta);
    return r;
  });
  return { estado: () => estado, disse, respostas };
}

describe("a conversa do Lázaro, como devia ter sido", () => {
  const c = conversa([
    "Vocês fazem recolha de janelas?",
    "Lázaro. Já contratei vcs umas duas vezes",
    "A morada é Rua 8 de março 9A 2860-362 Moita",
  ]);

  it("à pergunta «fazem?», responde «Fazemos, sim!» — e janelas são monos, não móveis", () => {
    expect(c.respostas[0].estado.dados.serviceType).toBe("recolha_monos");
    expect(c.disse[0]).toContain("Aqui é a Vitória, assistente online da CLYON");
    expect(c.disse[0]).toContain("Fazemos, sim!");
    expect(c.disse[0]).not.toContain("— certo");
    expect(c.disse[0]).toContain("Com quem tenho o gosto de falar?");
  });

  it("quem já é cliente é recebido como quem volta", () => {
    expect(c.respostas[1].estado.dados.contactName).toBe("Lázaro");
    expect(c.disse[1]).toContain("Que bom voltar a falar consigo, Lázaro! Obrigada pela confiança.");
    expect(c.disse[1]).toMatch(/Qual é a morada, por favor\?/);
  });

  it("a morada inteira lê-se à primeira, sem «Preciso da rua e do número»", () => {
    const d = c.respostas[2].estado.dados;
    expect(d.address).toMatch(/Rua 8 de março 9A/);
    expect(d.postalCode).toBe("2860-362");
    expect(d.city).toBe("Moita");
    expect(c.disse[2]).not.toMatch(/Preciso/);
    expect(c.disse[2]).toMatch(/^Obrigada!/);
  });

  it("«com esse atendimento fica difícil» é uma queixa: pede desculpa e passa a alguém da equipa", () => {
    const r = responderNaRecolha(c.estado(), "Sim da, mas com esse atendimento fica difícil", TARDE, true);
    expect(r.pedirPessoa).toBe(true);
    expect(r.motivoDaEntrega).toMatch(/insatisfeito com o atendimento/);
    expect(r.resposta).toContain("Peço imensa desculpa, Lázaro.");
    expect(r.resposta).not.toMatch(/Para quando precisa/);
    // O que ele já disse fica.
    expect(r.estado.dados.address).toMatch(/Rua 8 de março/);
  });

  it("e «vou arrumar outra empresa. Passar bem!» também — pelo Gemini ou sem ele", () => {
    const texto = "Pode deixar vou arrumar outra empresa. Passar bem!";
    expect(responderNaRecolha(c.estado(), texto, TARDE, true).pedirPessoa).toBe(true);
    const g = responderComCompreensao(c.estado(), { intencao: "informar", campos: {} }, TARDE, { texto });
    expect(g.pedirPessoa).toBe(true);
    expect(g.resposta).toContain("Peço imensa desculpa");
  });
});

describe("a queixa vale em qualquer conversa, e não só na recolha", () => {
  it("o WhatsApp lê-a antes da impaciência, que também apanha «outra empresa»", () => {
    const N = readFileSync(join(process.cwd(), "src/lib/whatsapp-negociacao.ts"), "utf8");
    const queixa = N.indexOf("if (reclamaDoAtendimento(conteudo.texto))");
    const paciencia = N.indexOf("if (estaAPerderAPaciencia(conteudo.texto))");
    expect(queixa).toBeGreaterThan(0);
    expect(queixa).toBeLessThan(paciencia);
  });
});

describe("como ela fala", () => {
  it("apresenta-se pelo nome, uma vez, com um sorriso", () => {
    expect(apresentacao("Bom dia", "Ana")).toBe("Bom dia, Ana! Aqui é a Vitória, assistente online da CLYON 😊");
    expect(apresentacao("Boa noite", null)).toBe("Boa noite! Aqui é a Vitória, assistente online da CLYON 😊");
  });

  it("nunca diz que é uma IA, um robô ou uma assistente virtual", () => {
    const c = conversa([
      "Olá, preciso de levar um sofá velho",
      "Ana Silva",
      "Rua das Flores 12, 2º esq, 2845-513 Amora",
      "sim, cabe",
      "dá",
      "sexta de manhã",
      "Um sofá de 3 lugares",
      "não",
    ]);
    for (const m of c.disse) {
      expect(m).not.toMatch(/\bIA\b|intelig[eê]ncia artificial|virtual|rob[ôo]|\bbot\b/i);
      expect(m).not.toMatch(/Responda sim ou não/i);
      expect(m).not.toMatch(/\bObrigado\b/);
    }
  });

  it("agradece cada resposta antes da pergunta seguinte", () => {
    const c = conversa([
      "Olá, preciso de levar um sofá velho",
      "Ana Silva",
      "Rua das Flores 12, 2845-513 Amora",
      "2º",
    ]);
    expect(c.disse[0]).toContain("Com todo o gosto! Fica anotado: recolha de móveis.");
    expect(c.disse[1]).toMatch(/^Muito prazer, Ana!/);
    expect(c.disse[2]).toMatch(/^Obrigada!/);
    expect(c.disse[3]).toMatch(/^Muito bem\./);
  });

  it("o emoji é com conta: um no cumprimento, nenhum nas perguntas", () => {
    const emoji = /\p{Extended_Pictographic}/gu;
    const c = conversa(["Olá, preciso de levar um sofá velho", "Ana Silva", "Rua das Flores 12, 2845-513 Amora"]);
    expect(c.disse[0].match(emoji)?.length).toBe(1);
    expect(c.disse[1].match(emoji)).toBeNull();
    expect(c.disse[2].match(emoji)).toBeNull();
  });

  it("o resumo abre com um obrigada, e pede o SIM sem ser uma ordem", () => {
    const r = resumo({ serviceType: "recolha_moveis", contactName: "Ana Silva" });
    expect(r).toMatch(/^Já tenho tudo, muito obrigada!/);
    expect(r).toContain("Se estiver tudo certo, responda SIM e fica registado.");
  });

  it("o pedido registado acaba no agradecimento, com o nome e o único emoji", () => {
    const m = mensagemDePedidoRegistado(412, true, "Ana Silva");
    expect(m).toMatch(/^Pedido #412 registado! Muito obrigada, Ana\./);
    expect(m.match(/\p{Extended_Pictographic}/gu)?.length).toBe(1);
    // A releitura continua a ver onde acabou uma conversa — a de hoje e as de antes.
    expect(MARCA_DE_PEDIDO_REGISTADO.test(m)).toBe(true);
    expect(MARCA_DE_PEDIDO_REGISTADO.test("Pedido #300 registado. A equipa CLYON vai conferi-lo")).toBe(true);
  });

  it("quem pede uma pessoa tem-na com gosto; e quem pergunta se é um robô também", () => {
    const r = responderNaRecolha(recolhaNova(), "Quero falar com uma pessoa", TARDE);
    expect(r.pedirPessoa).toBe(true);
    expect(r.resposta).toMatch(/^Com todo o gosto!/);
    expect(responderNaRecolha(recolhaNova(), "É um robô?", TARDE).pedirPessoa).toBe(true);
  });
});

describe("o que ela reconhece nas palavras do cliente", () => {
  it("as queixas", () => {
    expect(reclamaDoAtendimento("Sim da, mas com esse atendimento fica difícil")).toBe(true);
    expect(reclamaDoAtendimento("Pode deixar vou arrumar outra empresa. Passar bem!")).toBe(true);
    expect(reclamaDoAtendimento("Parece que estou a falar com um robô")).toBe(true);
    expect(reclamaDoAtendimento("Que falta de educação")).toBe(true);
    expect(reclamaDoAtendimento("Atendimento péssimo")).toBe(true);
  });

  it("e o que não é queixa nenhuma", () => {
    expect(reclamaDoAtendimento("Bom dia, espero que esteja a passar bem")).toBe(false);
    expect(reclamaDoAtendimento("Muito obrigado, passar bem!")).toBe(false);
    expect(reclamaDoAtendimento("Tenho uma máquina de lavar e um robô de cozinha")).toBe(false);
    expect(reclamaDoAtendimento("Obrigado pelo atendimento")).toBe(false);
    expect(reclamaDoAtendimento("Que vergonha, esqueci-me do código postal")).toBe(false);
  });

  it("quem volta", () => {
    expect(eClienteDeVolta("Já contratei vcs umas duas vezes")).toBe(true);
    expect(eClienteDeVolta("já sou cliente")).toBe(true);
    expect(eClienteDeVolta("Já tenho tudo embalado")).toBe(false);
  });

  it("quem pergunta se fazemos", () => {
    expect(perguntaSeFazemos("Vocês fazem recolha de janelas?")).toBe(true);
    expect(perguntaSeFazemos("Recolhem frigoríficos?")).toBe(true);
    expect(perguntaSeFazemos("Preciso de levar um sofá")).toBe(false);
  });

  it("o agradecimento muda com o passo", () => {
    expect(agradecimento("nome", "Ana")).toBe("Muito prazer, Ana!");
    expect(agradecimento("morada")).not.toBe(agradecimento("andar"));
  });
});

describe("as conversas de antes continuam a ler-se", () => {
  it("o «Aqui é a CLYON» de antes e o «Aqui é a Vitória» de hoje são ambos um cumprimento", () => {
    expect(jaCumprimentouNesteFio([{ direccao: "out", texto: "Bom dia! Aqui é a CLYON." }])).toBe(true);
    expect(jaCumprimentouNesteFio([{ direccao: "out", texto: "Bom dia! Aqui e a Vitoria, assistente online da CLYON" }])).toBe(true);
  });

  it("as perguntas novas reconhecem-se no fio", () => {
    expect(passoDaPergunta("Muito prazer!\n\nCom quem tenho o gosto de falar?")).toBe("nome");
    expect(passoDaPergunta("Peço desculpa, não apanhei bem a rua e o número da porta.")).toBe("morada");
    expect(passoDaPergunta("Peço desculpa, não percebi bem o andar. É rés-do-chão, ou que andar é?")).toBe("andar");
    expect(passoDaPergunta("Se estiver tudo certo, é só responder SIM e fica registado.")).toBe("confirmar");
    expect(passoDaPergunta(resumo({ serviceType: "mudanca" }))).toBe("confirmar");
  });
});
