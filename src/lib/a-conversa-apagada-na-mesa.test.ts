import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  jaCumprimentouNesteFio,
  notaDoPrecoPara,
  primeiraPerguntaDoServico,
  primeiroPassoEmFalta,
  recolhaNova,
  responderNaRecolha,
  SALTO_DA_PERGUNTA,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import { jaFalouComEle, nomeDitoPelaEquipa, oQueRespondeAEquipa } from "./o-que-a-equipa-ja-disse";
import { comONomeJaSabido, responderAoColega } from "./resposta-ao-colega-na-recolha";
import { estimativaDoEntulhoDito } from "./preco-do-entulho-na-conversa";
import { faixaSemEComIva } from "./preco-de-referencia";
import { MINIMO_DE_SACOS, precoDosSacos } from "./precos-publicos";
import { adiaAsFotografias, FICA_ANOTADO, fotografiasParaDepois, PODE_ENVIAR_MAIS_TARDE, semRepetirAPergunta } from "./nao-insistir";

/**
 * A CONVERSA APAGADA NA MESA — 16-11-2026 (d51, acrescentos do dono).
 *
 * O caso verdadeiro, com o nome e as moradas INVENTADOS (o repositório é
 * público). A conversa foi apagada na Mesa do WhatsApp, e um colega escreveu
 * à mão no telemóvel:
 *
 *   EQUIPA:  Boa tarde, Anselmo!
 *   EQUIPA:  O material é entulho? se sim quantos sacos?
 *   CLIENTE: Sim são 15 sacos            (a responder, citando a pergunta)
 *   VITÓRIA: Com todo o gosto! Fica anotado: recolha de entulho. Com quem
 *            tenho o gosto de falar?
 *   EQUIPA:  Qual é o endereço senhor Anselmo?
 *   CLIENTE: Rua das Flores 12, Benfica
 *   VITÓRIA: Boa tarde! Aqui é a Vitória, assistente online da CLYON… Fica
 *            anotada a morada. Em que posso ajudar?
 *
 * Devia: não se apresentar (a CLYON já lhe estava a escrever), não perguntar
 * o nome (a equipa já o tinha dito), e guardar os 15 sacos como o simulador.
 */

const AGORA = new Date("2026-11-16T15:10:00Z");
const MAO = "[à mão]";

const OLA = { direccao: "out", texto: `${MAO} Boa tarde, Anselmo!` };
const SACOS = { direccao: "out", texto: `${MAO} O material é entulho? se sim quantos sacos?` };
const ENDERECO = { direccao: "out", texto: `${MAO} Qual é o endereço senhor Anselmo?` };

describe("1. quem a CLYON já está a atender não ouve a apresentação", () => {
  it("uma mensagem da equipa no fio (à mão ou pelo backoffice) chega", () => {
    expect(jaFalouComEle([ENDERECO, { direccao: "in", texto: "Rua das Flores 12, Benfica" }])).toBe(true);
    expect(jaFalouComEle([{ direccao: "out", texto: "Qual é o endereço?" }])).toBe(true);
    expect(jaCumprimentouNesteFio([ENDERECO])).toBe(true);
    // A apresentação de antes conta como sempre.
    expect(jaFalouComEle([{ direccao: "out", texto: "Boa tarde! Aqui é a Vitória, assistente online da CLYON" }])).toBe(true);
  });

  it("um aviso automático sozinho, um fio vazio ou uma conversa de há dois meses não contam", () => {
    expect(jaFalouComEle([])).toBe(false);
    expect(jaFalouComEle([{ direccao: "out", texto: "Pedido #900 registado! Muito obrigada." }])).toBe(false);
    expect(jaFalouComEle([{ direccao: "out", texto: "Recebemos o seu pedido de recolha. Obrigada!" }])).toBe(false);
    expect(jaFalouComEle([{ ...ENDERECO, haSegundos: 60 * 24 * 3600 }])).toBe(false);
    // Mas o mesmo aviso escrito à mão por um colega conta.
    expect(jaFalouComEle([{ direccao: "out", texto: `${MAO} Recebemos o seu pedido de recolha (#900).` }])).toBe(true);
  });

  it("a morada da resposta ao colega fica, e segue sem se apresentar — com o nome e a terra", () => {
    const e = comONomeJaSabido(recolhaNova(), [OLA, SACOS, ENDERECO], null);
    const r = responderNaRecolha(e, "Rua das Flores 12, Benfica", AGORA, true, false, { fotos: 0 });
    expect(r.estado.dados.address).toBe("Rua das Flores 12, Benfica");
    const resposta = primeiraPerguntaDoServico(r.estado.dados, 0, false, AGORA, true);
    expect(resposta.startsWith("Obrigada, Anselmo, fica anotada a morada em Benfica.")).toBe(true);
    expect(resposta).toMatch(/o que é para levar/);
    expect(resposta).not.toMatch(/Aqui é a Vitória|Boa tarde!|Em que posso ajudar/);
    // A quem nunca falou com ninguém, a apresentação continua.
    expect(primeiraPerguntaDoServico({}, 0, false, AGORA)).toMatch(/Vitória, assistente online da CLYON/);
  });
});

