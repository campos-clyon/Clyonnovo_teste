import { describe, it, expect } from "vitest";
import {
  andarDoTexto,
  estaNaRua,
  factosSoltos,
  fundirCampos,
  recolhaNova,
  responderNaRecolha,
  servicoDoTexto,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";

/**
 * A CONVERSA DO DAVID — 06-10-2026, «use essa conversa para melhorar o
 * assistente».
 *
 * Mandou uma fotografia de 22 big bags à porta e escreveu: «Olá! Gostava de
 * pedir um orçamento à CLYON. Recolha de 22 bigbags de 1T na zona da Baixa
 * da Banheira». O Gemini estava em baixo e a recolha seguiu pelo caminho das
 * expressões regulares — e ele teve de escrever os big bags três vezes,
 * dizer que estava tudo na rua duas, e ouviu perguntar pelo elevador e pelo
 * estacionamento depois de ter dito «Local é na rua, pelo que não precisa de
 * elevador. Tem estacionamento no local».
 *
 * Aqui ele volta a escrever o mesmo, mas responde ao que lhe perguntam — é
 * assim que se vê o que o assistente pergunta de novo.
 */

const AGORA = new Date("2026-10-06T12:44:00+01:00");

/** O que o David responde a cada pergunta, com as palavras dele. */
const RESPOSTAS_DO_DAVID: Array<[RegExp, string]> = [
  [/Com quem estou a falar/, "David"],
  [/morada|rua e do número/i, "Rua António Aleixo 18\n2835-061 Baixa da Banheira"],
  [/código postal/, "2835-061 Baixa da Banheira"],
  [/Em que andar/, "NA RUA"],
  [/elevador/, "o entulho encontra-se na rua"],
  [/encostar a carrinha|estacionar/, "dá"],
  [/quanto entulho/, "22 BIG BAGS"],
  [/Para quando/, "esta semana"],
  [/Conte-me o que há/, "levar 22 bigbags com entulho"],
  // Desde 10-10-2026 quem quer o NIF na factura é perguntado por ele.
  [/Qual é o NIF|ler o NIF/, "Mando depois"],
  [/factura/, "Sim"],
];

function falaComODavid() {
  const perguntas: string[] = [];
  let estado: EstadoDaRecolha = recolhaNova();
  const dizer = (texto: string, jaCumprimentou: boolean) => {
    const r = responderNaRecolha(estado, texto, AGORA, jaCumprimentou);
    estado = r.estado;
    perguntas.push(r.resposta);
    return r;
  };

  // O que ele escreveu antes de qualquer pergunta.
  dizer(
    "Olá! Gostava de pedir um orçamento à CLYON.\n\n\nRecolha de 22 bigbags de 1T na zona da Baixa da Banheira",
    false,
  );
  dizer("David", true);
  dizer("Local é na rua, pelo que não precisa de elevador. Tem estacionamento no local", true);

  // Daqui para a frente responde ao que lhe perguntam.
  for (let volta = 0; volta < 15 && estado.passo !== "confirmar"; volta++) {
    const pergunta = perguntas[perguntas.length - 1];
    const resposta = RESPOSTAS_DO_DAVID.find(([re]) => re.test(pergunta))?.[1];
    if (!resposta) throw new Error(`O David não sabe responder a: ${pergunta}`);
    dizer(resposta, true);
  }
  return { estado, perguntas };
}

describe("a conversa do David", () => {
  it("a primeira mensagem já diz o serviço: big bags são entulho", () => {
    const { perguntas } = falaComODavid();
    expect(perguntas[0]).toContain("Recolha de entulho — certo.");
  });

  it("a frase sobre o acesso fica anotada, e não passa a ser a morada", () => {
    const { estado, perguntas } = falaComODavid();
    expect(perguntas[2]).toMatch(/^Fica anotado\. Preciso da rua e do número/);
    expect(estado.dados.address).toBe("Rua António Aleixo 18");
    expect(estado.dados.postalCode).toBe("2835-061");
    expect(estado.dados.city).toBe("Baixa da Banheira");
  });

  it("não volta a perguntar o que ele já disse", () => {
    const { perguntas } = falaComODavid();
    const tudo = perguntas.join("\n");
    expect(tudo).not.toContain("Em que andar é?");
    expect(tudo).not.toContain("Há elevador");
    expect(tudo).not.toContain("encostar a carrinha");
    // Num entulho, a quantidade é a descrição.
    expect(tudo).not.toContain("Conte-me o que há para levar");
    // E desde 10-10-2026 os «22 bigbags» da primeira mensagem já são a
    // quantidade: não se pergunta nenhuma vez.
    expect(tudo).not.toContain("quanto entulho");
  });

  it("e acaba no resumo, com o que ele disse", () => {
    const { estado, perguntas } = falaComODavid();
    expect(estado.passo).toBe("confirmar");
    const resumo = perguntas[perguntas.length - 1];
    expect(resumo).toContain("Serviço: Recolha de entulho");
    expect(resumo).toContain("Nome: David");
    // Num r/c o elevador não interessa, e o resumo não o lista (10-10-2026).
    expect(resumo).toContain("Andar: r/c · estacionar à porta: sim");
    expect(resumo).toContain("Entulho: 22 bigbags");
    // A descrição é a frase dele, com o «de 1T» que a quantidade não diz.
    expect(resumo).toContain("Descrição: Recolha de 22 bigbags de 1T");
    // Oito mensagens da CLYON até ao resumo — eram treze na conversa dele.
    expect(perguntas.length).toBeLessThanOrEqual(8);
  });
});

describe("as leituras que a conversa dele pediu", () => {
  it("big bags, em todas as grafias, são entulho", () => {
    for (const t of ["22 bigbags", "3 big bags de entulho", "um big-bag", "bigbag de 1T", "caliça"]) {
      expect(servicoDoTexto(t), t).toBe("recolha_entulho");
    }
    // E a recolha de um sofá continua a ser de móveis.
    expect(servicoDoTexto("recolha de um sofá")).toBe("recolha_moveis");
  });

  it("«na rua» é um lugar, e nunca o princípio de uma morada", () => {
    for (const t of [
      "NA RUA",
      "o entulho encontra-se na rua",
      "Local é na rua, pelo que não precisa de elevador",
      "está tudo na rua à porta",
      "cá fora, no passeio",
    ]) {
      expect(estaNaRua(t), t).toBe(true);
    }
    for (const t of ["Moro na Rua António Aleixo 18", "Rua da Paz 3", "na rua de baixo", "Avenida da Liberdade"]) {
      expect(estaNaRua(t), t).toBe(false);
    }
  });

  it("o andar «na rua» é o rés-do-chão, mas um número dito vale mais", () => {
    expect(andarDoTexto("NA RUA")).toBe("0");
    expect(andarDoTexto("rua")).toBe("0");
    expect(andarDoTexto("2º andar, mas o entulho está na rua")).toBe("2");
  });

  it("o acesso dito de passagem lê-se inteiro", () => {
    expect(
      factosSoltos("Local é na rua, pelo que não precisa de elevador. Tem estacionamento no local"),
    ).toEqual({ floor: "0", hasElevator: "no", parkingDistance: "near" });
    expect(factosSoltos("3º andar sem elevador e é difícil estacionar")).toEqual({
      hasElevator: "no",
      parkingDistance: "far",
    });
    expect(factosSoltos("o prédio tem elevador")).toEqual({ hasElevator: "yes" });
    expect(factosSoltos("não tem elevador")).toEqual({ hasElevator: "no" });
    expect(factosSoltos("um sofá e um colchão")).toEqual({});
  });

  it("uma frase de passagem nunca desdiz uma resposta já dada", () => {
    const estado: EstadoDaRecolha = {
      passo: "quando",
      dados: { serviceType: "recolha_moveis", floor: "3", hasElevator: "yes", parkingDistance: "far" },
    };
    const r = responderNaRecolha(estado, "amanhã, está tudo na rua", AGORA, true);
    expect(r.estado.dados.floor).toBe("3");
    expect(r.estado.dados.hasElevator).toBe("yes");
    expect(r.estado.dados.parkingDistance).toBe("far");
  });

  it("pelo Gemini também: o andar na rua dispensa o elevador", () => {
    const d = fundirCampos({}, { andar: "na rua" } as never, AGORA);
    expect(d.floor).toBe("0");
    expect(d.hasElevator).toBe("no");
    const e = fundirCampos({}, { elevador: "não é preciso, está tudo na rua" } as never, AGORA);
    expect(e.hasElevator).toBe("no");
  });
});
