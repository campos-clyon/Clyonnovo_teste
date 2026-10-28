import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aproveitarRespostaAtrasada,
  deOutraForma,
  lerAsPartesDaRajada,
  localidadeSolta,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  COMO_CHEGA_O_PRECO,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import { aPerguntaFoiFeita, passoDaPergunta } from "./reler-a-conversa";
import { excluiDoTrabalho, soQuerOOrcamento } from "./leitor-da-recolha";
import {
  calarAPerguntaPorChegarOutra,
  esperaPorQuemEscreveEmPartes,
  ESPERA_DAS_IMAGENS_MS,
  ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS,
  JANELA_DA_RAJADA_MS,
  textoDaRajada,
  ultimaMensagemLida,
  videosDaRajada,
  type MensagemComId,
} from "./rajada-do-whatsapp";
import {
  blocoDoWhatsApp,
  dadosDaConversaNoPedido,
  dadosDoPedido,
  oQueEDaConversa,
  pedidoNaConversa,
  responderNoPedidoAberto,
  type ContextoDoPedidoAberto,
  type PedidoDaBase,
} from "./pedido-aberto-na-conversa";
import { primeiroPassoEmFalta } from "./whatsapp-recolha";
import {
  O_IVA_NA_PROPOSTA,
  O_QUE_E_A_CARGA,
  PODE_MANDAR_IMAGENS,
  respostaFrequente,
} from "./perguntas-frequentes-da-vitoria";
import { notaDaCargaParaOCliente, O_QUE_E_UMA_CARGA } from "./base-do-preco";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { NO_MESMO_DIA, QUEM_FAZ_O_TRABALHO, PROMESSA_DO_PRAZO } from "./promessas-publicas";
import { RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { COMO_SE_PAGA } from "./seo-data";
import { PERGUNTA_ANOTADA } from "./voz-da-vitoria";

/**
 * A CONVERSA DA LEONOR — 27-10-2026, decisão d2.
 *
 * O caso é verdadeiro (um pedido de hoje, visto pelo dono); o nome, a morada,
 * o código postal e o número do pedido são INVENTADOS — o repositório é
 * público. A localidade fica. A sequência, como aconteceu:
 *
 *   CLIENTE: Olá! Preciso de recolha de móveis.
 *   (o nome)  ·  (a morada)
 *   CLIENTE: Rua das Acácias Velhas, nº23 · 2º andar
 *   VITÓRIA: E o código postal, com a localidade?
 *   CLIENTE: 1495-123 · Algés                      (no mesmo minuto)
 *   VITÓRIA: Obrigada, fica anotado. E a localidade?        ← REPETIU
 *   CLIENTE: Algés
 *   VITÓRIA: (o elevador) · CLIENTE: Não
 *   VITÓRIA: E a carrinha consegue encostar à porta…?
 *   CLIENTE: retirar toda a mobília da casa, camas, 1 roupeiro… · Consegue se tiver vaga
 *   VITÓRIA: E a carrinha consegue encostar à porta…?        ← REPETIU
 *   VITÓRIA: Para quando precisa?                            ← DUAS SEGUIDAS
 *   CLIENTE: O quanto antes · Só preciso do orçamento
 *   VITÓRIA: Deseja fatura? (aplica-se IVA de 23%)
 *   VITÓRIA: Peço desculpa, não apanhei bem. Deseja fatura?  ← LEU A FRASE COMO FACTURA
 *   CLIENTE: Não é necessário · (resumo) · sim · Pedido registado!
 *
 * E depois do registo: «Pode ser um vídeo?», dois vídeos, «Só não é preciso
 * tirar o frigorífico», e — à proposta «360,00 € + IVA = 442,80 € por carga»
 * — «Não entendi, o que é a carga? A carrinha?». A Vitória não respondeu a
 * nada disto; respondeu a equipa.
 *
 * As duas perguntas seguidas vinham de uma corrida: a mensagem seguinte
 * chegava enquanto a Vitória ainda pensava na de antes. Desde hoje a pergunta
 * que ia sair cala-se (`calarAPerguntaPorChegarOutra`), e quem responde é a
 * execução da mensagem nova, com as duas lidas juntas. É assim que a conversa
 * chega aqui: cada rajada é o que ela leu de uma vez.
 */

const AGORA = new Date("2026-10-27T11:10:00Z"); // 11:10 em Lisboa

const NOME = "Leonor"; // nome inventado
const RUA = "Rua das Acácias Velhas, nº23"; // morada inventada
const CODIGO = "1495-123"; // código postal inventado, com a forma do verdadeiro
const DESCRICAO = "retirar toda a mobília da casa, camas, 1 roupeiro, mesa, cadeira, sofás e estante da sala";

/** As rajadas como chegam à Vitória: as mensagens de uma vez, uma por linha. */
const RAJADAS: string[][] = [
  ["Olá! Preciso de recolha de móveis."],
  [NOME],
  [RUA, "2º andar"],
  [CODIGO, "Algés"],
  ["Não"],
  [DESCRICAO, "Consegue se tiver vaga"],
  ["O quanto antes", "Só preciso do orçamento"],
  ["Não é necessário"],
  ["sim"],
];

/**
 * O que o modelo podia ter lido do que lhe chega — o resto da rajada, depois
 * de `lerAsPartesDaRajada`. Do lado pior onde dói: «Algés» sem nada, e «Só
 * preciso do orçamento» lido como um não à factura.
 */
const LEITURAS: Record<string, { intencao: Intencao; campos: CamposCrus }> = {
  "Olá! Preciso de recolha de móveis.": { intencao: "informar", campos: { servico: "recolha_moveis" } },
  [NOME]: { intencao: "informar", campos: { nome: NOME } },
  "2º andar": { intencao: "informar", campos: { andar: "2" } },
  Algés: { intencao: "informar", campos: {} },
  Não: { intencao: "informar", campos: { elevador: "não" } },
  "Consegue se tiver vaga": { intencao: "informar", campos: { estacionamento: "sim" } },
  "Só preciso do orçamento": { intencao: "informar", campos: { fatura: "não" } },
  "Não é necessário": { intencao: "informar", campos: { fatura: "não" } },
  sim: { intencao: "confirmar", campos: {} },
};

type Fala = { estado: EstadoDaRecolha; disse: string[]; respostas: RespostaDaRecolha[]; lidos: string[] };

/** A conversa inteira — pelas regras, ou com o modelo — como a recolha a corre (`recolherPedidoPorWhatsApp`). */
function conversa(comModelo: boolean): Fala {
  let estado = recolhaNova();
  const fio: Array<{ direccao: string; texto: string }> = [];
  const disse: string[] = [];
  const respostas: RespostaDaRecolha[] = [];
  const lidos: string[] = [];
  RAJADAS.forEach((rajada, i) => {
    const texto = rajada.join("\n");
    for (const m of rajada) fio.push({ direccao: "in", texto: m });
    const partes = lerAsPartesDaRajada(estado, texto, AGORA, aPerguntaFoiFeita(fio, estado.passo));
    lidos.push(partes.texto);
    const r = comModelo
      ? responderComCompreensao(partes.estado, LEITURAS[partes.texto] ?? { intencao: "informar", campos: {} }, AGORA, {
          texto: partes.texto,
          jaCumprimentou: i > 0,
          perguntaPorFazer: partes.perguntaPorFazer,
        })
      : responderNaRecolha(partes.estado, partes.texto, AGORA, i > 0, false, { perguntaPorFazer: partes.perguntaPorFazer });
    estado = r.estado;
    disse.push(r.resposta);
    respostas.push(r);
    if (r.resposta) fio.push({ direccao: "out", texto: r.resposta });
  });
  return { estado, disse, respostas, lidos };
}

const CAMINHOS: Array<[string, boolean]> = [
  ["sem o modelo", false],
  ["com o modelo", true],
];

describe.each(CAMINHOS)("a conversa da Leonor, %s", (_, comModelo) => {
  it("chega ao registo, uma resposta por rajada, sem nenhuma pergunta repetida", () => {
    const { disse, respostas } = conversa(comModelo);
    expect(respostas.at(-1)?.registar).toBe(true);
    const perguntas = disse.slice(0, -1).map((m) => passoDaPergunta(m));
    expect(perguntas).toEqual(["nome", "morada", "codigoPostal", "elevador", "estacionamento", "quando", "fatura", "confirmar"]);
    expect(new Set(perguntas).size).toBe(perguntas.length);
    // Nem «não apanhei», nem «E a localidade?» a quem a escreveu.
    expect(disse.join("\n")).not.toMatch(/não apanhei|não percebi|E a localidade\?/);
  });

  it("«Algés» depois do código postal fica na localidade; o «2º andar» com a rua", () => {
    const d = conversa(comModelo).estado.dados;
    expect(d.address).toBe(RUA);
    expect(d.floor).toBe("2");
    expect(d.postalCode).toBe(CODIGO);
    expect(d.city).toBe("Algés");
  });

  it("a descrição e «Consegue se tiver vaga» na mesma rajada: a descrição fica, e a carrinha não se pergunta outra vez", () => {
    const { estado, disse, lidos } = conversa(comModelo);
    // O que se leu primeiro já não vai ao modelo: só a resposta à carrinha.
    expect(lidos[5]).toBe("Consegue se tiver vaga");
    expect(estado.dados.parkingDistance).toBe("near");
    expect(estado.dados.description).toContain(DESCRICAO);
    expect(disse[5]).toMatch(/Para quando precisa\?/);
    expect(disse[5]).not.toMatch(/carrinha/);
  });

  it("«Só preciso do orçamento» não é a resposta à factura: fica nas notas, e a pergunta sai como o dono a escreveu", () => {
    const { disse, respostas } = conversa(comModelo);
    const daData = respostas[6];
    expect(daData.estado.passo).toBe("fatura");
    expect(daData.estado.dados.precisaFatura).toBeUndefined();
    expect(daData.estado.dados.notas).toEqual(["Só preciso do orçamento"]);
    expect(disse[6]).toContain(COMO_CHEGA_O_PRECO);
    expect(disse[6].endsWith("Deseja fatura? (aplica-se IVA de 23%)")).toBe(true);
    expect(disse[6]).not.toMatch(/Peço desculpa/);
  });

  it("«Não é necessário» é o não à factura, e o resumo diz tudo", () => {
    const { respostas } = conversa(comModelo);
    const d = respostas[7].estado.dados;
    expect(d.precisaFatura).toBe(false);
    const r = resumo(d);
    expect(r).toContain(`Morada: ${RUA}, ${CODIGO}, Algés`);
    expect(r).toContain("Andar: 2 · elevador: não · estacionar à porta: sim");
    expect(r).toContain("Quando: O quanto antes");
    expect(r).toContain("Fatura: não");
  });
});

describe("a corrida: a pergunta que já não serve cala-se, e a seguinte lê as duas mensagens", () => {
  const fio = (...m: Array<[number, "in" | "out", string]>): MensagemComId[] =>
    m.map(([id, direccao, texto]) => ({ id, direccao, texto }));

  it("com outra mensagem dele depois da última lida, a pergunta não sai; o resto sai sempre", () => {
    const depois = fio([10, "out", "Para quando precisa?"], [11, "in", "O quanto antes"], [12, "in", "Só preciso do orçamento"]);
    expect(calarAPerguntaPorChegarOutra("Deseja fatura? (aplica-se IVA de 23%)", 11, depois)).toBe(true);
    // Sem nada novo, sai.
    expect(calarAPerguntaPorChegarOutra("Deseja fatura? (aplica-se IVA de 23%)", 12, depois)).toBe(false);
    // O que não é pergunta não se perde: o registo, a passagem a uma pessoa.
    expect(calarAPerguntaPorChegarOutra("Pedido #853 registado! Muito obrigada.", 11, depois)).toBe(false);
    // O áudio que não se ouviu não corre a rajada: não pode calar ninguém.
    expect(calarAPerguntaPorChegarOutra("Para quando precisa?", 11, fio([12, "in", "[áudio]"]))).toBe(false);
    expect(ultimaMensagemLida(depois)).toBe(12);
  });

  it.each(CAMINHOS)("a data e «Só preciso do orçamento» em duas execuções: uma pergunta só, sem «não apanhei» (%s)", (_, comModelo) => {
    // A primeira execução leu «O quanto antes», guardou a data, e a pergunta da factura calou-se.
    const antes: EstadoDaRecolha = {
      passo: "fatura",
      dados: {
        serviceType: "recolha_moveis",
        contactName: NOME,
        address: RUA,
        floor: "2",
        postalCode: CODIGO,
        city: "Algés",
        hasElevator: "no",
        parkingDistance: "near",
        description: DESCRICAO,
        quandoTexto: "O quanto antes",
      },
    };
    const msgs = fio([10, "out", "Óptimo. Para quando precisa? Se não houver pressa nenhuma, diga-me também."], [11, "in", "O quanto antes"], [12, "in", "Só preciso do orçamento"]);
    const texto = textoDaRajada(msgs);
    expect(texto).toBe("O quanto antes\nSó preciso do orçamento");
    expect(aPerguntaFoiFeita(msgs, "fatura")).toBe(false);
    const partes = lerAsPartesDaRajada(antes, texto, AGORA, false);
    expect(partes.perguntaPorFazer).toBe(true);
    const r = comModelo
      ? responderComCompreensao(partes.estado, { intencao: "informar", campos: { quando: "o quanto antes", fatura: "não" } }, AGORA, {
          texto: partes.texto,
          jaCumprimentou: true,
          perguntaPorFazer: true,
        })
      : responderNaRecolha(partes.estado, partes.texto, AGORA, true, false, { perguntaPorFazer: true });
    expect(r.estado.passo).toBe("fatura");
    expect(r.estado.dados.precisaFatura).toBeUndefined();
    expect(r.resposta).not.toMatch(/Peço desculpa|não apanhei|não percebi/);
    expect(r.resposta.endsWith("Deseja fatura? (aplica-se IVA de 23%)")).toBe(true);
  });

  it.each(CAMINHOS)("a descrição e a vaga em duas execuções: a carrinha não volta, segue a data (%s)", (_, comModelo) => {
    const antes: EstadoDaRecolha = {
      passo: "estacionamento",
      dados: { serviceType: "recolha_moveis", contactName: NOME, address: RUA, floor: "2", postalCode: CODIGO, city: "Algés", hasElevator: "no", description: DESCRICAO },
    };
    const partes = lerAsPartesDaRajada(antes, `${DESCRICAO}\nConsegue se tiver vaga`, AGORA, true);
    expect(partes.texto).toBe("Consegue se tiver vaga");
    const r = comModelo
      ? responderComCompreensao(partes.estado, { intencao: "informar", campos: { estacionamento: "sim" } }, AGORA, {
          texto: partes.texto,
          jaCumprimentou: true,
        })
      : responderNaRecolha(partes.estado, partes.texto, AGORA, true, false, {});
    expect(r.estado.dados.parkingDistance).toBe("near");
    expect(passoDaPergunta(r.resposta)).toBe("quando");
  });

  it("a pergunta que saiu e não teve resposta repete-se UMA vez por outras palavras — sem desculpas, e a factura igual", () => {
    const e: EstadoDaRecolha = {
      passo: "estacionamento",
      dados: { serviceType: "recolha_moveis", contactName: NOME, address: RUA, floor: "2", postalCode: CODIGO, city: "Algés", hasElevator: "no" },
    };
    const r = responderNaRecolha(e, DESCRICAO, AGORA, true, false, {});
    expect(r.estado.passo).toBe("estacionamento");
    expect(r.resposta).toBe(`Obrigada, fica anotado. ${deOutraForma("estacionamento", r.estado.dados)}`);
    expect(r.resposta).not.toContain("E a carrinha consegue encostar à porta");
    expect(deOutraForma("fatura", {})).toBe("Deseja fatura? (aplica-se IVA de 23%)");
    // A outra forma também se lê como a pergunta do mesmo passo (o fio, a Mesa, «Reler e continuar»).
    for (const passo of ["codigoPostal", "andar", "elevador", "estacionamento", "quando", "descricao", "entulhoQuantidade"] as const) {
      expect(passoDaPergunta(deOutraForma(passo, { postalCode: CODIGO })), passo).toBe(passo);
    }
  });
});

describe("esperar por quem escreve em partes", () => {
  const com = (pergunta: string, ...dele: string[]): MensagemComId[] => [
    { id: 1, direccao: "out", texto: pergunta },
    ...dele.map((texto, i) => ({ id: i + 2, direccao: "in", texto })),
  ];
  const CP = "Obrigada! E o código postal, com a localidade?";
  const MORADA = "Qual é a morada, por favor? Rua, número e andar, e o código postal se o tiver — é por aí que o profissional se orienta.";

  it("o código postal sem a localidade, ou a rua sem o código postal, esperam mais", () => {
    expect(esperaPorQuemEscreveEmPartes(com(CP, CODIGO))).toBe(ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS);
    expect(esperaPorQuemEscreveEmPartes(com(MORADA, RUA))).toBe(ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS);
    expect(esperaPorQuemEscreveEmPartes(com(MORADA, RUA, "2º andar"))).toBe(ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS);
  });

  it("a resposta inteira, ou outra pergunta qualquer, não esperam nada", () => {
    expect(esperaPorQuemEscreveEmPartes(com(CP, CODIGO, "Algés"))).toBe(0);
    expect(esperaPorQuemEscreveEmPartes(com(CP, `${CODIGO} Algés`))).toBe(0);
    expect(esperaPorQuemEscreveEmPartes(com(MORADA, `${RUA}, 2º andar, ${CODIGO} Algés`))).toBe(0);
    expect(esperaPorQuemEscreveEmPartes(com("E há elevador no prédio?", "Não"))).toBe(0);
    // A equipa à mão não é a pergunta da Vitória.
    expect(esperaPorQuemEscreveEmPartes(com(`[à mão] ${CP}`, CODIGO))).toBe(0);
  });

  it("nunca põe a ponte perto dos 30 s: a janela e a espera somadas ficam em metade disso", () => {
    expect(JANELA_DA_RAJADA_MS).toBe(8_000);
    expect(JANELA_DA_RAJADA_MS + ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS).toBeLessThanOrEqual(15_000);
    // E não se soma à das imagens: a rota só a usa quando há texto.
    const ROTA = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ROTA).toMatch(/\} else if \(depoisDaEspera\.length > 0\) \{[\s\S]*?esperaPorQuemEscreveEmPartes\(depoisDaEspera\)/);
    expect(ESPERA_DAS_IMAGENS_MS).toBe(15_000);
  });
});