describe("2. o nome que a equipa já disse não se pergunta", () => {
  it("«Boa tarde, Anselmo!», «senhor Anselmo», «Olá D. Odete»", () => {
    expect(nomeDitoPelaEquipa([OLA])).toBe("Anselmo");
    expect(nomeDitoPelaEquipa([ENDERECO])).toBe("Anselmo");
    expect(nomeDitoPelaEquipa([{ direccao: "out", texto: "Olá D. Odete, tudo bem?" }])).toBe("Odete");
    expect(nomeDitoPelaEquipa([{ direccao: "out", texto: "Boa tarde! Como posso ajudar?" }])).toBeNull();
    expect(nomeDitoPelaEquipa([{ direccao: "in", texto: "Boa tarde, Anselmo aqui" }])).toBeNull();
  });

  it("sem nome no fio, vale o de um pedido anterior do número; e o que ele já tem não muda", () => {
    expect(comONomeJaSabido(recolhaNova(), [], "Anselmo Ribeiro").dados.contactName).toBe("Anselmo Ribeiro");
    const comNome: EstadoDaRecolha = { passo: "servico", dados: { contactName: "Leonor Prates" } };
    expect(comONomeJaSabido(comNome, [OLA], "Anselmo Ribeiro").dados.contactName).toBe("Leonor Prates");
    // A pergunta do nome em cima passa à seguinte.
    const noNome: EstadoDaRecolha = { passo: "nome", dados: { serviceType: "recolha_entulho" } };
    expect(comONomeJaSabido(noNome, [OLA], null).passo).not.toBe("nome");
  });
});

describe("3. «Sim são 15 sacos» à pergunta do colega fica como o simulador grava", () => {
  it("recolha de entulho, 15 sacos — e não a morada", () => {
    expect(oQueRespondeAEquipa([OLA, SACOS, { direccao: "in", texto: "Sim são 15 sacos" }], "Sim são 15 sacos")).toEqual({
      serviceType: "recolha_entulho",
      entulhoQuantidade: "15 sacos",
    });
    const e = comONomeJaSabido(recolhaNova(), [OLA, SACOS], null);
    const r = responderAoColega(e, "Sim são 15 sacos", [OLA, SACOS])!;
    expect(r.estado.dados).toMatchObject({ serviceType: "recolha_entulho", entulhoQuantidade: "15 sacos", contactName: "Anselmo" });
    expect(r.estado.dados.address).toBeUndefined();
    expect(r.resposta.startsWith("Obrigada, Anselmo! Fica anotado: recolha de entulho, 15 sacos.")).toBe(true);
    expect(r.resposta).not.toMatch(/Com quem tenho o gosto|Com todo o gosto/);
    expect(r.estado.passo).toBe(primeiroPassoEmFalta(r.estado.dados));
  });

  it("sem pergunta do colega, ou com um «não», lê-se como sempre", () => {
    expect(responderAoColega(recolhaNova(), "Sim são 15 sacos", [])).toBeNull();
    expect(oQueRespondeAEquipa([SACOS], "Não, são móveis")).toEqual({});
    expect(responderAoColega(recolhaNova(), "Sim são 15 sacos", [{ direccao: "out", texto: "Pedido #900 registado! Obrigada." }])).toBeNull();
  });
});

