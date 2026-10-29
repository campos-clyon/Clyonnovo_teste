import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blocoDoWhatsApp,
  camposParaOPedido,
  dadosDaConversaNoPedido,
  dadosDoPedido,
  descricaoComOBloco,
  escolherOPedido,
  oQueEDaConversa,
  pedidoEstaAberto,
  pedidoNaConversa,
  pedidoParaAVitoria,
  pedidosFaladosNoFio,
  perguntaQualPedido,
  procurarOPedidoAMeio,
  querOutroPedido,
  responderNoPedidoAberto,
  type ContextoDoPedidoAberto,
  type PedidoDaBase,
} from "./pedido-aberto-na-conversa";
import {
  NOME_DE_OUTRA_FORMA,
  primeiroPassoEmFalta,
  responderComCompreensao,
  responderNaRecolha,
  type DadosDaRecolha,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { fugiuAoNome, jaFezOPedido } from "./leitor-da-recolha";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * A CONVERSA DA GRACIETE — 26-10-2026 (decisão d30).
 *
 * O caso verdadeiro, com o nome, o número do pedido e a morada INVENTADOS (o
 * repositório é público): a cliente já tinha o pedido #812 — uma recolha de
 * monos em Almada, feita no simulador, com fotografias. Um colega escreveu-lhe
 * à mão a pedir imagens; ela mandou uma, e a Vitória respondeu como a uma
 * desconhecida:
 *
 *   CLYON (à mão): Olá Graciete, é da CLYON. Recebemos o seu pedido de recolha
 *                  de monos (#812), em Rua das Amendoeiras 14, a senhora pode
 *                  nos enviar algumas imagens para o orçamento online?
 *   CLIENTE:       [fotografia]
 *   VITÓRIA:       Boa tarde! Aqui é a Vitória… diga-me só que serviço é…
 *   CLIENTE:       Trata-se da recolha de um sofá. Deste sofá.
 *   VITÓRIA:       Fica anotado: recolha de móveis. Com quem tenho o gosto de falar?
 *   CLIENTE:       Está a falar com a pessoa que pediu o orçamento!
 *   VITÓRIA:       Peço desculpa, não apanhei bem. Com quem tenho o gosto de falar?
 *   CLIENTE:       Consulte o pedido de orçamento. Está lá tudo. Fotos também.
 *
 * O dono: «Se tiver [cadastro], não precisa de começar do zero: só precisa de
 * actualizar o que estiver a faltar.»
 */

const AGORA = new Date("2026-10-26T15:10:00Z");

const PEDIDO: PedidoDaBase = {
  id: 812,
  status: "sem_assistente",
  serviceType: "recolha_monos",
  contactName: "Graciete Lopes",
  address: "Rua das Amendoeiras 14",
  city: "Almada",
  postalCode: "2800-123",
  floor: "2",
  hasElevator: "yes",
  parkingDistance: "door",
  description: "Sofá velho para levar.",
  filesJson: JSON.stringify([{ url: "https://exemplo.pt/a.jpg" }, { url: "https://exemplo.pt/b.jpg" }]),
  createdAt: "2026-10-25T10:00:00Z",
};

const DO_COLEGA =
  "[à mão] Olá Graciete, é da CLYON. Recebemos o seu pedido de recolha de monos (#812), em Rua das Amendoeiras 14, " +
  "a senhora pode nos enviar algumas imagens para o orçamento online?";

const FIO = [
  { direccao: "out", texto: DO_COLEGA },
  { direccao: "in", texto: "[fotografia]" },
];

function contexto(extra: Partial<ContextoDoPedidoAberto> = {}): ContextoDoPedidoAberto {
  return {
    pedido: pedidoNaConversa(PEDIDO),
    primeira: false,
    colegaJaFalou: true,
    jaSeApresentou: false,
    ...extra,
  };
}

function estadoDoPedido(p: PedidoDaBase = PEDIDO, guardados?: DadosDaRecolha): EstadoDaRecolha {
  const dados = dadosDaConversaNoPedido(p, guardados as Record<string, unknown> | undefined);
  return { passo: primeiroPassoEmFalta(dados), dados };
}

describe("1. o pedido aberto encontra-se — pelo telefone e pelo que o colega escreveu", () => {
  it("o colega falou do #812 à mão: é esse o pedido da conversa", () => {
    expect(pedidosFaladosNoFio(FIO)).toEqual([812]);
    expect(procurarOPedidoAMeio("[fotografia]", FIO)).toBe(true);
    // O número escrito pelo CLIENTE não abre pedido nenhum que não seja do telefone dele.
    expect(pedidosFaladosNoFio([{ direccao: "in", texto: "o meu pedido é o #900" }])).toEqual([]);
  });

  it("só os abertos e recentes: cancelado, concluído, arquivado ou de há dois meses não contam", () => {
    expect(pedidoEstaAberto(PEDIDO, AGORA)).toBe(true);
    for (const status of ["cancelado", "concluido", "arquivado", "rejeitado"]) {
      expect(pedidoEstaAberto({ ...PEDIDO, status }, AGORA), status).toBe(false);
    }
    expect(pedidoEstaAberto({ ...PEDIDO, createdAt: "2026-08-20T10:00:00Z" }, AGORA)).toBe(false);
    // Um trabalho CLYON fala com uma pessoa, e não com a Vitória (decisão de 02-10-2026).
    expect(pedidoParaAVitoria(PEDIDO, AGORA)).toBe(true);
    expect(pedidoParaAVitoria({ ...PEDIDO, valorFixoClyon: "350.00" }, AGORA)).toBe(false);
  });

  it("o que o pedido tem não se pergunta: nem o serviço, nem o nome, nem a morada, nem o andar", () => {
    const e = estadoDoPedido();
    expect(e.dados.serviceType).toBe("recolha_monos");
    expect(e.dados.contactName).toBe("Graciete Lopes");
    expect(e.dados.floor).toBe("2");
    expect(e.dados.parkingDistance).toBe("near");
    expect(e.passo).toBe("confirmar");
  });
});

describe("2. a conversa, como devia ter sido", () => {
  it("a fotografia: agradece-se pelo nome, junta-se ao #812 — sem se apresentar de novo, sem perguntar o serviço", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "", AGORA, contexto({ primeira: true, imagensNovas: 1 }));
    expect(r.resposta).toContain("Obrigada pelas imagens, Graciete!");
    expect(r.resposta).toContain("#812");
    expect(r.resposta).not.toMatch(/Aqui é a Vitória|que serviço é|Com quem tenho o gosto/);
    expect(r.novoPedido).toBeFalsy();
  });

  it("«Trata-se da recolha de um sofá. Deste sofá.» fica anotado no pedido como «1 sofá» — o serviço não muda", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "Trata-se da recolha de um sofá. Deste sofá.", AGORA, contexto());
    expect(r.resposta).toBe("Obrigada, Graciete, fica anotado no seu pedido #812: 1 sofá.");
    expect(r.estado.dados.serviceType).toBe("recolha_monos");
    expect(r.resposta).not.toMatch(/recolha de móveis|Com quem tenho o gosto/);
  });

  it("«Está a falar com a pessoa que pediu o orçamento!» — tem razão, e não se repete pergunta nenhuma", () => {
    expect(fugiuAoNome("Está a falar com a pessoa que pediu o orçamento!")).toBe(true);
    const r = responderNoPedidoAberto(estadoDoPedido(), "Está a falar com a pessoa que pediu o orçamento!", AGORA, contexto());
    expect(r.resposta).toContain("Tem razão, Graciete — está tudo no seu pedido #812, com as fotografias.");
    expect(r.resposta).not.toMatch(/Com quem|como se chama/);
  });

  it("«Consulte o pedido de orçamento. Está lá tudo. Fotos também.» — o mesmo", () => {
    expect(jaFezOPedido("Consulte o pedido de orçamento. Está lá tudo. Fotos também.")).toBe(true);
    const r = responderNoPedidoAberto(
      estadoDoPedido(),
      "Consulte o pedido de orçamento. Está lá tudo. Fotos também.",
      AGORA,
      contexto(),
    );
    expect(r.resposta).toContain("está tudo no seu pedido #812");
    expect(r.resposta).toContain("As propostas dos parceiros chegam-lhe por aqui.");
    expect(r.pedirPessoa).toBeFalsy();
    // Com negócio fechado, não se prometem propostas.
    const fechado = responderNoPedidoAberto(estadoDoPedido(), "Consulte o pedido de orçamento.", AGORA, contexto({ contratado: true }));
    expect(fechado.resposta).not.toContain("propostas");
  });

  it("sem colega no fio, cumprimenta pelo pedido — uma vez, com um emoji só, e «assistente online»", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "Boa tarde", AGORA, contexto({ primeira: true, colegaJaFalou: false }));
    expect(r.resposta.startsWith("Olá, Graciete! Aqui é a Vitória, assistente online da CLYON 😊\nTenho aqui o seu pedido #812 — recolha de monos em Almada.")).toBe(true);
    expect([...r.resposta.matchAll(/\p{Extended_Pictographic}/gu)].length).toBe(1);
    expect(r.resposta).not.toMatch(/\bIA\b|virtual|intelig[eê]ncia artificial/i);
    // E já apresentada, não se volta a apresentar.
    const outra = responderNoPedidoAberto(estadoDoPedido(), "Boa tarde", AGORA, contexto({ primeira: true, colegaJaFalou: false, jaSeApresentou: true }));
    expect(outra.resposta).not.toContain("Aqui é a Vitória");
    expect(outra.resposta).toContain("Tenho aqui o seu pedido #812");
  });
});