describe("as partes da rajada, uma a uma", () => {
  const base: DadosDaRecolha = { serviceType: "recolha_moveis", contactName: NOME };

  it("lê cada mensagem contra a pergunta desse momento, e deixa a última para a leitura de sempre", () => {
    const p = lerAsPartesDaRajada({ passo: "morada", dados: base }, `${RUA}\n2º andar\n${CODIGO}\nAlgés`, AGORA);
    expect(p.estado.dados.address).toBe(RUA);
    expect(p.estado.dados.floor).toBe("2");
    expect(p.estado.dados.postalCode).toBe(CODIGO);
    expect(p.texto).toBe("Algés");
    expect(p.perguntaPorFazer).toBe(true);
  });

  it("uma mensagem só, o serviço por saber ou o resumo: tudo como veio", () => {
    expect(lerAsPartesDaRajada({ passo: "morada", dados: base }, RUA, AGORA).texto).toBe(RUA);
    expect(lerAsPartesDaRajada({ passo: "servico", dados: {} }, "olá\nsofá", AGORA).texto).toBe("olá\nsofá");
    expect(lerAsPartesDaRajada({ passo: "confirmar", dados: base }, "sim\nobrigada", AGORA).texto).toBe("sim\nobrigada");
  });

  it("as frases que mandam na conversa ficam para o fim — pedir uma pessoa, desistir, perguntar", () => {
    const p = lerAsPartesDaRajada({ passo: "andar", dados: base }, "quero falar com alguém\n2º andar", AGORA);
    expect(p.texto).toBe("quero falar com alguém\n2º andar");
  });

  it("a localidade sozinha e a vaga à porta são respostas de antes; um sim, uma data ou coisas não são localidades", () => {
    expect(localidadeSolta("Algés")).toBe(true);
    expect(localidadeSolta("Vila Franca de Xira")).toBe(true);
    for (const t of ["Não", "Sim", "O quanto antes", "um sofá", "Consegue se tiver vaga", "1495-123", "amanhã"]) {
      expect(localidadeSolta(t), t).toBe(false);
    }
    const d: DadosDaRecolha = { postalCode: CODIGO };
    expect(aproveitarRespostaAtrasada(d, "Algés")).toBe(true);
    expect(d.city).toBe("Algés");
    const e: DadosDaRecolha = { postalCode: CODIGO, city: "Algés" };
    expect(aproveitarRespostaAtrasada(e, "Consegue se tiver vaga")).toBe(true);
    expect(e.parkingDistance).toBe("near");
    // Com a localidade dada, uma palavra solta já não a muda.
    expect(aproveitarRespostaAtrasada({ postalCode: CODIGO, city: "Algés" }, "Lisboa")).toBe(false);
  });

  it("«só preciso do orçamento» e o que não é para fazer lêem-se; o resto não", () => {
    for (const t of ["Só preciso do orçamento", "só quero o preço", "É só para orçamento", "apenas o orçamento"]) {
      expect(soQuerOOrcamento(t), t).toBe(true);
    }
    for (const t of ["Não preciso de fatura", "Preciso de orçamento para sexta e da fatura", "O quanto antes"]) {
      expect(soQuerOOrcamento(t), t).toBe(false);
    }
    for (const t of ["Só não é preciso tirar o frigorífico", "o frigorífico fica", "menos o sofá", "não levar o colchão"]) {
      expect(excluiDoTrabalho(t), t).toBe(true);
    }
    for (const t of ["é para tirar o frigorífico", "um sofá e uma cama", "Não é necessário"]) {
      expect(excluiDoTrabalho(t), t).toBe(false);
    }
  });
});