describe("4. o preço com a quantidade já dita sai da grelha", () => {
  it("15 sacos: a faixa da fonte única, com o IVA ao lado e as propostas dos parceiros", () => {
    const { de, ate } = precoDosSacos(15);
    const e = estimativaDoEntulhoDito("15 sacos")!;
    expect(e).toContain(`15 sacos ficam em ${faixaSemEComIva(de, ate)}`);
    expect(e).toMatch(/com IVA/);
    expect(e).toContain("o valor final vem das propostas dos parceiros");
    const nota = notaDoPrecoPara("Quanto fica?", "morada", false, "recolha_entulho", "15 sacos");
    expect(nota).toContain(faixaSemEComIva(de, ate));
  });

  it("abaixo do mínimo conta o mínimo da recolha; sem quantidade, ou noutro serviço, nada", () => {
    const { de, ate } = precoDosSacos(MINIMO_DE_SACOS);
    expect(estimativaDoEntulhoDito("5 sacos")).toContain(`mínimo de uma recolha (${MINIMO_DE_SACOS} sacos) em ${faixaSemEComIva(de, ate)}`);
    expect(estimativaDoEntulhoDito(null)).toBeNull();
    expect(notaDoPrecoPara("Quanto fica?", "morada", false, "recolha_monos", "15 sacos")).not.toMatch(/grelha do entulho/);
  });
});

describe("5. não insistir", () => {
  const PEDIU_FOTOS = { direccao: "out", texto: "Se tiver fotografias do que é para levar, envie-as por aqui." };

  it("«Não consigo enviar agora» às fotografias: pode enviar mais tarde, e segue", () => {
    expect(adiaAsFotografias("Não consigo enviar agora")).toBe(true);
    expect(adiaAsFotografias("depois envio")).toBe(true);
    expect(adiaAsFotografias("envio as fotos amanhã")).toBe(true);
    expect(adiaAsFotografias("Rua das Flores 12")).toBe(false);
    const e: EstadoDaRecolha = { passo: "descricao", dados: { serviceType: "recolha_monos", contactName: "Anselmo" } };
    const r = fotografiasParaDepois(e, "Não consigo enviar agora", [PEDIU_FOTOS])!;
    expect(r.resposta.startsWith(PODE_ENVIAR_MAIS_TARDE)).toBe(true);
    expect(r.estado.passo).not.toBe("descricao");
    // Sem lhe terem pedido fotografias, e sem falar delas, não é isto.
    expect(fotografiasParaDepois(e, "Não consigo agora", [{ direccao: "out", texto: "Qual é a morada?" }])).toBeNull();
  });

  it("a mesma pergunta não sai duas vezes seguidas — e o nome só uma vez", () => {
    const fio = [{ direccao: "out", texto: "Com quem tenho o gosto de falar?" }, { direccao: "in", texto: "sim" }];
    const ia: RespostaDaRecolha = {
      estado: { passo: "nome", dados: { serviceType: "recolha_entulho", entulhoQuantidade: "15 sacos" } },
      resposta: "Peço desculpa, não apanhei bem. Com quem tenho o gosto de falar?",
    };
    const r = semRepetirAPergunta(ia, fio);
    // Ele respondeu («sim»): desde a d69 (18-11-2026) a resposta fica como veio, e segue-se — sem «fica para depois».
    expect(r.resposta.startsWith(FICA_ANOTADO)).toBe(true);
    expect(r.resposta).not.toContain(SALTO_DA_PERGUNTA);
    expect(r.estado.passo).not.toBe("nome");
    expect(r.estado.dados.saltados).toContain("nome");
    // Uma pergunta nova passa como está.
    const outra: RespostaDaRecolha = { ...ia, resposta: "Qual é a morada? Preciso da rua e do número.", estado: { ...ia.estado, passo: "morada" } };
    expect(semRepetirAPergunta(outra, fio)).toBe(outra);
    // A pergunta da equipa à mão não é dela: não conta como repetida.
    expect(semRepetirAPergunta(ia, [{ direccao: "out", texto: `${MAO} Com quem tenho o gosto de falar?` }])).toBe(ia);
  });
});

describe("6. quem chama", () => {
  const NEG = readFileSync(join(__dirname, "whatsapp-negociacao.ts"), "utf8");
  it("a recolha usa as regras novas", () => {
    expect(NEG).toContain("responderAoColega(e, texto, fio)");
    expect(NEG).toContain("fotografiasParaDepois(e, texto, fio)");
    expect(NEG).toContain("semRepetirAPergunta(");
    expect(NEG).toContain("comONomeJaSabido(");
    expect(NEG).toContain("nomeDosPedidosAnteriores(telefone)");
    expect(NEG).toContain("primeiraPerguntaDoServico(sabido, imagensNovas, !compreensaoDisponivel(), agora, jaCumprimentouNesteFio(fio))");
  });
});