describe("3. o que se escreve no pedido: só o que faltava, e uma descrição arrumada", () => {
  it("o bloco da descrição diz o que ela acrescentou — sem a frase solta, sem o nome, sem telefone", () => {
    const antes = dadosDoPedido(PEDIDO);
    const r = responderNoPedidoAberto(estadoDoPedido(), "Trata-se da recolha de um sofá. Deste sofá.", AGORA, contexto());
    const depois = { ...r.estado.dados, fotosRecebidas: 1 };
    const bloco = blocoDoWhatsApp(oQueEDaConversa(antes, depois), depois.fotosRecebidas)!;
    expect(bloco).toBe("Acrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.\nFotografias enviadas pelo cliente: 1.");
    expect(bloco).not.toMatch(/Trata-se|Deste sofá|Graciete|\d{9}/);
    // O que o pedido já tinha (o andar, o elevador) não se repete no bloco.
    expect(bloco).not.toMatch(/Acesso|Estacionamento/);
  });

  it("nada por cima do que o pedido tem; o que lhe faltava, sim", () => {
    const r = responderNoPedidoAberto(estadoDoPedido(), "Trata-se da recolha de um sofá. Deste sofá.", AGORA, contexto());
    expect(camposParaOPedido(PEDIDO, { ...r.estado.dados, contactName: "Outra Pessoa" })).toEqual({});
    const semNada: PedidoDaBase = { ...PEDIDO, contactName: "Cliente WhatsApp", floor: null, hasElevator: null };
    expect(camposParaOPedido(semNada, { ...r.estado.dados, contactName: "Graciete Lopes", floor: "3", lado: "Esq", hasElevator: "no" })).toEqual({
      contactName: "Graciete Lopes",
      floor: "3º Esq",
      hasElevator: "no",
    });
  });

  it("a descrição que lá estava fica; o bloco troca-se, e não se repete; se a equipa mexeu, o que ela escreveu fica", () => {
    const um = descricaoComOBloco("Sofá velho para levar.", null, "Acrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.");
    expect(um).toBe("Sofá velho para levar.\n\nAcrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.");
    const dois = descricaoComOBloco(
      um,
      "Acrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.",
      "Acrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.\nFotografias enviadas pelo cliente: 2.",
    );
    expect(dois).toBe(
      "Sofá velho para levar.\n\nAcrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.\nFotografias enviadas pelo cliente: 2.",
    );
    /*
     * 29-10-2026: a equipa escreveu uma linha DENTRO do bloco. Antes juntava-se
     * outro bloco por baixo (e foi assim que um pedido ficou com dois); agora o
     * bloco troca-se na mesma, e a linha dela fica — no texto da equipa.
     */
    const editada = `${um}\nNota da equipa: confirmar o elevador.`;
    const tres = descricaoComOBloco(editada, "Acrescentado pelo cliente no WhatsApp:\nPara levar: 1 sofá.", "Acrescentado pelo cliente no WhatsApp:\nPara levar: 2 sofás.");
    expect(tres).toBe(
      "Sofá velho para levar.\n\nNota da equipa: confirmar o elevador.\n\nAcrescentado pelo cliente no WhatsApp:\nPara levar: 2 sofás.",
    );
    expect(tres.match(/Acrescentado pelo cliente no WhatsApp:/g)).toHaveLength(1);
    // Sem saber qual era o bloco anterior (a conversa recomeçou), não se junta outro.
    const quatro = descricaoComOBloco(tres, null, "Acrescentado pelo cliente no WhatsApp:\nPara levar: 2 sofás.\nQuando: sábado.");
    expect(quatro.match(/Acrescentado pelo cliente no WhatsApp:/g)).toHaveLength(1);
    expect(quatro).toContain("Nota da equipa: confirmar o elevador.");
  });
});

