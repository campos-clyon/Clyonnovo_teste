import { describe, it, expect } from "vitest";
import { combinaComABusca, procurarPedidos, type PedidoProcuravel } from "./procurar-pedido";

/**
 * "Crie uma barra de pesquisa para que eu possa pesquisar com número, nome ou
 * pedido. Até mesmo por morada ou região." — 13-09-2026.
 */

const ANA: PedidoProcuravel = {
  id: 311,
  contactName: "Ana Almeida",
  contactPhone: "+351 912 345 678",
  contactEmail: "ana.almeida@exemplo.pt",
  address: "Rua 25 de Abril, 14, 3.º Esq.",
  city: "São João do Estoril",
  postalCode: "2765-094",
  serviceType: "recolha_entulho",
  profissionais: ["Manuel Martins transportes"],
};

const BRUNO: PedidoProcuravel = {
  id: 305,
  contactName: "Bruno Silva",
  contactPhone: "961111222",
  contactEmail: null,
  address: "Avenida da Liberdade 200",
  city: "Lisboa",
  postalCode: "1250-147",
  serviceType: "mudanca",
  profissionais: ["Nova Recolha"],
};

const MESA = [ANA, BRUNO];

describe("pelo número do pedido", () => {
  it("o número nu encontra-o", () => {
    expect(procurarPedidos(MESA, "311")).toEqual([ANA]);
  });

  it("com cardinal, como ele é falado cá dentro", () => {
    expect(procurarPedidos(MESA, "#311")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "pedido #311")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "pedido 311")).toEqual([ANA]);
  });

  it("«pedido» sozinho não filtra nada — são todos pedidos", () => {
    expect(procurarPedidos(MESA, "pedido")).toEqual(MESA);
  });

  /*
   * Um pedaço de número não pode arrastar a vizinhança: «31» traria o #310, o
   * #311 e o #312, e quem escreve 31 está a pensar num só.
   */
  it("meio número não traz o pedido inteiro", () => {
    expect(combinaComABusca(ANA, "#31")).toBe(false);
  });
});

describe("pelo número de telefone", () => {
  it("os espaços e o indicativo não contam", () => {
    expect(procurarPedidos(MESA, "912345678")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "912 345 678")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "+351912345678")).toEqual([ANA]);
  });

  it("os últimos dígitos chegam — é o que se lê num ecrã de chamada", () => {
    expect(procurarPedidos(MESA, "345678")).toEqual([ANA]);
  });

  it("um telemóvel sem formatação nenhuma também", () => {
    expect(procurarPedidos(MESA, "961111222")).toEqual([BRUNO]);
  });
});

describe("pelo nome", () => {
  it("o primeiro nome basta", () => {
    expect(procurarPedidos(MESA, "ana")).toEqual([ANA]);
  });

  it("os acentos não são obrigatórios nem impeditivos", () => {
    expect(procurarPedidos(MESA, "almeida")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "sao joao")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "SÃO JOÃO")).toEqual([ANA]);
  });

  it("o nome do profissional também encontra o pedido", () => {
    expect(procurarPedidos(MESA, "manuel")).toEqual([ANA]);
  });
});

describe("pela morada e pela região", () => {
  it("a rua", () => {
    expect(procurarPedidos(MESA, "liberdade")).toEqual([BRUNO]);
  });

  it("um número dentro da morada não é confundido com um pedido", () => {
    // «25» não é o pedido 25 nem um telemóvel: é a Rua 25 de Abril.
    expect(procurarPedidos(MESA, "25 de abril")).toEqual([ANA]);
  });

  it("a cidade", () => {
    expect(procurarPedidos(MESA, "lisboa")).toEqual([BRUNO]);
  });

  it("o código postal, com traço ou sem ele", () => {
    expect(procurarPedidos(MESA, "2765-094")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "2765094")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "1250")).toEqual([BRUNO]);
  });

  it("o serviço, em palavras e não no nome da base", () => {
    expect(procurarPedidos(MESA, "entulho")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "mudanca")).toEqual([BRUNO]);
  });
});

describe("as palavras somam-se, não se alternam", () => {
  /*
   * Quem escreve mais está a apertar a rede. Se «silva lisboa» devolvesse
   * tudo o que tem «silva» MAIS tudo o que tem «lisboa», escrever mais dava
   * mais resultados — e a busca deixava de servir.
   */
  it("duas palavras são duas condições", () => {
    expect(procurarPedidos(MESA, "bruno lisboa")).toEqual([BRUNO]);
    expect(procurarPedidos(MESA, "bruno estoril")).toEqual([]);
  });

  it("nome e número juntos", () => {
    expect(procurarPedidos(MESA, "ana 311")).toEqual([ANA]);
    expect(procurarPedidos(MESA, "ana 305")).toEqual([]);
  });
});

describe("o que a busca não pode fazer", () => {
  it("sem termo, não esconde nada", () => {
    expect(procurarPedidos(MESA, "")).toEqual(MESA);
    expect(procurarPedidos(MESA, "   ")).toEqual(MESA);
  });

  it("um cardinal sozinho não filtra a mesa toda para fora", () => {
    expect(procurarPedidos(MESA, "#")).toEqual(MESA);
  });

  it("campos em falta não rebentam nem inventam correspondências", () => {
    const magro: PedidoProcuravel = { id: 7 };
    expect(combinaComABusca(magro, "7")).toBe(true);
    expect(combinaComABusca(magro, "lisboa")).toBe(false);
    expect(combinaComABusca(magro, "912345678")).toBe(false);
  });

  it("mantém a ordem em que a mesa os arrumou", () => {
    expect(procurarPedidos(MESA, "a")).toEqual([ANA, BRUNO]);
  });
});
