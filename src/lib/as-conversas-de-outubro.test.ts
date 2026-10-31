import { describe, it, expect } from "vitest";
import {
  COMO_CHEGA_O_PRECO,
  LEMBRETE_DO_PRECO,
  fotosNoFio,
  jaExplicouOPreco,
  mensagemDePedidoRegistado,
  recolhaNova,
  responderNaRecolha,
  resumo,
  servicoDoTexto,
  type ContextoDaRecolha,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";
import { paraTeclado } from "./whatsapp-cloud";

/**
 * AS TRÊS CONVERSAS DE OUTUBRO — 10-10-2026.
 *
 * O caso é verdadeiro; o nome, a morada, o código postal e a hora são
 * INVENTADOS (o repositório é público — 31-10-2026, d1).
 *
 * *«Melhore nosso assistente para ele não cometer esses erros.»* — o dono,
 * com as capturas de três conversas inteiras. Nas três respondeu o caminho
 * sem Gemini (o modelo estava a falhar e ninguém o via), e é esse que aqui se
 * ensaia: `responderNaRecolha`, com as frases dos clientes.
 *
 * Como na conversa do Anselmo, cada cliente escreve primeiro o que escreveu de
 * facto, e depois responde ao que lhe perguntam — com as palavras dele. É
 * assim que se vê o que o assistente pergunta a mais.
 */

type Conversa = {
  estado: EstadoDaRecolha;
  /** Tudo o que a CLYON disse, pela ordem. */
  disse: string[];
  ultima: RespostaDaRecolha;
};

function conversa(agora: Date, contexto: ContextoDaRecolha = {}) {
  const c: Conversa = {
    estado: recolhaNova(),
    disse: [],
    ultima: { estado: recolhaNova(), resposta: "" },
  };
  const dizer = (texto: string, extra: ContextoDaRecolha = {}) => {
    const r = responderNaRecolha(c.estado, texto, agora, c.disse.length > 0, false, {
      ...contexto,
      ...extra,
    });
    c.estado = r.estado;
    c.disse.push(r.resposta);
    c.ultima = r;
    return r;
  };
  /** Responde ao que lhe perguntam até ao resumo, com as palavras dele. */
  const responderAte = (respostas: Array<[RegExp, string]>) => {
    for (let volta = 0; volta < 15 && c.estado.passo !== "confirmar"; volta++) {
      const pergunta = c.disse[c.disse.length - 1];
      const resposta = respostas.find(([re]) => re.test(pergunta))?.[1];
      if (!resposta) throw new Error(`Não sabe responder a: ${pergunta}`);
      dizer(resposta);
    }
  };
  return { c, dizer, responderAte };
}

/* ──────────────────────────────────────────────────────────────────────────
 * O TELMO — 10-10-2026, 11:20 em Lisboa. Desistiu: «está muito complicado».
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do Telmo", () => {
  // As capturas do WhatsApp do dono estão uma hora à frente de Lisboa: 12:20 lá são 11:20 cá.
  const AGORA = new Date("2026-10-10T11:20:00+01:00");
  // A mensagem reencaminhada aparece cortada na captura («esses são os mo…»).
  const PRIMEIRA = "Edson, conforme falamos esses são os móveis.\nO local é Ajuda/Lisboa.";

  function falaComOTelmo() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 18 });
    dizer(PRIMEIRA);
    dizer("Obrigado Telmo");
    responderAte([
      [/morada/i, "Travessa dos Melros Azuis, 9, R/C Esq.\n1300-123 Lisboa"],
      [/Com quem (estou a falar|tenho o gosto)/, "Sou o Telmo"],
      [/carrinha|estacionar/, "Sim"],
      [/Para quando/, "O mais breve possível"],
      [/fa(c)?tura/, "Não é necessário"],
    ]);
    return c;
  }

  it("«Obrigado Telmo» é o Telmo — e não «Obrigado Telmo»", () => {
    const c = falaComOTelmo();
    expect(c.estado.dados.contactName).toBe("Telmo");
    expect(resumo(c.estado.dados)).toContain("Nome: Telmo\n");
  });

  it("a morada sai partida, sem a rua duas vezes", () => {
    const d = falaComOTelmo().estado.dados;
    // Desde 26-10-2026 o «R/C Esq» sai da morada e vai com o andar.
    expect(d.address).toBe("Travessa dos Melros Azuis, 9");
    expect(d.lado).toBe("Esq");
    expect(d.postalCode).toBe("1300-123");
    expect(d.city).toBe("Lisboa");
    // Era «…R/C Esq., 1300-123, Travessa dos Melros Azuis 9 R/C Esq. Lisboa».
    expect(resumo(d).match(/Travessa dos Melros Azuis/g)).toHaveLength(1);
  });

  it("o «R/C Esq.» da morada é o andar — e num r/c o elevador não se pergunta", () => {
    const c = falaComOTelmo();
    expect(c.estado.dados.floor).toBe("0");
    const tudo = c.disse.join("\n");
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("elevador");
    expect(resumo(c.estado.dados)).toContain("Andar: r/c Esq · estacionar à porta: sim");
  });

  it("com dezoito fotografias, não se lhe pede que conte o que há para levar", () => {
    const c = falaComOTelmo();
    expect(c.disse.join("\n")).not.toContain("Conte-me o que há");
    expect(c.estado.dados.description).toContain("móveis");
  });

  it("chega ao resumo com cinco perguntas, e não com onze", () => {
    const c = falaComOTelmo();
    expect(c.estado.passo).toBe("confirmar");
    // Duas da primeira mensagem e do nome, e as que ele respondeu.
    expect(c.disse.length).toBeLessThanOrEqual(7);
  });

  it("a primeira resposta cumprimenta-o pelo nome quando ele o diz logo", () => {
    const { c, dizer } = conversa(AGORA, { fotos: 18 });
    dizer(`${PRIMEIRA}\nObrigado Telmo`);
    expect(c.disse[0]).toContain("Bom dia, Telmo!");
    expect(c.disse[0]).toContain("Fica anotado: recolha de móveis.");
    expect(c.disse[0]).toContain("Qual é a morada, por favor?");
  });

  it("«Sou o Telmo», dito tarde, é o nome — e nunca o andar", () => {
    // O passo em que ele estava na conversa verdadeira: a pergunta do andar.
    const r = responderNaRecolha(
      { passo: "andar", dados: { serviceType: "recolha_moveis", contactName: "Obrigado Telmo", address: "Travessa dos Melros Azuis" } },
      "Sou o Telmo",
      AGORA,
      true,
    );
    expect(r.estado.dados.contactName).toBe("Telmo");
    expect(r.estado.dados.floor).toBeUndefined();
    expect(r.estado.passo).toBe("andar");
    expect(r.resposta).toContain("Obrigada, Telmo!");
  });

  it("«Como está escrito acima é R/C» responde à pergunta do elevador", () => {
    const r = responderNaRecolha(
      { passo: "elevador", dados: { serviceType: "recolha_moveis", contactName: "Telmo", address: "Travessa dos Melros Azuis, 9" } },
      "Como está escrito acima é R/C ou seja só tem os degraus da entrada",
      AGORA,
      true,
    );
    expect(r.estado.dados.floor).toBe("0");
    expect(r.estado.passo).toBe("estacionamento");
    expect(r.resposta).not.toMatch(/Responda sim ou não/);
  });

  it("«Já mandei as fotos» não é a descrição", () => {
    const r = responderNaRecolha(
      { passo: "descricao", dados: { serviceType: "recolha_moveis", contactName: "Telmo" } },
      "Já mandei as fotos.",
      AGORA,
      true,
    );
    expect(r.estado.dados.description).toBe(DESCRICAO_DAS_FOTOS);
  });

  it("quem desiste não leva «Para registar responda SIM» — passa a uma pessoa", () => {
    const c = falaComOTelmo();
    const r = responderNaRecolha(c.estado, "Obrigado, está muito complicado. Prefiro desistir.", AGORA, true);
    expect(r.pedirPessoa).toBe(true);
    expect(r.desistir).toBeFalsy(); // não se apaga o que ele já disse
    expect(r.resposta).toContain("peço desculpa");
    expect(r.resposta).not.toContain("responda SIM");
    expect(r.motivoDaEntrega).toMatch(/desistiu/i);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * O MAXIMIANO — 09-10-2026, 16:10 em Lisboa. Tinha dito tudo na primeira mensagem.
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do Maximiano", () => {
  const AGORA = new Date("2026-10-09T16:10:00+01:00"); // 17:10 na captura
  const PRIMEIRA =
    "Olá! Gostava de pedir um orçamento à CLYON.\n\nAqui está o sofá.\nTirei duas fotos porque é um sofa com chaise longue, contudo a parte da chaise é separada da estrutura principal.\n\nA morada é Rua das Gralhas Mansas, N24, 1°esq. 1495-321 Algés\n\nAs medidas 2,35m (comprimento) x 0,89m (largura) x 0,68 m (altura)";

  function falaComOMaximiano() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 2 });
    dizer(PRIMEIRA);
    dizer("Maximiano");
    dizer("Não há. É dois lances de escadas."); // ao elevador
    dizer("É uma rua chata para estacionar. Pode dar para parar em frente ou nao.");
    dizer("Depende de como estiver no momento os lugares"); // já com a data perguntada
    dizer("Sim"); // a resposta à pergunta do estacionamento, atrasada
    dizer("2ª feira");
    dizer("O sofa, a caixa que acompanha a chaise e dois bancos."); // à pergunta da factura
    responderAte([
      [/Quer a factura|Deseja fa(c)?tura/, "Sim, pode colocar nif. Mas quero orçamento"],
      [/NIF/, "Mando depois"],
    ]);
    return c;
  }

  it("a primeira mensagem dá a morada, o andar e o sofá — e só se pergunta o nome", () => {
    const { c, dizer } = conversa(AGORA, { fotos: 2 });
    dizer(PRIMEIRA);
    const d = c.estado.dados;
    expect(d.serviceType).toBe("recolha_moveis");
    expect(d.address).toBe("Rua das Gralhas Mansas, N24");
    expect(d.lado).toBe("Esq");
    expect(d.postalCode).toBe("1495-321");
    expect(d.city).toBe("Algés");
    expect(d.floor).toBe("1");
    expect(d.description).toContain("chaise longue");
    expect(d.description).toContain("2,35m");
    expect(c.estado.passo).toBe("nome");
    expect(c.disse[0]).toContain("Boa tarde! Aqui é a Vitória, assistente online da CLYON");
  });

  it("não se lhe pergunta outra vez a morada, o andar nem o que é para levar", () => {
    const tudo = falaComOMaximiano().disse.join("\n");
    expect(tudo).not.toContain("Qual é a morada");
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("Conte-me o que há");
  });

  it("«é uma rua chata» é estacionamento por saber — sem «Responda sim ou não»", () => {
    const c = falaComOMaximiano();
    expect(c.disse.join("\n")).not.toContain("Dá para estacionar à porta? Responda sim ou não.");
  });

  it("o «Sim» atrasado é o do estacionamento, e o «2ª feira» é a data", () => {
    const d = falaComOMaximiano().estado.dados;
    expect(d.parkingDistance).toBe("near");
    expect(d.quandoTexto).toBe("2ª feira");
    // Segunda-feira, 12 de outubro: «2ª feira» passou a ler-se.
    expect(new Date(d.dataDesejada!).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(d.description).not.toContain("2ª feira");
    const r = resumo(d);
    expect(r).not.toContain("Quando: Sim");
    expect(r).toContain("Quando: segunda-feira, 12 de outubro");
  });

  it("os bancos ditos na pergunta da factura entram na descrição", () => {
    const d = falaComOMaximiano().estado.dados;
    expect(d.description).toContain("dois bancos");
    expect(d.precisaFatura).toBe(true);
  });

  it("a pergunta pelo preço tem resposta — e o NIF fica para quando avançar", () => {
    // Desde 13-10-2026 o número não se pede na recolha (o dono).
    const c = falaComOMaximiano();
    const daFactura = c.disse.find((m) => m.includes("Confirme, por favor"));
    expect(daFactura).toBeDefined();
    expect(daFactura).toContain(COMO_CHEGA_O_PRECO);
    expect(c.disse.join("\n")).not.toContain("Qual é o NIF");
    expect(resumo(c.estado.dados)).toContain("Fatura: sim (com IVA de 23%)");
  });

  it("no resumo, «Primeiro quero saber o valor» leva a explicação, e não uma ordem", () => {
    const c = falaComOMaximiano();
    const r = responderNaRecolha(c.estado, "Primeiro quero saber o valor do orçamento", AGORA, true, false, {
      jaExplicouOPreco: true,
    });
    expect(r.registar).toBeFalsy();
    expect(r.resposta).toContain(LEMBRETE_DO_PRECO);
    expect(r.resposta).toContain("responda SIM");
    expect(r.resposta).not.toContain("Para registar responda SIM");
  });

  it("o resumo enviado não cola linhas («estacionar à porta: - Quando: Sim»)", () => {
    const d = { ...falaComOMaximiano().estado.dados, parkingDistance: null };
    const enviado = paraTeclado(resumo(d));
    expect(enviado).toContain("estacionar à porta: a confirmar\n");
    expect(enviado.split("\n").some((l) => l.startsWith("Quando:"))).toBe(true);
  });

  it("o NIF dado de seguida guarda-se — e um NIF a meio não", () => {
    const base: EstadoDaRecolha = { passo: "nif", dados: { serviceType: "recolha_moveis", precisaFatura: true } };
    expect(responderNaRecolha(base, "123 456 789", AGORA, true).estado.dados.nifFactura).toBe("123456789");
    // Desde 13-10-2026 o passo do NIF já não se faz: segue para o que falta.
    const meio = responderNaRecolha(base, "12345678", AGORA, true);
    expect(meio.estado.passo).not.toBe("nif");
    expect(meio.estado.dados.nifFactura).toBeUndefined();
  });

  it("no fim, a quem já mandou fotografias não se pede que as mande", () => {
    expect(mensagemDePedidoRegistado(427, true)).not.toContain("envie-as");
    expect(fotosNoFio([{ direccao: "in", texto: "[fotografia]" }, { direccao: "in", texto: "Olá" }])).toBe(1);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * O ROMÃO — 08-10-2026, 12:05 em Lisboa. «Não percebi o serviço» a quem foi claríssimo.
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do Romão", () => {
  const AGORA = new Date("2026-10-08T12:05:00+01:00"); // 13:05 na captura
  const PRIMEIRA =
    "Quero pedir valores para vagar um apartamento em Moscavide num 4 andar sem elevador.\nÉ um T2 pequeno.\nCumprimentos,\nRomão Ribamar";

  function falaComORomao() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 0 });
    dizer(PRIMEIRA);
    responderAte([
      [/morada/i, "Rua dos Pardais Ruivos 12 -4dto Moscavide"],
      [/código postal/, "1885-321"],
      [/carrinha|estacionar/, "Dá sim"],
      [/Para quando/, "Não há pressa"],
      [/fa(c)?tura/, "Não preciso de factura\nCaso n seja possível, será no meu"],
    ]);
    return c;
  }

  it("«vagar um apartamento» é esvaziar um apartamento — à primeira", () => {
    const c = falaComORomao();
    expect(c.estado.dados.serviceType).toBe("esvaziamento_apartamento");
    expect(c.disse[0]).toContain("Bom dia, Romão!");
    expect(c.disse[0]).toContain("Fica anotado: esvaziamento de apartamento.");
    expect(c.disse.join("\n")).not.toContain("Não percebi o serviço");
  });

  it("o nome da assinatura, o andar e o elevador da primeira frase ficam sabidos", () => {
    const c = falaComORomao();
    const d = c.estado.dados;
    expect(d.contactName).toBe("Romão Ribamar");
    expect(d.floor).toBe("4");
    expect(d.hasElevator).toBe("no");
    const tudo = c.disse.join("\n");
    expect(tudo).not.toMatch(/Com quem (estou a falar|tenho o gosto)/);
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("Há elevador");
  });

  it("com «Moscavide» já dito, pede-se só o código postal", () => {
    const c = falaComORomao();
    expect(c.disse.some((m) => m.endsWith("E o código postal?"))).toBe(true);
    expect(c.estado.dados.city).toBe("Moscavide");
    expect(c.estado.dados.postalCode).toBe("1885-321");
  });

  it("e chega ao resumo com metade das perguntas", () => {
    const c = falaComORomao();
    expect(c.estado.passo).toBe("confirmar");
    expect(c.disse.length).toBeLessThanOrEqual(6);
    expect(resumo(c.estado.dados)).toContain("Andar: 4 Dto · elevador: não · estacionar à porta: sim");
    // «Rua dos Pardais Ruivos 12 -4dto» não é o 12 de abril (26-10-2026).
    expect(c.estado.dados.quandoTexto).toBe("sem pressa");
  });

  it("«Retirar mobiliário de um apartamento» também se percebe", () => {
    expect(servicoDoTexto("Retirar mobiliário de um apartamento")).toBe("esvaziamento_apartamento");
    expect(servicoDoTexto("tenho mobília para levar")).toBe("recolha_moveis");
  });
});

describe("o que se lê do fio", () => {
  it("já se explicou o preço?", () => {
    expect(jaExplicouOPreco([{ direccao: "out", texto: paraTeclado(COMO_CHEGA_O_PRECO) }])).toBe(true);
    expect(jaExplicouOPreco([{ direccao: "in", texto: "quanto custa?" }])).toBe(false);
  });
});