describe("4. o pedido a que falta alguma coisa: só isso se pergunta, e no fim não há resumo", () => {
  const INCOMPLETO: PedidoDaBase = { ...PEDIDO, address: null, city: null, postalCode: null, floor: null, hasElevator: null };

  it("pergunta-se a morada — e não o serviço, nem o nome", () => {
    const e = estadoDoPedido(INCOMPLETO);
    expect(e.passo).toBe("morada");
    const r = responderNoPedidoAberto(e, "", AGORA, contexto({ pedido: pedidoNaConversa(INCOMPLETO), primeira: true, imagensNovas: 1 }));
    expect(r.resposta).toContain("Qual é a morada");
    expect(r.resposta).not.toMatch(/que serviço|Com quem/);
  });

  it("a morada, o elevador — e o fim é «fica tudo anotado no seu pedido», sem resumo nem SIM", () => {
    const pergunta = estadoDoPedido(INCOMPLETO);
    const guardados = { ...pergunta.dados } as DadosDaRecolha;
    const a = responderNoPedidoAberto(
      { passo: "morada", dados: guardados },
      "Rua das Amendoeiras 14, 3º esq, 2800-123 Almada",
      AGORA,
      contexto({ pedido: pedidoNaConversa(INCOMPLETO) }),
    );
    expect(a.estado.dados.address).toContain("Rua das Amendoeiras 14");
    expect(a.estado.dados.floor).toBe("3");
    expect(a.estado.passo).toBe("elevador");
    expect(a.resposta).toMatch(/elevador/);
    const b = responderNoPedidoAberto(a.estado, "Sim", AGORA, contexto({ pedido: pedidoNaConversa(INCOMPLETO) }));
    expect(b.estado.dados.hasElevator).toBe("yes");
    expect(b.resposta).toContain("Fica tudo anotado no seu pedido #812");
    expect(b.resposta).toContain("As propostas dos parceiros chegam-lhe por aqui.");
    expect(b.resposta).not.toMatch(/Confirme|responda SIM/);
    expect(b.registar).toBeFalsy();
    // E vai para o pedido o que lhe faltava.
    expect(camposParaOPedido(INCOMPLETO, b.estado.dados)).toMatchObject({
      address: expect.stringContaining("Rua das Amendoeiras 14"),
      floor: expect.stringMatching(/^3º/),
      hasElevator: "yes",
    });
  });
});

