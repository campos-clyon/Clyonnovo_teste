import { describe, it, expect } from "vitest";
import {
  type EstadoDaRecolha,
  perguntaDo,
  primeiroPassoEmFalta,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  simOuNaoNaFactura,
} from "./whatsapp-recolha";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * A CONVERSA DA SUSANA — 13-10-2026, às 14:04 de Lisboa (15:04 na captura).
 *
 *   CLYON:   Qual é o NIF para a factura? Se não o tiver à mão, diga-me…
 *   CLIENTE: Prefiro disponibilizar o meu NIF apenas se avançarmos.
 *            Dados pessoais não se transmitem assim
 *   CLYON:   Desculpe, não apanhei. Qual é o NIF para a factura?
 *
 * «Ele não pode pedir isso agora na colecta de dados: o cliente ainda não
 * aceitou o orçamento, nem o enviámos.» E: «Ele deve perguntar se deseja
 * factura, mas não pedir já o NIF.» — o dono.
 *
 * E o resto da conversa, que o caminho sem o Gemini lia mal: o «Olá, queria
 * um orçamento» do princípio, a disponibilidade para sexta, «Resido em
 * Lisboa\nVou…» como a cidade «Lisboa Vou», «Apartamento sito em:» na morada,
 * e «Temos elevador, mas é pequeno», que levou a pergunta do elevador outra vez.
 */

const AGORA = new Date("2026-10-13T13:04:00Z");

const MENSAGENS = [
  "Olá! Gostava de pedir um orçamento à CLYON.",
  "Resido em Lisboa\nVou renovar a casa e preciso de me desfazer do recheio da casa (com a exceção de 2 ou 3 móveis mais pequenos)\nTêm disponibilidade para recolha de móveis esta sexta-feira (16 de outubro), ou até mesmo no sábado (17 de outubro)?\nNeste momento estamos a empacotar os nossos pertences",
  "Susana Candeias",
  "Apartamento sito em:\nRua Duarte Galvão, n.º 46\n1.º Andar Esquerdo\n1500-254, Lisboa",
  "Temos elevador, mas é pequeno, móveis grandes não passam, a menos que sejam desfeitos",
  "Existe um lugar à porta, mas implica que esteja desocupado\nPode ver melhor no Google Maps",
  "Prefiro disponibilizar o meu NIF apenas se avançarmos\nDados pessoais não se transmitem assim",
];

function falaComASusana() {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  const estados: EstadoDaRecolha[] = [];
  MENSAGENS.forEach((m, i) => {
    const r = responderNaRecolha(estado, m, AGORA, i > 0);
    estado = r.estado;
    disse.push(r.resposta);
    estados.push(r.estado);
  });
  return { estado, disse, estados };
}

