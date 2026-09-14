import { describe, it, expect } from "vitest";
import {
  aberturaDaResposta,
  comoTratar,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
  resumo,
  saudacao,
  type DadosDaRecolha,
  type PassoDaRecolha,
} from "./whatsapp-recolha";

/**
 * O ASSISTENTE TEM MODOS.
 *
 * "O assistente respondeu sem bom dia e sem dizer o nome dela (...) e dá
 * muitos exemplos desnecessários." — 14-09-2026.
 *
 * A Sónia Agostinho escreveu, às 12:02:
 *
 *   «Bom dia. Tenho uma mesa grande, 5 cadeiras e uma cadeira de escritório,
 *    e dois sacos de coisas que precisava que viessem buscar. Posso enviar
 *    fotos se for necessário. Obrigada. Com os melhores cumprimentos.
 *    Sónia Agostinho»
 *
 * E levou de volta, seca: «Qual é a morada certa? Rua e número — é por aí que
 * o profissional se orienta (ex.: Rua Sousa Viterbo 29).»
 *
 * Duas coisas erradas na mesma frase. Não devolveu o bom dia nem usou o nome
 * que ela tinha assinado — e que o assistente até já tinha lido, porque o pôs
 * no resumo seis mensagens depois. E deu-lhe uma morada de exemplo que ela não
 * pediu, para uma pergunta que se percebe sem exemplo nenhum.
 */

const MANHA = new Date("2026-09-14T10:00:00");
const TARDE = new Date("2026-09-14T15:00:00");

/* A primeira mensagem dela, como o Gemini a devolve depois de a ler. */
const CAMPOS_DA_SONIA = {
  servico: "recolha_moveis",
  nome: "Sónia Agostinho",
  descricao: "uma mesa grande, 5 cadeiras e uma cadeira de escritório, e dois sacos de coisas",
};

describe("responder a quem cumprimentou", () => {
  const r = responderComCompreensao(
    recolhaNova(),
    { intencao: "informar", campos: CAMPOS_DA_SONIA },
    MANHA,
  );

  it("devolve o bom dia, e trata-a pelo nome que ela assinou", () => {
    expect(r.resposta.startsWith("Bom dia, Sónia.")).toBe(true);
  });

  it("diz quem está do outro lado", () => {
    // Ela escreveu para um número que não conhece. Saber com quem fala é a
    // primeira coisa que uma pessoa quer, e custa quatro palavras.
    expect(r.resposta).toContain("Aqui é a CLYON");
  });

  it("e a pergunta vem a seguir, não em vez do cumprimento", () => {
    expect(r.resposta).toContain(perguntaDo(r.estado.passo, r.estado.dados, false));
  });

  it("NUNCA «Sr.» nem «Sra.»", () => {
    /*
     * O exemplo que o dono deu dizia «Bom dia senhora Sónia». Vai só o nome
     * próprio, e a razão é a mesma que o assistente automático já tinha
     * escrito: a base guarda o nome e NÃO guarda o género. Acerta na Sónia e
     * falha no Alex, na Andrea e em toda a gente com nome estrangeiro — e um
     * «senhor» dito a uma senhora estraga a mensagem inteira.
     */
    expect(r.resposta).not.toMatch(/\bSra?\.\s/);
    expect(r.resposta).not.toMatch(/\bsenhor[ae]?\b/i);
  });
});

describe("o bom dia diz-se uma vez", () => {
  it("a segunda mensagem já não é cumprimentada", () => {
    // Um «Bom dia, Sónia» a cada balão é pior do que nenhum: é o que faz uma
    // conversa parecer uma máquina a reiniciar.
    const segunda = responderComCompreensao(
      { passo: "morada", dados: { serviceType: "recolha_moveis", contactName: "Sónia Agostinho" } },
      { intencao: "informar", campos: { morada: "Rua actriz palmira bastos 8" } },
      MANHA,
    );
    expect(segunda.resposta.startsWith("Bom dia")).toBe(false);
    expect(segunda.resposta).not.toContain("Aqui é a CLYON");
  });

  it("e não se diz duas vezes quando a pergunta já o traz dentro", () => {
    /*
     * Quem escreve «olá?» e mais nada leva a pergunta do serviço, que abre com
     * «Bom dia! Aqui é a CLYON». Pôr outro por cima dava dois seguidos.
     */
    expect(aberturaDaResposta({}, "servico", "servico", MANHA)).toBe("");
  });

  it("a saudação segue a hora, e não uma frase fixa", () => {
    expect(aberturaDaResposta({ contactName: "Ana" }, "servico", "morada", TARDE)).toContain(
      "Boa tarde, Ana.",
    );
    expect(comoTratar("Ana Maria Silva", TARDE)).toBe(`${saudacao(TARDE)}, Ana.`);
  });

  it("sem nome, cumprimenta na mesma", () => {
    // Não saber o nome não é razão para não dizer bom dia.
    const so = aberturaDaResposta({}, "servico", "nome", MANHA);
    expect(so).toContain("Bom dia.");
    expect(so).toContain("Aqui é a CLYON");
  });
});

describe("os exemplos desnecessários", () => {
  const PASSOS: PassoDaRecolha[] = [
    "servico",
    "nome",
    "morada",
    "codigoPostal",
    "moradaDestino",
    "codigoPostalDestino",
    "andar",
    "elevador",
    "estacionamento",
    "entulhoQuantidade",
    "quando",
    "descricao",
    "fatura",
  ];

  for (const passo of PASSOS) {
    it(`«${passo}» não dá exemplos`, () => {
      /*
       * Uma pergunta que precisa de exemplo é uma pergunta mal feita. E o
       * exemplo custa duas vezes: enche a mensagem, e faz a pessoa responder
       * no formato do exemplo em vez de dizer o que sabe.
       */
      const dados: DadosDaRecolha = { serviceType: "recolha_moveis" };
      const texto = perguntaDo(passo, dados, false);
      expect(texto).not.toContain("ex.:");
      expect(texto).not.toContain("Por exemplo");
    });
  }

  it("a morada deixou de sugerir uma rua", () => {
    // Foi a que ele apontou: «ele não devia dar ex. de rua».
    expect(perguntaDo("morada", {}, false)).not.toContain("Sousa Viterbo");
  });

  it("o resumo pede confirmação sem ensinar sintaxe", () => {
    /*
     * Dizia «Para corrigir, escreva o campo e o valor novo (ex.: "morada Rua
     * Nova 5", "nome Ana Silva")». Duas linhas a ensinar uma linguagem à
     * pessoa — quando quem lê a resposta dela percebe português.
     */
    const texto = resumo({ serviceType: "recolha_moveis", contactName: "Sónia Agostinho" });
    expect(texto).toContain("Responda SIM para registar");
    expect(texto).not.toContain("ex.:");
    expect(texto).not.toContain("Rua Nova 5");
    expect(texto).not.toContain("Ana Silva");
  });
});

describe("a regra do tratamento vive num sítio só", () => {
  it("o assistente automático usa a MESMA função da recolha", async () => {
    /*
     * Estavam a ser duas cópias. Duas cópias de uma regra de tratamento acabam
     * sempre com a mesma pessoa a ser tratada de duas maneiras pelo mesmo
     * sistema — e a que ninguém corrige é a que ninguém está a ver.
     */
    const auto = await import("./assistente-automatico");
    expect(auto.comoTratar).toBe(comoTratar);
  });
});
