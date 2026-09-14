import { describe, it, expect } from "vitest";
import { recolhaNova, responderNaRecolha, type EstadoDaRecolha } from "./whatsapp-recolha";

/**
 * CADA COISA NA SUA GAVETA.
 *
 * "Mais uma vez ele repetiu info e obrigou o cliente a falar o que já tinha
 * dito." — 14-09-2026, sobre a conversa da Ana Filipa Rodrigues.
 *
 * Às 16:07 ela escreveu «Morada: Estrada do Paço do Lumiar, n65, 6D,
 * 1600-544 Lisboa». A pergunta pendente era «Com quem estou a falar?». O
 * resumo que lhe foi mostrado dizia, à letra:
 *
 *   Nome: Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa
 *   Morada: É um apartamento e tem elevador, O meu nome é Ana Filipa Rodrigues
 *   Andar: 65
 *
 * A causa não era não perceber. Era perguntar, e depois arrumar a mensagem
 * SEGUINTE na gaveta da pergunta — fosse ela qual fosse. Num WhatsApp ninguém
 * responde por ordem: responde-se à terceira pergunta atrás, com o nome do
 * campo escrito à frente, como ela fez seis vezes.
 */

const AGORA = new Date("2026-09-14T16:07:00");

/** A conversa como ela correu: o estado passa de mensagem para mensagem. */
function conversa(mensagens: string[], inicio: EstadoDaRecolha = recolhaNova()) {
  let estado = inicio;
  const respostas: string[] = [];
  for (const m of mensagens) {
    const r = responderNaRecolha(estado, m, AGORA);
    estado = r.estado;
    respostas.push(r.resposta);
  }
  return { estado, respostas };
}

describe("a morada dela não pode virar o nome dela", () => {
  it("«Morada: …» vai para a morada, mesmo perguntando-se o nome", () => {
    const { estado } = conversa([
      "recolha de móveis",
      "Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa",
    ]);
    expect(estado.dados.contactName).toBeUndefined();
    expect(estado.dados.address).toContain("Estrada do Paço do Lumiar");
    // E o código postal vem no mesmo saco, sem se voltar a perguntar.
    expect(estado.dados.postalCode).toBe("1600-544");
  });

  it("e a seguir «Nome é …» vai para o nome", () => {
    const { estado } = conversa([
      "recolha de móveis",
      "Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa",
      "Nome: Ana Filipa Rodrigues",
    ]);
    expect(estado.dados.contactName).toBe("Ana Filipa Rodrigues");
    expect(estado.dados.address).toContain("Estrada do Paço do Lumiar");
  });

  it("«Descrição: …» e «Quando: …» também", () => {
    const { estado } = conversa([
      "recolha de móveis",
      "Descrição: chão flutuante",
      "Quando: até à próxima semana",
    ]);
    expect(estado.dados.description).toBe("chão flutuante");
    expect(estado.dados.quandoTexto).toContain("próxima semana");
  });
});

describe("o que NÃO traz rótulo continua a responder à pergunta em cima", () => {
  it("«Ana Filipa Rodrigues» ao ser perguntado o nome é o nome", () => {
    const { estado } = conversa(["recolha de móveis", "Ana Filipa Rodrigues"]);
    expect(estado.dados.contactName).toBe("Ana Filipa Rodrigues");
  });

  it("«Está acima» não é um campo, e não engole a resposta", () => {
    /*
     * O leitor de rótulos devolve null quando a primeira palavra não é um
     * campo conhecido — senão QUALQUER mensagem de duas palavras era lida como
     * «campo valor» e a conversa deixava de andar.
     */
    const inicio: EstadoDaRecolha = {
      passo: "nome",
      dados: { serviceType: "recolha_moveis" },
    };
    const { estado } = conversa(["Está acima"], inicio);
    expect(estado.dados.contactName).toBe("Está acima");
  });
});

describe("as gavetas deixaram de aceitar tudo", () => {
  it("um nome não tem dois pontos — era o que deixava passar a morada inteira", () => {
    const inicio: EstadoDaRecolha = { passo: "nome", dados: { serviceType: "recolha_moveis" } };
    const r = responderNaRecolha(inicio, "Alguma coisa: com dois pontos", AGORA);
    expect(r.estado.dados.contactName).toBeUndefined();
    expect(r.resposta).toContain("nome");
  });

  it("«É um apartamento e tem elevador» não é uma morada", () => {
    /*
     * Foi o que ficou gravado como morada dela. O profissional receberia isto
     * no lugar de onde tem de ir.
     */
    const inicio: EstadoDaRecolha = {
      passo: "morada",
      dados: { serviceType: "recolha_moveis", contactName: "Ana" },
    };
    const r = responderNaRecolha(inicio, "É um apartamento e tem elevador", AGORA);
    expect(r.estado.dados.address).toBeUndefined();
    expect(r.resposta).toContain("rua e do número");
  });

  it("mas uma rua sem número passa, e uma morada com número também", () => {
    const inicio: EstadoDaRecolha = {
      passo: "morada",
      dados: { serviceType: "recolha_moveis", contactName: "Ana" },
    };
    expect(
      responderNaRecolha(inicio, "Estrada do Paço do Lumiar", AGORA).estado.dados.address,
    ).toContain("Estrada do Paço do Lumiar");
    expect(
      responderNaRecolha(inicio, "Av. da Liberdade 12", AGORA).estado.dados.address,
    ).toContain("Liberdade");
  });
});

describe("a conversa dela, do princípio ao fim", () => {
  it("chega ao resumo com cada coisa no seu sítio", () => {
    const { estado } = conversa([
      "recolha de móveis",
      "Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa",
      "Nome: Ana Filipa Rodrigues",
      "andar 6",
      "elevador sim",
      "estacionar sim",
      "Quando: até à próxima semana",
      "Descrição: chão flutuante",
      "factura não",
    ]);
    const d = estado.dados;
    expect(d.contactName).toBe("Ana Filipa Rodrigues");
    expect(d.address).toContain("Estrada do Paço do Lumiar");
    expect(d.postalCode).toBe("1600-544");
    expect(d.floor).toBe("6");
    expect(d.hasElevator).toBe("yes");
    expect(d.description).toBe("chão flutuante");
    expect(d.precisaFatura).toBe(false);
    // Nada do que ela escreveu foi parar à gaveta errada.
    expect(d.contactName).not.toContain("Morada");
    expect(d.address).not.toContain("apartamento");
    expect(estado.passo).toBe("confirmar");
  });
});