describe("a conversa da Susana", () => {
  it("o «Olá, queria um orçamento» é cumprimentado, e não «não percebi»", () => {
    const { disse } = falaComASusana();
    expect(disse[0]).toContain("Aqui é a Vitória");
    expect(disse[0]).not.toMatch(/não percebi/);
  });

  it("a segunda mensagem dá o serviço, a data e a descrição — e só se pergunta o nome", () => {
    const { estados } = falaComASusana();
    const d = estados[1].dados;
    expect(d.serviceType).toBe("esvaziamento_casa");
    expect(d.dataDesejada).toContain("2026-10-16");
    expect(d.description).toMatch(/recheio/);
    expect(d.city).toBe("Lisboa");
    expect(estados[1].passo).toBe("nome");
  });

  it("à pergunta pela disponibilidade responde-se, antes de perguntar o nome", () => {
    const { disse } = falaComASusana();
    expect(disse[1]).toMatch(/data[^.]*fica anotada/i);
    expect(disse[1].indexOf("anotada")).toBeLessThan(disse[1].indexOf("Com quem tenho o gosto de falar?"));
  });

  it("a morada em quatro linhas lê-se toda, sem o «Apartamento sito em:»", () => {
    const { estados } = falaComASusana();
    const d = estados[3].dados;
    expect(d.address).toMatch(/^Rua Duarte Galvão, n\.º 46/);
    expect(d.floor).toBe("1");
    expect(d.postalCode).toBe("1500-254");
    expect(d.city).toBe("Lisboa");
  });

  it("«Temos elevador, mas é pequeno» responde ao elevador — não se pergunta outra vez", () => {
    const { estados, disse } = falaComASusana();
    // Pequeno, como no simulador — e o que ela contou fica no pedido, para o profissional.
    expect(estados[4].dados.hasElevator).toBe("small");
    expect(estados[4].passo).toBe("estacionamento");
    expect(disse[4]).not.toMatch(/elevador/);
    expect(estados[4].dados.acessoDito).toMatch(/^Elevador: Temos elevador, mas é pequeno/);
  });

  it("pergunta-se se deseja factura — e diz-se que o NIF não é para agora", () => {
    const { estados, disse } = falaComASusana();
    expect(estados[5].passo).toBe("fatura");
    expect(disse[5]).toContain("Deseja factura com o seu NIF?");
    expect(disse[5]).toContain("Não precisa de o dar agora");
    expect(disse[5]).not.toMatch(/Qual é o NIF/);
  });

  it("«só se avançarmos» é um sim à factura, e segue para o resumo sem pedir o número", () => {
    const { estado, disse } = falaComASusana();
    expect(estado.dados.precisaFatura).toBe(true);
    expect(estado.dados.nifFactura).toBeUndefined();
    expect(estado.passo).toBe("confirmar");
    expect(disse[6]).toContain("NIF na factura: sim, pede-se se avançar");
    for (const m of disse) expect(m).not.toMatch(/Qual é o NIF/);
  });

  it("e o mesmo pelo caminho do Gemini", () => {
    const { estados } = falaComASusana();
    const r = responderComCompreensao(
      { passo: "fatura", dados: { ...estados[5].dados } },
      { intencao: "informar", campos: { fatura: "sim" } },
      AGORA,
      { texto: MENSAGENS[6] },
    );
    expect(r.estado.passo).toBe("confirmar");
    expect(r.resposta).not.toMatch(/Qual é o NIF/);
  });
});

describe("o NIF fica para quando o cliente avançar", () => {
  const PRONTO = {
    serviceType: "recolha_moveis",
    contactName: "Ana",
    address: "Rua A 1",
    postalCode: "1000-001",
    city: "Lisboa",
    floor: "0",
    parkingDistance: "near",
    quandoTexto: "sexta",
    description: "um sofá",
  };

  it("quem quer factura com NIF vai da factura ao resumo", () => {
    expect(primeiroPassoEmFalta({ ...PRONTO, precisaFatura: true })).toBe("confirmar");
  });

  it("quem o deu por si fica com ele no resumo e no pedido", () => {
    expect(resumo({ ...PRONTO, precisaFatura: true, nifFactura: "123456789" })).toContain("NIF na factura: 123456789");
  });

  it("o NIF para depois lê-se como um sim; o «sem NIF» como um não", () => {
    expect(simOuNaoNaFactura("Prefiro disponibilizar o meu NIF apenas se avançarmos")).toBe("sim");
    expect(simOuNaoNaFactura("Quero NIF, mas não o vou dar agora")).toBe("sim");
    expect(simOuNaoNaFactura("Sem NIF")).toBe("nao");
    expect(simOuNaoNaFactura("Prefiro evitar")).toBe("nao");
  });

  it("uma conversa gravada à espera do NIF segue para o resumo, sem o pedir outra vez", () => {
    const r = responderNaRecolha(
      { passo: "nif", dados: { ...PRONTO, precisaFatura: true } },
      "Só dou se avançarmos",
      AGORA,
      true,
    );
    expect(r.estado.passo).toBe("confirmar");
    expect(r.resposta).toContain("Confirme, por favor");
    expect(r.resposta).not.toMatch(/Qual é o NIF/);
  });

  it("a pergunta nova reconhece-se no fio", () => {
    expect(passoDaPergunta(perguntaDo("fatura", {}))).toBe("fatura");
  });
});