describe("4b. o pedido que a própria Vitória registou nesta conversa", () => {
  it("o nome que ele não quis dar não se volta a pedir — vem da recolha que deu o pedido", () => {
    const registado: PedidoDaBase = { ...PEDIDO, contactName: "Cliente WhatsApp" };
    const daRecolha = { serviceType: "recolha_monos", saltados: ["nome"], tentativas: { nome: 2 } };
    const e = estadoDoPedido(registado, daRecolha as DadosDaRecolha);
    expect(e.dados.contactName).toBeUndefined();
    expect(e.passo).toBe("confirmar");
  });
});

describe("5. dois pedidos abertos: pergunta-se a qual se refere", () => {
  const OUTRO: PedidoDaBase = { ...PEDIDO, id: 805, serviceType: "mudanca", city: "Lisboa" };
  const DOIS = [pedidoNaConversa(PEDIDO), pedidoNaConversa(OUTRO)];

  it("a pergunta diz os dois, pelo número e pelo serviço", () => {
    const p = perguntaQualPedido(DOIS, "Graciete", false);
    expect(p).toContain("Tenho aqui dois pedidos seus em aberto:");
    expect(p).toContain("• #812 — recolha de monos em Almada");
    expect(p).toContain("• #805 — mudança em Lisboa");
    expect(p).toContain("A qual deles se refere?");
  });

  it("a resposta lê-se pelo número, pela ordem, pelo serviço ou pela localidade", () => {
    expect(escolherOPedido("o 805", DOIS)).toBe(805);
    expect(escolherOPedido("#812", DOIS)).toBe(812);
    expect(escolherOPedido("o primeiro", DOIS)).toBe(812);
    expect(escolherOPedido("É a mudança", DOIS)).toBe(805);
    expect(escolherOPedido("o de Almada", DOIS)).toBe(812);
    expect(escolherOPedido("é um pedido novo", DOIS)).toBe("novo");
    expect(escolherOPedido("sim", DOIS)).toBeNull();
  });

  it("escolhido o pedido, diz-se qual ficou — sem se apresentar outra vez", () => {
    const r = responderNoPedidoAberto(
      estadoDoPedido(),
      "o 812",
      AGORA,
      contexto({ primeira: true, jaDisseOPedido: true, colegaJaFalou: true, jaSeApresentou: true }),
    );
    expect(r.resposta.startsWith("Muito bem: o seu pedido #812 — recolha de monos em Almada.")).toBe(true);
    expect(r.resposta).not.toContain("Aqui é a Vitória");
    expect(r.semNovidade).toBeFalsy();
  });
});

