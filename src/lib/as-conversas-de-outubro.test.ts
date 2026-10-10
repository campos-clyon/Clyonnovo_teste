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
 * *«Melhore nosso assistente para ele não cometer esses erros.»* — o dono,
 * com as capturas de três conversas inteiras. Nas três respondeu o caminho
 * sem Gemini (o modelo estava a falhar e ninguém o via), e é esse que aqui se
 * ensaia: `responderNaRecolha`, com as palavras verdadeiras dos clientes.
 *
 * Como na conversa do David, cada cliente escreve primeiro o que escreveu de
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
 * O MARCO — 10-10-2026, 11:35 em Lisboa. Desistiu: «está muito complicado».
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do Marco", () => {
  // As capturas do WhatsApp do dono estão uma hora à frente de Lisboa: 12:35 lá são 11:35 cá.
  const AGORA = new Date("2026-10-10T11:35:00+01:00");
  // A mensagem reencaminhada aparece cortada na captura («esses são os mo…»).
  const PRIMEIRA = "Anderson, conforme falamos esses são os móveis.\nO local é Ajuda/Lisboa.";

  function falaComOMarco() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 18 });
    dizer(PRIMEIRA);
    dizer("Obrigado Marco");
    responderAte([
      [/morada/i, "Travessa João Alves, 7, R/C Esq.\n1300-316 Lisboa"],
      [/Com quem estou a falar/, "Sou o Marco"],
      [/carrinha|estacionar/, "Sim"],
      [/Para quando/, "O mais breve possível"],
      [/factura/, "Não é necessário"],
    ]);
    return c;
  }

  it("«Obrigado Marco» é o Marco — e não «Obrigado Marco»", () => {
    const c = falaComOMarco();
    expect(c.estado.dados.contactName).toBe("Marco");
    expect(resumo(c.estado.dados)).toContain("Nome: Marco\n");
  });

  it("a morada sai partida, sem a rua duas vezes", () => {
    const d = falaComOMarco().estado.dados;
    expect(d.address).toBe("Travessa João Alves, 7, R/C Esq");
    expect(d.postalCode).toBe("1300-316");
    expect(d.city).toBe("Lisboa");
    // Era «…R/C Esq., 1300-316, Travessa João Alves 7 R/C Esq. Lisboa».
    expect(resumo(d).match(/Travessa João Alves/g)).toHaveLength(1);
  });

  it("o «R/C Esq.» da morada é o andar — e num r/c o elevador não se pergunta", () => {
    const c = falaComOMarco();
    expect(c.estado.dados.floor).toBe("0");
    const tudo = c.disse.join("\n");
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("elevador");
    expect(resumo(c.estado.dados)).toContain("Andar: r/c · estacionar à porta: sim");
  });

  it("com dezoito fotografias, não se lhe pede que conte o que há para levar", () => {
    const c = falaComOMarco();
    expect(c.disse.join("\n")).not.toContain("Conte-me o que há");
    expect(c.estado.dados.description).toContain("móveis");
  });

  it("chega ao resumo com cinco perguntas, e não com onze", () => {
    const c = falaComOMarco();
    expect(c.estado.passo).toBe("confirmar");
    // Duas da primeira mensagem e do nome, e as que ele respondeu.
    expect(c.disse.length).toBeLessThanOrEqual(7);
  });

  it("a primeira resposta cumprimenta-o pelo nome quando ele o diz logo", () => {
    const { c, dizer } = conversa(AGORA, { fotos: 18 });
    dizer(`${PRIMEIRA}\nObrigado Marco`);
    expect(c.disse[0]).toContain("Bom dia, Marco.");
    expect(c.disse[0]).toContain("Recolha de móveis — certo.");
    expect(c.disse[0]).toContain("Qual é a morada?");
  });

  it("«Sou o Marco», dito tarde, é o nome — e nunca o andar", () => {
    // O passo em que ele estava na conversa verdadeira: a pergunta do andar.
    const r = responderNaRecolha(
      { passo: "andar", dados: { serviceType: "recolha_moveis", contactName: "Obrigado Marco", address: "Travessa João Alves" } },
      "Sou o Marco",
      AGORA,
      true,
    );
    expect(r.estado.dados.contactName).toBe("Marco");
    expect(r.estado.dados.floor).toBeUndefined();
    expect(r.estado.passo).toBe("andar");
    expect(r.resposta).toContain("Obrigado, Marco.");
  });

  it("«Como está escrito acima é R/C» responde à pergunta do elevador", () => {
    const r = responderNaRecolha(
      { passo: "elevador", dados: { serviceType: "recolha_moveis", contactName: "Marco", address: "Travessa João Alves, 7" } },
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
      { passo: "descricao", dados: { serviceType: "recolha_moveis", contactName: "Marco" } },
      "Já mandei as fotos.",
      AGORA,
      true,
    );
    expect(r.estado.dados.description).toBe(DESCRICAO_DAS_FOTOS);
  });

  it("quem desiste não leva «Para registar responda SIM» — passa a uma pessoa", () => {
    const c = falaComOMarco();
    const r = responderNaRecolha(c.estado, "Obrigado, está muito complicado. Prefiro desistir.", AGORA, true);
    expect(r.pedirPessoa).toBe(true);
    expect(r.desistir).toBeFalsy(); // não se apaga o que ele já disse
    expect(r.resposta).toContain("peço desculpa");
    expect(r.resposta).not.toContain("responda SIM");
    expect(r.motivoDaEntrega).toMatch(/desistiu/i);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * O CRISTIANO — 09-10-2026, 16:31 em Lisboa. Tinha dito tudo na primeira mensagem.
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do Cristiano", () => {
  const AGORA = new Date("2026-10-09T16:31:00+01:00"); // 17:31 na captura
  const PRIMEIRA =
    "Olá! Gostava de pedir um orçamento à CLYON.\n\nAqui está o sofá.\nTirei duas fotos porque é um sofa com chaise longue, contudo a parte da chaise é separada da estrutura principal.\n\nA morada é Rua Rodrigues de Freitas, N18, 1°esq. 1495-116 Algés\n\nAs medidas 2,35m (comprimento) x 0,89m (largura) x 0,68 m (altura)";

  function falaComOCristiano() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 2 });
    dizer(PRIMEIRA);
    dizer("Cristiano");
    dizer("Não há. É dois lances de escadas."); // ao elevador
    dizer("É uma rua chata para estacionar. Pode dar para parar em frente ou nao.");
    dizer("Depende de como estiver no momento os lugares"); // já com a data perguntada
    dizer("Sim"); // a resposta à pergunta do estacionamento, atrasada
    dizer("2ª feira");
    dizer("O sofa, a caixa que acompanha a chaise e dois bancos."); // à pergunta da factura
    responderAte([
      [/Quer a factura/, "Sim, pode colocar nif. Mas quero orçamento"],
      [/NIF/, "Mando depois"],
    ]);
    return c;
  }

  it("a primeira mensagem dá a morada, o andar e o sofá — e só se pergunta o nome", () => {
    const { c, dizer } = conversa(AGORA, { fotos: 2 });
    dizer(PRIMEIRA);
    const d = c.estado.dados;
    expect(d.serviceType).toBe("recolha_moveis");
    expect(d.address).toBe("Rua Rodrigues de Freitas, N18, 1°esq");
    expect(d.postalCode).toBe("1495-116");
    expect(d.city).toBe("Algés");
    expect(d.floor).toBe("1");
    expect(d.description).toContain("chaise longue");
    expect(d.description).toContain("2,35m");
    expect(c.estado.passo).toBe("nome");
    expect(c.disse[0]).toContain("Boa tarde. Aqui é a CLYON.");
  });

  it("não se lhe pergunta outra vez a morada, o andar nem o que é para levar", () => {
    const tudo = falaComOCristiano().disse.join("\n");
    expect(tudo).not.toContain("Qual é a morada");
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("Conte-me o que há");
  });

  it("«é uma rua chata» é estacionamento por saber — sem «Responda sim ou não»", () => {
    const c = falaComOCristiano();
    expect(c.disse.join("\n")).not.toContain("Dá para estacionar à porta? Responda sim ou não.");
  });

  it("o «Sim» atrasado é o do estacionamento, e o «2ª feira» é a data", () => {
    const d = falaComOCristiano().estado.dados;
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
    const d = falaComOCristiano().estado.dados;
    expect(d.description).toContain("dois bancos");
    expect(d.precisaFatura).toBe(true);
  });

  it("a pergunta pelo preço tem resposta — e o NIF pede-se", () => {
    const c = falaComOCristiano();
    const daFactura = c.disse.find((m) => m.includes("Qual é o NIF"));
    expect(daFactura).toBeDefined();
    expect(daFactura).toContain(COMO_CHEGA_O_PRECO);
    expect(resumo(c.estado.dados)).toContain("NIF na factura: sim, a dar depois");
  });

  it("no resumo, «Primeiro quero saber o valor» leva a explicação, e não uma ordem", () => {
    const c = falaComOCristiano();
    const r = responderNaRecolha(c.estado, "Primeiro quero saber o valor do orçamento", AGORA, true, false, {
      jaExplicouOPreco: true,
    });
    expect(r.registar).toBeFalsy();
    expect(r.resposta).toContain(LEMBRETE_DO_PRECO);
    expect(r.resposta).toContain("responda SIM");
    expect(r.resposta).not.toContain("Para registar responda SIM");
  });

  it("o resumo enviado não cola linhas («estacionar à porta: - Quando: Sim»)", () => {
    const d = { ...falaComOCristiano().estado.dados, parkingDistance: null };
    const enviado = paraTeclado(resumo(d));
    expect(enviado).toContain("estacionar à porta: a confirmar\n");
    expect(enviado.split("\n").some((l) => l.startsWith("Quando:"))).toBe(true);
  });

  it("o NIF dado de seguida guarda-se — e um NIF a meio não", () => {
    const base: EstadoDaRecolha = { passo: "nif", dados: { serviceType: "recolha_moveis", precisaFatura: true } };
    expect(responderNaRecolha(base, "123 456 789", AGORA, true).estado.dados.nifFactura).toBe("123456789");
    const meio = responderNaRecolha(base, "12345678", AGORA, true);
    expect(meio.estado.passo).toBe("nif");
    expect(meio.estado.dados.nifFactura).toBeUndefined();
  });

  it("no fim, a quem já mandou fotografias não se pede que as mande", () => {
    expect(mensagemDePedidoRegistado(427, true)).not.toContain("envie-as");
    expect(fotosNoFio([{ direccao: "in", texto: "[fotografia]" }, { direccao: "in", texto: "Olá" }])).toBe(1);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * O JOÃO — 08-10-2026, 12:15 em Lisboa. «Não percebi o serviço» a quem foi claríssimo.
 * ────────────────────────────────────────────────────────────────────────── */

describe("a conversa do João", () => {
  const AGORA = new Date("2026-10-08T12:15:00+01:00"); // 13:15 na captura
  const PRIMEIRA =
    "Quero pedir valores para vagar um apartamento em Moscavide num 4 andar sem elevador.\nÉ um T2 pequeno.\nCumprimentos,\nJoão Rodrigues";

  function falaComOJoao() {
    const { c, dizer, responderAte } = conversa(AGORA, { fotos: 0 });
    dizer(PRIMEIRA);
    responderAte([
      [/morada/i, "Rua João Gomes patacão 7 -4dto Moscavide"],
      [/código postal/, "1885-007"],
      [/carrinha|estacionar/, "Dá sim"],
      [/Para quando/, "Não há pressa"],
      [/factura/, "Não preciso de factura\nCaso n seja possível, será no meu"],
    ]);
    return c;
  }

  it("«vagar um apartamento» é esvaziar um apartamento — à primeira", () => {
    const c = falaComOJoao();
    expect(c.estado.dados.serviceType).toBe("esvaziamento_apartamento");
    expect(c.disse[0]).toContain("Bom dia, João.");
    expect(c.disse[0]).toContain("Esvaziamento de apartamento — certo.");
    expect(c.disse.join("\n")).not.toContain("Não percebi o serviço");
  });

  it("o nome da assinatura, o andar e o elevador da primeira frase ficam sabidos", () => {
    const c = falaComOJoao();
    const d = c.estado.dados;
    expect(d.contactName).toBe("João Rodrigues");
    expect(d.floor).toBe("4");
    expect(d.hasElevator).toBe("no");
    const tudo = c.disse.join("\n");
    expect(tudo).not.toContain("Com quem estou a falar");
    expect(tudo).not.toContain("Em que andar");
    expect(tudo).not.toContain("Há elevador");
  });

  it("com «Moscavide» já dito, pede-se só o código postal", () => {
    const c = falaComOJoao();
    expect(c.disse.some((m) => m.endsWith("E o código postal?"))).toBe(true);
    expect(c.estado.dados.city).toBe("Moscavide");
    expect(c.estado.dados.postalCode).toBe("1885-007");
  });

  it("e chega ao resumo com metade das perguntas", () => {
    const c = falaComOJoao();
    expect(c.estado.passo).toBe("confirmar");
    expect(c.disse.length).toBeLessThanOrEqual(6);
    expect(resumo(c.estado.dados)).toContain("Andar: 4 · elevador: não · estacionar à porta: sim");
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
