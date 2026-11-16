import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dadosDaConversaNoPedido,
  pedidoNaConversa,
  querOutroPedido,
  responderNoPedidoAberto,
  type ContextoDoPedidoAberto,
  type PedidoDaBase,
} from "./pedido-aberto-na-conversa";
import { primeiroPassoEmFalta, type DadosDaRecolha, type EstadoDaRecolha } from "./whatsapp-recolha";
import { mudouDeSitio, notaDaTroca, recolhaDoPedidoNovo, respostaATroca, terraNova } from "./troca-de-sitio";
import { separarASegundaMorada } from "./segunda-morada";

/**
 * A CONVERSA DE OUTRO SÍTIO — 16-11-2026 (decisão d51).
 *
 * O caso verdadeiro, com o nome, o número do pedido e as moradas INVENTADOS
 * (o repositório é público): a cliente tinha um pedido aberto de recolha de
 * entulho na Pontinha, com orçamento de há duas semanas, e escreveu de seguida
 *
 *   CLIENTE: Olha é para outro lado
 *   CLIENTE: Pra lá já não preciso
 *   CLIENTE: Agora eu preciso mais é para o Benfica
 *
 * e a Vitória ficou agarrada ao pedido antigo. Agora pergunta, num passo, se
 * faz um pedido novo para Benfica; com o sim, começa-o com o nome e o serviço
 * do antigo; o antigo não se cancela — fica a nota para a equipa o fechar.
 */

const AGORA = new Date("2026-11-16T15:10:00Z");

const PEDIDO: PedidoDaBase = {
  id: 9123,
  status: "sem_assistente",
  serviceType: "recolha_entulho",
  contactName: "Rosalina Sobral",
  address: "Rua das Camélias 7",
  city: "Pontinha",
  postalCode: "1675-001",
  floor: "1",
  hasElevator: "no",
  parkingDistance: "door",
  description: "Entulho de obra em sacos.",
  filesJson: JSON.stringify([{ url: "https://exemplo.pt/a.jpg" }]),
  createdAt: "2026-11-04T10:00:00Z",
};

const SITIO = { id: 9123, localidade: "Pontinha", morada: "Rua das Camélias 7" };

const MENSAGENS = ["Olha é para outro lado", "Pra lá já não preciso", "Agora eu preciso mais é para o Benfica"];

function contexto(extra: Partial<ContextoDoPedidoAberto> = {}): ContextoDoPedidoAberto {
  return { pedido: pedidoNaConversa(PEDIDO), primeira: false, colegaJaFalou: false, jaSeApresentou: true, ...extra };
}

function estadoDoPedido(guardados?: DadosDaRecolha): EstadoDaRecolha {
  const dados = dadosDaConversaNoPedido(PEDIDO, guardados as Record<string, unknown> | undefined);
  return { passo: primeiroPassoEmFalta(dados), dados };
}

describe("1. a troca percebe-se — numa mensagem só ou na rajada", () => {
  it("a rajada inteira: é troca, e a terra nova é Benfica", () => {
    expect(mudouDeSitio(MENSAGENS.join("\n"), SITIO)).toEqual({ localidade: "Benfica" });
  });

  it("cada uma das três, sozinha, também é troca — a terra só na terceira", () => {
    expect(mudouDeSitio(MENSAGENS[0], SITIO)).toEqual({ localidade: null });
    expect(mudouDeSitio(MENSAGENS[1], SITIO)).toEqual({ localidade: null });
    expect(mudouDeSitio(MENSAGENS[2], SITIO)).toEqual({ localidade: "Benfica" });
  });

  it("as outras maneiras de o dizer", () => {
    expect(mudouDeSitio("Já não é na Pontinha, é em Odivelas", SITIO)).toEqual({ localidade: "Odivelas" });
    expect(mudouDeSitio("Em vez da Pontinha agora é Benfica", SITIO)).toEqual({ localidade: "Benfica" });
    expect(mudouDeSitio("Mudou a morada", SITIO)).toEqual({ localidade: null });
    expect(mudouDeSitio("é noutro sítio", SITIO)).toEqual({ localidade: null });
    expect(mudouDeSitio("Agora é para a Amadora", SITIO)).toEqual({ localidade: "Amadora" });
  });

  it("antes, nada disto era um pedido novo — era o pedido antigo", () => {
    for (const m of MENSAGENS) expect(querOutroPedido(m, "recolha_entulho")).toBe(false);
  });
});