describe("6. outra coisa, nova: aí sim, um pedido novo", () => {
  it("«também preciso de uma mudança» é novo; «a recolha de um sofá» é o mesmo pedido", () => {
    expect(querOutroPedido("Também preciso de uma mudança", "recolha_monos")).toBe(true);
    expect(querOutroPedido("Quero fazer outro pedido", "recolha_monos")).toBe(true);
    expect(querOutroPedido("Trata-se da recolha de um sofá. Deste sofá.", "recolha_monos")).toBe(false);
    const r = responderNoPedidoAberto(estadoDoPedido(), "Quero fazer outro pedido, para uma mudança", AGORA, contexto());
    expect(r.novoPedido).toBe(true);
  });
});

describe("7. sem pedido nenhum: fica como hoje — e o nome pergunta-se uma vez só de outra forma", () => {
  it("quem não tem pedido nem colega no fio começa a recolha de sempre", () => {
    expect(procurarOPedidoAMeio("Olá! Gostava de pedir um orçamento à CLYON.", [])).toBe(false);
    expect(procurarOPedidoAMeio("Tenho um sofá para levar", [{ direccao: "out", texto: "Pedido #400 registado!" }])).toBe(false);
  });

  it("«a pessoa que pediu o orçamento» → a pergunta de outra forma; à segunda, segue-se sem o nome", () => {
    const naPerguntaDoNome: EstadoDaRecolha = { passo: "nome", dados: { serviceType: "recolha_monos" } };
    const a = responderNaRecolha(naPerguntaDoNome, "Está a falar com a pessoa que pediu o orçamento!", AGORA, true);
    expect(a.resposta).toBe(`Claro! ${NOME_DE_OUTRA_FORMA}`);
    expect(a.resposta).not.toContain("Com quem tenho o gosto de falar");
    // A releitura do fio continua a saber que esta é a pergunta do nome.
    expect(passoDaPergunta(a.resposta)).toBe("nome");
    const b = responderNaRecolha(a.estado, "Consulte o pedido de orçamento. Está lá tudo. Fotos também.", AGORA, true);
    expect(b.resposta).not.toMatch(/Com quem|como se chama/);
    expect(b.estado.dados.saltados).toContain("nome");
    expect(b.estado.passo).toBe("morada");
    expect(b.estado.dados.contactName).toBeUndefined();
  });

  it("pelo caminho do modelo, o mesmo", () => {
    const naPerguntaDoNome: EstadoDaRecolha = { passo: "nome", dados: { serviceType: "recolha_monos" } };
    const a = responderComCompreensao(naPerguntaDoNome, { intencao: "informar", campos: {} }, AGORA, {
      texto: "Está a falar com a pessoa que pediu o orçamento!",
      jaCumprimentou: true,
    });
    expect(a.resposta).toBe(`Claro! ${NOME_DE_OUTRA_FORMA}`);
    const b = responderComCompreensao(a.estado, { intencao: "informar", campos: {} }, AGORA, {
      texto: "Já disse, está no pedido",
      jaCumprimentou: true,
    });
    expect(b.resposta).not.toContain("Com quem tenho o gosto de falar");
    expect(b.estado.dados.saltados).toContain("nome");
  });
});

