import { describe, it, expect } from "vitest";
import {
  recolhaNova,
  responderComCompreensao,
  primeiroPassoEmFalta,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";

/**
 * O assistente depois de o Gemini ler a mensagem.
 *
 * "quero ele mais inteligente sem números, ele deve entender textos
 * complexos" — 10-09-2026.
 *
 * O Gemini não entra aqui: o que se testa é o que se faz com o que ele
 * devolve. É por isso que a compreensão e a decisão estão em ficheiros
 * separados — esta metade é pura e prova-se sem rede nenhuma.
 */

const T0 = new Date("2026-09-09T10:00:00"); // quarta-feira

describe("uma frase que diz várias coisas de uma vez", () => {
  const r = responderComCompreensao(
    recolhaNova(),
    {
      intencao: "informar",
      campos: {
        servico: "recolha_moveis",
        descricao: "um sofá de 3 lugares e um colchão",
        codigoPostal: "2750-642 Cascais",
        andar: "3º",
        elevador: "não",
        quando: "sexta de manhã",
      },
    },
    T0,
  );

  it("guarda tudo o que foi dito, de uma só vez", () => {
    expect(r.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r.estado.dados.postalCode).toBe("2750-642");
    expect(r.estado.dados.city).toBe("Cascais");
    expect(r.estado.dados.floor).toBe("3");
    expect(r.estado.dados.hasElevator).toBe("no");
    expect(r.estado.dados.description).toContain("sofá");
  });

  it("interpreta a data pelo caminho de sempre", () => {
    expect(r.estado.dados.dataDesejada).toContain("2026-09-11"); // a sexta seguinte
  });

  it("salta para o primeiro campo que ainda falta — o nome", () => {
    expect(r.estado.passo).toBe("nome");
    expect(r.resposta).toContain("chama");
  });

  it("não pergunta pelo número de nenhuma lista", () => {
    expect(r.resposta).not.toContain("1. Recolha de móveis");
  });
});

describe("o que o Gemini inventar não passa", () => {
  it("um serviço que não existe é deitado fora", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { servico: "lavar_o_carro" } },
      T0,
    );
    expect(r.estado.dados.serviceType).toBeUndefined();
    expect(r.estado.passo).toBe("servico");
  });

  it("um código postal mal formado não fica gravado", () => {
    const r = responderComCompreensao(
      { passo: "codigoPostal", dados: { serviceType: "recolha_moveis", contactName: "Ana", address: "Rua A 1" } },
      { intencao: "informar", campos: { codigoPostal: "27506" } },
      T0,
    );
    expect(r.estado.dados.postalCode).toBeUndefined();
    expect(r.estado.passo).toBe("codigoPostal");
  });
});

describe("o SIM só regista com tudo preenchido", () => {
  const quaseTudo: EstadoDaRecolha = {
    passo: "confirmar",
    dados: {
      serviceType: "recolha_moveis",
      contactName: "Ana",
      address: "Rua A 1",
      postalCode: "2750-642",
      city: "Cascais",
      floor: "3",
      hasElevator: "no",
      parkingDistance: "near",
      quandoTexto: "sexta de manhã",
      description: "um sofá",
      precisaFatura: false,
    },
  };

  it("com tudo lá, o sim regista", () => {
    const r = responderComCompreensao(quaseTudo, { intencao: "confirmar", campos: {} }, T0);
    expect(r.registar).toBe(true);
  });

  it("com um campo por responder, o sim é conversa e não confirmação", () => {
    const semNome: EstadoDaRecolha = {
      passo: "confirmar",
      dados: { ...quaseTudo.dados, contactName: undefined },
    };
    const r = responderComCompreensao(semNome, { intencao: "confirmar", campos: {} }, T0);
    expect(r.registar).toBeUndefined();
    expect(r.estado.passo).toBe("nome");
  });
});

describe("as intenções que fecham a conversa", () => {
  it("pedir uma pessoa entrega a conversa", () => {
    const r = responderComCompreensao(recolhaNova(), { intencao: "falar_com_pessoa", campos: {} }, T0);
    expect(r.pedirPessoa).toBe(true);
  });

  it("desistir apaga a recolha", () => {
    const r = responderComCompreensao(recolhaNova(), { intencao: "cancelar", campos: {} }, T0);
    expect(r.desistir).toBe(true);
  });
});

describe("quando a mensagem não trouxe dados nenhuns", () => {
  it("não se repete a saudação inteira", () => {
    const r = responderComCompreensao(recolhaNova(), { intencao: "informar", campos: {} }, T0);
    expect(r.resposta).not.toContain("Sou o assistente da CLYON");
  });

  it("no primeiro passo acolhe-se, não se diz que não se percebeu", () => {
    // «Olá, gostaria de pedir um orçamento» percebe-se muito bem — só não diz
    // o que é para levar.
    const r = responderComCompreensao(recolhaNova(), { intencao: "informar", campos: {} }, T0);
    expect(r.resposta).not.toContain("não apanhei");
    expect(r.resposta).toContain("Diga-me o que precisa");
  });

  it("mais à frente, onde a pergunta era concreta, admite-se", () => {
    const r = responderComCompreensao(
      { passo: "nome", dados: { serviceType: "recolha_moveis" } },
      { intencao: "informar", campos: {} },
      T0,
    );
    expect(r.resposta).toContain("não apanhei");
  });
});

describe("primeiroPassoEmFalta", () => {
  it("num pedido vazio, o serviço", () => {
    expect(primeiroPassoEmFalta({})).toBe("servico");
  });

  it("numa mudança, o destino entra na ordem", () => {
    expect(
      primeiroPassoEmFalta({
        serviceType: "mudanca",
        contactName: "Ana",
        address: "Rua A 1",
        postalCode: "2750-642",
        city: "Cascais",
      }),
    ).toBe("moradaDestino");
  });

  it("o «não sei» do estacionamento é uma resposta, não uma falta", () => {
    const passo = primeiroPassoEmFalta({
      serviceType: "recolha_moveis",
      contactName: "Ana",
      address: "Rua A 1",
      postalCode: "2750-642",
      city: "Cascais",
      floor: "3",
      hasElevator: "no",
      parkingDistance: null,
    });
    expect(passo).toBe("quando");
  });
});