describe("2. o que NÃO é uma troca", () => {
  it("uma 2.ª paragem continua a ser 2.ª morada", () => {
    const texto = "Também é preciso recolher umas coisas em Benfica";
    expect(mudouDeSitio(texto, SITIO)).toBeNull();
    const segundo = "Haverá um segundo lugar de recolha: Rua dos Lírios 3, 1500-001 Lisboa";
    expect(mudouDeSitio(segundo, SITIO)).toBeNull();
    expect(separarASegundaMorada(segundo, "recolha_entulho").segunda).not.toBeNull();
    expect(mudouDeSitio("e depois noutra morada em Benfica", SITIO)).toBeNull();
  });

  it("«pode ser lá mesmo», a mesma terra, um dia da semana — não é troca", () => {
    expect(mudouDeSitio("pode ser lá mesmo", SITIO)).toBeNull();
    expect(mudouDeSitio("Agora é na Pontinha", SITIO)).toBeNull();
    expect(mudouDeSitio("O entulho está na Pontinha, na garagem", SITIO)).toBeNull();
    expect(mudouDeSitio("Agora pode ser na Sexta", SITIO)).toBeNull();
    expect(mudouDeSitio("Já não preciso de nada", SITIO)).toBeNull();
  });

  it("mas «já não preciso lá» com um «também» é troca: manda o «já não»", () => {
    expect(mudouDeSitio("Pra lá já não preciso, também tenho em Benfica", SITIO)).toEqual({ localidade: "Benfica" });
  });

  it("a terra nova nunca é a do pedido", () => {
    expect(terraNova("na Pontinha", SITIO)).toBeNull();
    expect(terraNova("Benfica", SITIO)).toBe("Benfica");
  });
});

describe("3. a conversa, como deve ser", () => {
  it("a rajada: confirma num passo, com as duas terras — e não passa a ninguém", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), MENSAGENS.join("\n"), AGORA, contexto());
    expect(r.resposta).toBe("Percebi, Rosalina: em vez da Pontinha, agora é em Benfica. Faço um pedido novo para Benfica?");
    expect(r.estado.dados.trocaDeSitio).toEqual({ de: 9123, localidade: "Benfica" });
    expect(r.pedirPessoa).toBeFalsy();
    expect(r.novoPedido).toBeFalsy();
    expect(r.segundaMoradaNova).toBeFalsy();
    expect(r.resposta).not.toMatch(/\bIA\b|virtual|profissional/i);
  });

  it("com o sim, é um pedido novo — com a troca, para o antigo ficar com a nota", () => {
    const pergunta = responderNoPedidoAberto(estadoDoPedido(), MENSAGENS.join("\n"), AGORA, contexto());
    const sim = responderNoPedidoAberto(estadoDoPedido(pergunta.estado.dados), "Sim", AGORA, contexto());
    expect(sim.novoPedido).toBe(true);
    expect(sim.trocaDeSitio).toEqual({ de: 9123, localidade: "Benfica" });
    expect(sim.estado.dados.trocaDeSitio).toBeNull();
    for (const s of ["Pode ser", "sim por favor", "Faça", "Benfica"]) {
      expect(responderNoPedidoAberto(estadoDoPedido(pergunta.estado.dados), s, AGORA, contexto()).novoPedido, s).toBe(true);
    }
  });

  it("com o não, continua no pedido de sempre", () => {
    const pergunta = responderNoPedidoAberto(estadoDoPedido(), MENSAGENS.join("\n"), AGORA, contexto());
    for (const s of ["Não", "pode ser lá mesmo", "Não, afinal é lá"]) {
      const r = responderNoPedidoAberto(estadoDoPedido(pergunta.estado.dados), s, AGORA, contexto());
      expect(r.novoPedido, s).toBeFalsy();
      expect(r.resposta, s).toContain("continuamos com o seu pedido #9123, na Pontinha.");
      expect(r.estado.dados.trocaDeSitio, s).toBeNull();
    }
  });

  it("as três mensagens em três vezes: pergunta para onde, e depois confirma com a terra", () => {
    const um = responderNoPedidoAberto(estadoDoPedido(), MENSAGENS[0], AGORA, contexto());
    expect(um.resposta).toBe("Percebi, Rosalina: já não é na Pontinha. Faço um pedido novo para a outra morada?");
    const dois = responderNoPedidoAberto(estadoDoPedido(um.estado.dados), MENSAGENS[1], AGORA, contexto());
    expect(dois.resposta).toBe("Com certeza, Rosalina. Diga-me só para que localidade é agora, e faço o pedido novo.");
    expect(dois.novoPedido).toBeFalsy();
    const tres = responderNoPedidoAberto(estadoDoPedido(dois.estado.dados), MENSAGENS[2], AGORA, contexto());
    expect(tres.resposta).toBe("Percebi, Rosalina: em vez da Pontinha, agora é em Benfica. Faço um pedido novo para Benfica?");
    const sim = responderNoPedidoAberto(estadoDoPedido(tres.estado.dados), "sim", AGORA, contexto());
    expect(sim.trocaDeSitio).toEqual({ de: 9123, localidade: "Benfica" });
  });

  it("sem pergunta à espera, um «sim» não faz pedido nenhum", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "sim", AGORA, contexto());
    expect(r.novoPedido).toBeFalsy();
  });

  it("a 2.ª paragem continua como estava: anotada, e uma pessoa confirma o preço", () => {
    const r = responderNoPedidoAberto(
      estadoDoPedido(),
      "Haverá um segundo lugar de recolha: Rua dos Lírios 3, 1500-001 Lisboa",
      AGORA,
      contexto(),
    );
    expect(r.segundaMoradaNova).toBeTruthy();
    expect(r.estado.dados.trocaDeSitio ?? null).toBeNull();
  });

  it("«pode ser lá mesmo», sem pergunta: nem troca, nem pedido novo", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "pode ser lá mesmo", AGORA, contexto());
    expect(r.novoPedido).toBeFalsy();
    expect(r.estado.dados.trocaDeSitio ?? null).toBeNull();
  });
});