describe("8. o caminho no cérebro", () => {
  const NEG = readFileSync(join(process.cwd(), "src/lib/whatsapp-negociacao.ts"), "utf8").replace(/\r\n/g, "\n");

  it("antes de recomeçar do zero, procura-se o pedido aberto", () => {
    const i = NEG.indexOf("export async function recolherPedidoPorWhatsApp(");
    const corpo = NEG.slice(i, NEG.indexOf("\nexport async function registarARecolha(", i));
    const procura = corpo.indexOf("continuarNumPedidoAberto(");
    expect(procura).toBeGreaterThan(-1);
    expect(procura).toBeLessThan(corpo.indexOf("const novo = recolhaNova();"));
  });

  it("a conversa a meio não passa pela negociação — e com propostas à espera dele, a negociação vem primeiro", () => {
    const i = NEG.indexOf("export async function tratarMensagemDoCliente(");
    const corpo = NEG.slice(i);
    expect(corpo.indexOf("conversaPresaARecolha(telefone, pedidos, soImagens)")).toBeGreaterThan(-1);
    expect(corpo.indexOf("conversaPresaARecolha(telefone, pedidos, soImagens)")).toBeLessThan(
      corpo.indexOf("// A negociação lê palavras; as fotografias do pedido já ficaram nele."),
    );
    const j = NEG.indexOf("async function conversaPresaARecolha(");
    expect(NEG.slice(j, NEG.indexOf("\n}", j))).toContain("alvosAccionaveis(pedidos)");
  });

  it("uma conversa que completa um pedido nunca regista outro", () => {
    const i = NEG.indexOf("export async function registarARecolha(");
    const corpo = NEG.slice(i, NEG.indexOf("registarPedidoDaRecolha(telefone", i));
    expect(corpo).toMatch(/if \(dados\.pedidoAberto != null\) return/);
  });

  it("no pedido só se escreve o que faltava, e a descrição escreve-se a partir das fontes (29-10-2026)", () => {
    const i = NEG.indexOf("async function completarOPedidoAberto(");
    const corpo = NEG.slice(i, NEG.indexOf("\n}", i));
    expect(corpo).toContain("pa.camposParaOPedido(");
    expect(corpo).toContain("nb.juntarAConversaNaDescricao(id, novos)");
    expect(corpo).not.toContain("pa.descricaoComOBloco(");
  });
});