/* ── Depois do registo ─────────────────────────────────────────────────── */

const PEDIDO: PedidoDaBase = {
  id: 853, // número inventado
  status: "sem_assistente",
  serviceType: "recolha_moveis",
  contactName: NOME,
  address: RUA,
  city: "Algés",
  postalCode: CODIGO,
  floor: "2",
  hasElevator: "no",
  parkingDistance: "easy",
  description: `Preciso de recolha de móveis. ${DESCRICAO}`,
  filesJson: null,
  createdAt: "2026-10-27T11:20:00Z",
};

function depoisDoRegisto(texto: string, extra: Partial<ContextoDoPedidoAberto> = {}, guardados?: DadosDaRecolha) {
  const dados = dadosDaConversaNoPedido(PEDIDO, (guardados ?? null) as Record<string, unknown> | null);
  const estado: EstadoDaRecolha = { passo: primeiroPassoEmFalta(dados), dados };
  return responderNoPedidoAberto(estado, texto, AGORA, {
    pedido: pedidoNaConversa(PEDIDO),
    primeira: true,
    // A Vitória falou do pedido no fio («Pedido #853 registado!»): não se volta a apresentar.
    colegaJaFalou: true,
    jaSeApresentou: true,
    ...extra,
  });
}

describe("depois do registo, a Vitória continua", () => {
  it("«Pode ser um vídeo? Por que mostro com mais detalhes» — sim, por aqui", () => {
    const r = depoisDoRegisto("Pode ser um video?\nPor que mostro com mais detalhes");
    expect(r.resposta).toContain(PODE_MANDAR_IMAGENS);
    expect(r.resposta).not.toContain(PERGUNTA_ANOTADA);
    expect(r.pedirPessoa).toBeFalsy();
    expect(r.novoPedido).toBeFalsy();
  });

  it("os vídeos e «Só não é preciso tirar o frigorífico» vão para a nota do pedido — tal e qual, sem apagar nada", () => {
    const r = depoisDoRegisto("Só não é preciso tirar o frigorífico", { primeira: false });
    expect(r.estado.dados.notas).toEqual(["Só não é preciso tirar o frigorífico"]);
    expect(r.resposta).toContain("Fica anotado no seu pedido #853: «Só não é preciso tirar o frigorífico».");
    const bloco = blocoDoWhatsApp(oQueEDaConversa(dadosDoPedido(PEDIDO), r.estado.dados), 0) ?? "";
    expect(bloco).toContain("Notas (ditas pelo cliente): Só não é preciso tirar o frigorífico.");
    // O frigorífico NÃO é para levar.
    expect(bloco).not.toMatch(/Para levar:[^\n]*frigor/i);
    // E a nota dos vídeos (escrita pela rota: o vídeo não se descarrega) fica ao lado.
    const comVideos = depoisDoRegisto("", { primeira: false, imagensNovas: 2 }, {
      pedidoAberto: 853,
      notas: ["Mandou 2 vídeos pelo WhatsApp — ver na conversa", "Só não é preciso tirar o frigorífico"],
    });
    expect(comVideos.resposta).toContain("Obrigada pelas imagens");
    const blocoDosVideos = blocoDoWhatsApp(oQueEDaConversa(dadosDoPedido(PEDIDO), comVideos.estado.dados), 0) ?? "";
    expect(blocoDosVideos).toContain("Mandou 2 vídeos pelo WhatsApp — ver na conversa.");
  });

  it("«Não entendi, o que é a carga? A carrinha?» — a mesma frase da nota da proposta", () => {
    const r = depoisDoRegisto("Não entendi, o que é a carga?\nA carrinha?");
    expect(r.resposta).toContain(O_QUE_E_A_CARGA);
    // Uma constante, nos dois lados: a nota «por carga» da proposta e a resposta dela.
    expect(O_QUE_E_A_CARGA.toLowerCase()).toContain(O_QUE_E_UMA_CARGA);
    expect(notaDaCargaParaOCliente("carga")).toContain(O_QUE_E_UMA_CARGA);
    expect(notaDoPrecoParaOCliente("carga", "clyon")).toContain(O_QUE_E_UMA_CARGA);
  });

  it("as perguntas frequentes respondem-se com as frases do site", () => {
    expect(respostaFrequente("Quando recebo as propostas?")).toBe(PROMESSA_DO_PRAZO);
    expect(respostaFrequente("Dá para ser hoje?")).toBe(NO_MESMO_DIA);
    expect(respostaFrequente("O preço já inclui IVA?")).toBe(O_IVA_NA_PROPOSTA);
    expect(respostaFrequente("Vocês trazem big bags?")).toBe(RESPOSTA_SOBRE_CONTENTORES);
    expect(respostaFrequente("São vocês que fazem o trabalho?")).toBe(QUEM_FAZ_O_TRABALHO);
    expect(respostaFrequente("Posso pagar em dinheiro?")).toBe(COMO_SE_PAGA);
    // O que não reconhece fica para a equipa, como sempre.
    expect(respostaFrequente("Vocês levam também o lixo do quintal ao domingo?")).toBeNull();
    expect(respostaFrequente("Só não é preciso tirar o frigorífico")).toBeNull();
    expect(respostaFrequente("envio as fotos")).toBeNull();
    expect(depoisDoRegisto("O vizinho também pode aproveitar?").resposta).toContain(PERGUNTA_ANOTADA);
  });

  it("na voz da Vitória: nunca «IA» nem «virtual», nunca «próprio dia», o IVA ao lado do sem IVA", () => {
    const todas = [PODE_MANDAR_IMAGENS, O_QUE_E_A_CARGA, O_IVA_NA_PROPOSTA, PROMESSA_DO_PRAZO, NO_MESMO_DIA, QUEM_FAZ_O_TRABALHO, COMO_SE_PAGA].join("\n");
    expect(todas).not.toMatch(/\bIA\b|virtual|intelig[eê]ncia artificial|pr[oó]prio dia/i);
    expect(O_IVA_NA_PROPOSTA).toMatch(/IVA incluído/);
    expect(O_IVA_NA_PROPOSTA).toMatch(/sem IVA/);
    // Quem faz é o profissional escolhido, e não a CLYON.
    expect(QUEM_FAZ_O_TRABALHO).toMatch(/feito pelo profissional que escolher/);
  });
});