describe("4. o pedido novo, e o antigo", () => {
  it("o novo leva o nome e o serviço do antigo, e a terra nova — e pergunta só o que falta", () => {
    const antigos = estadoDoPedido().dados;
    const { estado, resposta } = recolhaDoPedidoNovo(antigos, { de: 9123, localidade: "Benfica" }, SITIO, "Rosalina");
    expect(estado.dados).toMatchObject({ serviceType: "recolha_entulho", contactName: "Rosalina Sobral", city: "Benfica", trocouDoPedido: 9123 });
    expect(estado.dados.address).toBeUndefined();
    expect(estado.dados.pedidoAberto).toBeUndefined();
    expect(estado.passo).not.toBe("servico");
    expect(estado.passo).not.toBe("nome");
    expect(resposta.startsWith("Combinado, Rosalina! Faço já um pedido novo para Benfica. O pedido #9123 fica de lado — a equipa da CLYON trata de o fechar.")).toBe(true);
    expect(resposta).not.toMatch(/Com quem tenho o gosto|que serviço/);
  });

  it("o antigo não se cancela: fica a nota para a equipa o fechar", () => {
    expect(notaDaTroca(9123, 9200)).toBe("O cliente trocou para o pedido #9200 (outra morada) — fechar este (#9123).");
  });

  it("as respostas à pergunta", () => {
    expect(respostaATroca("sim")).toBe("sim");
    expect(respostaATroca("pode")).toBe("sim");
    expect(respostaATroca("não")).toBe("nao");
    expect(respostaATroca("pode ser lá mesmo")).toBe("nao");
    expect(respostaATroca("quanto custa?")).toBeNull();
  });
});

describe("5. quem chama: a nota no antigo, a troca na recolha nova, e o antigo fora da conversa", () => {
  const NEG = readFileSync(join(__dirname, "whatsapp-negociacao.ts"), "utf8");
  it("o sim começa a recolha nova pela troca, e o registo anota o antigo", () => {
    expect(NEG).toContain("r.trocaDeSitio");
    expect(NEG).toContain("recolhaDoPedidoNovo(");
    expect(NEG).toContain("dados.trocouDoPedido");
    expect(NEG).toContain("notaDaTroca(");
  });
  it("nada se cancela nem se apaga no pedido antigo", () => {
    const inicio = NEG.indexOf("async function anotarATrocaDeSitio");
    expect(inicio).toBeGreaterThan(0);
    const corpo = NEG.slice(inicio, NEG.indexOf("\n}\n", inicio));
    expect(corpo).not.toMatch(/cancelado|arquivado|DELETE|status/);
  });
});
