import { describe, it, expect } from "vitest";
import {
  COMO_CHEGA_O_PRECO,
  LEMBRETE_DO_PRECO,
  O_IVA_ESTA_INCLUIDO,
  recolhaNova,
  responderNaRecolha,
  resumo,
  type ContextoDaRecolha,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { camposDaRecolha, descricaoParaOPedido } from "./pedido-da-recolha";
import { separarAcessoDaMorada } from "./leitor-da-recolha";

/**
 * A MUDANÇA DO LEOPOLDO — 10-10-2026, 21:45 em Lisboa (22:45 na captura).
 *
 * O caso é verdadeiro; o nome, a morada, o código postal e a hora são
 * INVENTADOS (o repositório é público — 31-10-2026, d1).
 *
 * *«Ele fez tudo errado, corrija o assistente.»* — o dono, com a conversa e o
 * formulário «Criar pedido desta conversa» aberto. Respondeu outra vez o
 * caminho sem Gemini, e ele tinha escrito TUDO na primeira mensagem: as duas
 * moradas com rótulo, o elevador dos dois prédios, as datas, a lista e o
 * serviço com embalagem. Ouviu a morada de destino perguntada outra vez, «A
 * porta de ambos» não percebido, o NIF pedido a quem perguntava o preço, e um
 * resumo com «domingo, 31 de janeiro às 09:00». O formulário saiu com
 * «Elevador no destino: não perguntei» e sem a embalagem na descrição.
 */

const AGORA = new Date("2026-10-10T21:45:00+01:00");

const PRIMEIRA = `Olá,tudo bem?

Gostaria de pedir um orçamento para uma pequena mudança dentro dos Olivais, em Lisboa, preferencialmente num sábado 31/10 ou domingo 01/11

Morada de origem: Rua das Nespereiras Bravas, 23, cave saída para rua a porta ja e na calcada Olivais.
Morada de destino: Rua dos Loendros Roxos, 218, Olivais.

As duas moradas ficam a poucas ruas de distância e ambos os prédios têm elevador.

Preciso de um serviço que inclua embalagem dos meus pertences e transporte, pois não pretendo encaixotar tudo antecipadamente.

Os artigos a transportar incluem:

* 2 cadeiras;
* Roupas nao muitas sou solteiro e utensílios de cozinha pratos copos nao mts tambem
* Pequenos eletrodomésticos de cozinha
* Duas televisões, uma de 65 polegadas e outra de 32 polegadas, que precisam de proteção adequada;
* Possivelmente uma máquina de lavar roupa 10kl e um sofá-cama 2 lugares dependendo de conseguir vendê-los antes da mudança.

Gostaria de receber duas opções de orçamento: uma com a máquina de lavar e o sofá-cama e outra sem esses artigos.

Procuro um serviço com carrinha e profissionais responsáveis pela embalagem, carga, transporte e descarga. Nao é necessário desembalar e arrumar

Podem, por favor, indicar o preço total fechado, incluindo materiais de embalagem, mão de obra, transporte e eventuais suplementos de fim de semana?
Agradeço também a confirmação de que o IVA está incluído no valor apresentado.
Obrigado`;

function falaComOLeopoldo() {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  const dizer = (texto: string, contexto: ContextoDaRecolha = {}) => {
    const r = responderNaRecolha(estado, texto, AGORA, disse.length > 0, false, {
      jaExplicouOPreco: disse.some((m) => m.includes(COMO_CHEGA_O_PRECO)),
      ...contexto,
    });
    estado = r.estado;
    disse.push(r.resposta);
    return r;
  };
  const RESPOSTAS: Array<[RegExp, string]> = [
    [/Com quem (estou a falar|tenho o gosto)/, "Leopoldo teixo"],
    [/código postal do destino/, "1800-322 olivais lisboa"],
    [/código postal/, "1800-321 Lisboa olivais"],
    [/encostar a carrinha|carrinha consegue encostar|parar à porta/, "A porta de ambos"],
    // Não lho perguntaram na conversa verdadeira: um andar qualquer.
    [/no destino, em que andar/, "2º andar"],
    [/Qual é o NIF|ler o NIF/, "Depois"],
    [/Quer a factura|Deseja fa(c)?tura/, "Sim"],
  ];
  dizer(PRIMEIRA);
  for (let volta = 0; volta < 15 && estado.passo !== "confirmar"; volta++) {
    const pergunta = disse[disse.length - 1];
    const resposta = RESPOSTAS.find(([re]) => re.test(pergunta))?.[1];
    if (!resposta) throw new Error(`O Leopoldo não sabe responder a: ${pergunta}`);
    dizer(resposta);
  }
  return { estado: () => estado, disse, dizer };
}

describe("a mudança do Leopoldo", () => {
  it("a primeira mensagem dá as duas moradas, o elevador dos dois prédios e a data", () => {
    const { estado } = falaComOLeopoldo();
    const d = estado().dados;
    expect(d.serviceType).toBe("mudanca");
    // Desde 26-10-2026 a morada é só a rua e o número; a cave fica no andar.
    expect(d.address).toBe("Rua das Nespereiras Bravas, 23");
    expect(d.floor).toBe("-1");
    expect(d.hasElevator).toBe("yes");
    expect(d.moradaDestino).toBe("Rua dos Loendros Roxos, 218, Olivais");
    expect(d.elevadorDestino).toBe("yes");
    // «sábado 31/10» — e não «31/1», cortado aos 120 caracteres.
    expect(new Date(d.dataDesejada!).toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(d.quandoTexto).toContain("sábado 31/10 ou domingo 01/11");
  });

  it("o resto da linha da morada é o acesso, e não a rua", () => {
    expect(separarAcessoDaMorada("Rua das Nespereiras Bravas, 23, cave saída para rua a porta ja e na calcada Olivais.")).toEqual({
      morada: "Rua das Nespereiras Bravas, 23, cave",
      acesso: "saída para rua a porta ja e na calcada Olivais",
    });
    // E o lado da porta continua a ser morada.
    expect(separarAcessoDaMorada("Travessa dos Melros Azuis, 9, R/C Esq.").acesso).toBeNull();
    expect(separarAcessoDaMorada("Rua X 12, 2º Esq, Edifício B").acesso).toBeNull();
  });

  it("a primeira resposta responde ao preço e ao IVA que ele perguntou", () => {
    const { disse } = falaComOLeopoldo();
    expect(disse[0]).toContain("Fica anotado: mudança.");
    expect(disse[0]).toContain(COMO_CHEGA_O_PRECO);
    expect(disse[0]).toContain(O_IVA_ESTA_INCLUIDO);
    expect(disse[0]).toContain("Com quem tenho o gosto de falar?");
  });

  it("não se lhe pergunta o destino que ele deu, e pergunta-se o acesso de lá", () => {
    const { disse } = falaComOLeopoldo();
    const tudo = disse.join("\n");
    expect(tudo).not.toContain("Para onde é a mudança");
    expect(tudo).toContain("E o código postal do destino?");
    expect(tudo).toContain("no destino, em que andar");
    // O elevador e o estacionamento do destino já estavam ditos («ambos»).
    expect(tudo).not.toContain("No destino há elevador");
    expect(tudo).not.toContain("no destino, a carrinha");
    expect(tudo).not.toContain("Desculpe, não percebi: a carrinha");
  });

  it("«A porta de ambos» é estacionar à porta — na origem e no destino", () => {
    const d = falaComOLeopoldo().estado().dados;
    expect(d.parkingDistance).toBe("near");
    expect(d.estacionamentoDestino).toBe("near");
  });

  it("«Gostaria de saber o valor primeiro», à pergunta do NIF, tem resposta", () => {
    /*
     * Desde 13-10-2026 o NIF já não se pede na recolha (o dono). Uma conversa
     * gravada à espera dele responde ao preço e segue para o que falta.
     */
    const base: EstadoDaRecolha = {
      passo: "nif",
      dados: { serviceType: "mudanca", contactName: "Leopoldo Teixo", precisaFatura: true },
    };
    const r = responderNaRecolha(base, "Gostaria de saber o valor primeiro", AGORA, true, false, {
      jaExplicouOPreco: true,
    });
    expect(r.resposta).toContain(LEMBRETE_DO_PRECO);
    expect(r.resposta).not.toContain("NIF");
    expect(r.estado.passo).toBe("morada");
  });

  it("o resumo diz as duas datas à escolha sem uma hora que ele não deu, e as duas pontas", () => {
    const r = resumo(falaComOLeopoldo().estado().dados);
    // As duas, pela ordem — nunca só uma (28-10-2026, decisão d35).
    expect(r).toContain("Quando: sábado 31/10 ou domingo 1/11\n");
    expect(r).not.toContain("janeiro");
    expect(r).not.toContain("09:00");
    expect(r).toContain("Na origem: andar cave · elevador: sim · estacionar à porta: sim");
    expect(r).toContain("No destino: andar 2 · elevador: sim · estacionar à porta: sim");
    expect(r).toContain("Morada: Rua das Nespereiras Bravas, 23, 1800-321, Lisboa olivais");
  });

  it("a descrição leva a embalagem e o «não é preciso desembalar», sem cumprimentos nem moradas", () => {
    const d = falaComOLeopoldo().estado().dados;
    expect(d.description).toContain("embalagem dos meus pertences");
    expect(d.description).toContain("Nao é necessário desembalar");
    expect(d.description).toContain("2 cadeiras");
    expect(d.description).toContain("duas opções de orçamento");
    expect(d.description).not.toContain("Olá");
    expect(d.description).not.toContain("Morada de");
    expect(d.description).not.toContain("IVA");
    expect(d.description).not.toMatch(/\nObrigado$/);
  });

  it("«E quero que embale as roupas» no resumo fica no pedido, sem «Para registar responda SIM»", () => {
    const { estado } = falaComOLeopoldo();
    const r = responderNaRecolha(estado(), "E quero que embale as roupas e a mudança", AGORA, true);
    expect(r.estado.dados.description).toContain("E quero que embale as roupas e a mudança");
    expect(r.resposta).toContain("fica anotado no pedido");
    expect(r.resposta).not.toContain("Para registar responda SIM");
    expect(r.registar).toBeFalsy();
  });

  it("e o formulário do backoffice abre com o destino preenchido", () => {
    const d = falaComOLeopoldo().estado().dados;
    const c = camposDaRecolha("351930000102", d);
    expect(c.andarDestino).toBe("2");
    expect(c.elevadorDestino).toBe("yes");
    expect(c.estacionamentoDestino).toBe("easy");
    expect(c.moradaDestino).toBe("Rua dos Loendros Roxos, 218, Olivais");
    expect(c.address).toBe("Rua das Nespereiras Bravas, 23");
    expect(c.floor).toBe("cave");
    // O acesso e as duas datas à escolha vão na descrição.
    expect(c.description).toContain("Acesso (dito pelo cliente): saída para rua a porta");
    // As duas, pela ordem e arrumadas (28-10-2026, decisão d35); o campo de data fica com a primeira.
    expect(c.description).toContain("Quando: sábado 31/10 ou domingo 1/11 (ditas pelo cliente).");
    expect(d.dataDesejada?.slice(0, 10)).toBe("2026-10-31");
    expect(descricaoParaOPedido(d)).toBe(c.description);
  });
});