/* ── Onde isto está ligado ─────────────────────────────────────────────── */

function ler(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("está ligado na conversa viva", () => {
  it("a rota corre a resposta dentro da rajada, com a última mensagem lida, e manda os vídeos", () => {
    const ROTA = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ROTA).toMatch(/dentroDaRajada\(\{ telefone, ultimaLida: ultimaMensagemLida\(agora\) \}/);
    expect(ROTA).toMatch(/videos = agora\.length > 0 \? videosDaRajada\(agora\) : 0/);
    expect(videosDaRajada([{ id: 1, direccao: "in", texto: "[vídeo]" }, { id: 2, direccao: "in", texto: "[fotografia]" }])).toBe(1);
  });

  it("o envio cala a pergunta que já não serve", () => {
    const CLOUD = ler("src/lib/whatsapp-cloud.ts");
    const envio = CLOUD.slice(CLOUD.indexOf("export async function enviarTextoWhatsApp"));
    expect(envio.indexOf("calarAPerguntaPorChegarOutra")).toBeGreaterThan(-1);
    expect(envio.indexOf("calarAPerguntaPorChegarOutra")).toBeLessThan(envio.indexOf("return enviarTextoPorCanal(para, texto);"));
  });

  it("a recolha lê a rajada por partes, e sabe se a pergunta em cima saiu", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    expect(NEG).toMatch(/lerAsPartesDaRajada\(e, texto, agora, aPerguntaFoiFeita\(fio, e\.passo\)\)/);
    expect(NEG).toMatch(/perguntaPorFazer: partes\.perguntaPorFazer/);
  });

  it("depois do registo, as perguntas do site e o que não é para fazer respondem-se ANTES da tradução para a negociação", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente"));
    const faq = corpo.indexOf("respostaDoSiteOuDasLicoes(conteudo.texto, { contar: false }) || linhas.some((l) => excluiDoTrabalho(l))");
    expect(faq).toBeGreaterThan(-1);
    expect(faq).toBeLessThan(corpo.indexOf("await traduzirParaAMaquina("));
  });

  it("a pergunta da factura fica exactamente como está", () => {
    const RECOLHA = ler("src/lib/whatsapp-recolha.ts");
    expect(RECOLHA).toContain("const DESEJA_FACTURA = `Deseja fatura? (aplica-se IVA de ${PERCENTAGEM_DO_IVA})`;");
  });
});
