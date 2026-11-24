import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * d90, d93 e a parte do I&D da d91 (CEO e dono, 23-11-2026) — as regras puras e
 * os textos. Números e nomes INVENTADOS (o repositório é público).
 * O relógio: datas explícitas em cada chamada que depende do modelo.
 */

import {
  aEquipaRespondeuEOClienteCalou,
  disseQueVaiPensar,
  NOTA_DO_VAI_PENSAR,
  respostaAoVaiPensar,
  voltarAmanhaAsDez,
} from "./o-cliente-vai-pensar";
import {
  aPerguntaDoCancelarVale,
  mensagemDoCancelamentoPeloCliente,
  pedidoNaFrase,
  porqueFicaComAEquipa,
  querCancelar,
  type OPedidoParaCancelar,
} from "./cancelar-pelo-cliente";
import {
  HORAS_DO_RASCUNHO,
  proximoPassoDaConversaParada,
  rascunhoAindaVale,
  textoDaConversaParada,
} from "./conversa-parada-a-meio";
import { chaveDoNumero } from "./nao-contactar";
import { passoDaPergunta } from "./reler-a-conversa";
import { mensagemDePedidoRegistado, oQueJaEstaAnotado, perguntaDo, perguntaParaContinuar, type DadosDaRecolha } from "./whatsapp-recolha";
import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";
import {
  AS_TRES_OPCOES,
  aUltimaSaidaE,
  textoDaConfirmacaoDoCancelamento,
  textoDoAvancarNumTrabalhoClyon,
  textoDoFechoAoCliente,
  textoDoLembrete,
  textoDoUltimoAviso,
  varianteDoLembrete,
} from "./validade-do-orcamento";
import {
  AS_OPCOES_DO_SEGUIMENTO,
  eMensagemDoSeguimento,
  paraEmail,
  proximoPassoDoSeguimento,
  textoDaMensagem1,
  textoDaMensagem2,
  textoDaMensagem3,
  varianteDaMensagem1,
} from "./seguimento-do-cliente";
import { mensagemDoQueFalta } from "./mensagem-do-que-falta";
import { assuntoDoLembrete, eLembreteDoQueFalta, textoDoArquivo, textoDoLembrete2, textoDoLembrete3 } from "./lembrete-do-que-falta";
import { pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { apresentacao, desculpasPeloAtendimento } from "./voz-da-vitoria";
import { PEDIDO_FICA_COMPLETO, PEDIDO_JA_SEGUIU, PODE_ENVIAR_O_QUE_FALTA } from "./resposta-ao-que-falta";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import {
  A_LIMPEZA_SO_NA_PROPOSTA,
  ESCOLHA_COM_CONDICAO_ANOTADA,
  escolheComCondicao,
  PODE_ENVIAR_DEPOIS,
  respostaFrequente,
} from "./perguntas-frequentes-da-vitoria";
import { PEDIR_E_GRATIS_NO_EMAIL } from "./email-pedido";

const em = (iso: string) => instanteEmLisboa(iso) as Date;

/* ── d90 ─────────────────────────────────────────────────────────────────── */

describe("d90 — o «vou pensar» lê-se nas quatro línguas, e o resto fica com uma pessoa", () => {
  it("as formas de quem ainda não decidiu", () => {
    for (const t of [
      "Vou pensar",
      "vou pensar melhor, obrigada",
      "Deixe-me pensar e depois digo",
      "Ainda não decidi",
      "Depois dou mais informação",
      "depois digo-lhe alguma coisa",
      "Vou falar com o meu marido",
      "Let me think about it",
      "I'll let you know",
      "Je vais réfléchir",
      "Lo voy a pensar",
    ]) {
      expect(disseQueVaiPensar(t), t).toBe("depois");
    }
  });

  it("as formas de quem está a comparar com outras empresas", () => {
    for (const t of [
      "Estou a aguardar orçamentos de outras empresas",
      "Pedi outros orçamentos, depois digo",
      "Estou a comparar",
      "I'm waiting for other quotes",
      "J'attends d'autres devis",
      "Espero otros presupuestos",
    ]) {
      expect(disseQueVaiPensar(t), t).toBe("outras_empresas");
    }
  });

  it("contraproposta, queixa, alteração, pedir uma pessoa, cancelar e perguntas: null (a equipa)", () => {
    for (const t of [
      "Vou pensar, mas por 80 € fechava já",
      "Vou pensar, está muito caro",
      "Vou pensar, consegue fazer desconto?",
      "Vou pensar, mas queria mudar a data",
      "Vou pensar, mas prefiro falar com alguém",
      "Vou pensar, se calhar cancelo",
      "Vou pensar. Quanto tempo vale a proposta?",
      "Sim, avançar",
      "",
    ]) {
      expect(disseQueVaiPensar(t), t).toBeNull();
    }
    expect(disseQueVaiPensar("Vou pensar", { queixa: true })).toBeNull();
  });

  it("a resposta delicada — sem prometer o que o código não cumpre", () => {
    const depois = respostaAoVaiPensar("depois");
    const outras = respostaAoVaiPensar("outras_empresas", "sexta-feira, 27/11");
    expect(depois).toBe(
      "Com certeza, fica tudo guardado no seu pedido. Se ajudar, diga-me o que falta decidir (o valor, o dia ou outra coisa) e passo à equipa.",
    );
    expect(outras).toContain("Faz bem em comparar.");
    expect(outras).toContain("Não há nenhum pagamento adiantado nem valor retido");
    expect(outras).toContain("A proposta é válida até sexta-feira, 27/11.");
    for (const t of [depois, outras]) {
      expect(t).not.toMatch(/só depois do trabalho feito|até o trabalho estar feito/);
      expect(t).not.toMatch(/\b(IA|virtual|robô)\b/);
    }
  });

  it("o seguimento que arranca sozinho: a 1.ª no dia seguinte às 10h, nunca antes", () => {
    const agora = em("2026-11-23T15:30");
    const voltar = voltarAmanhaAsDez(agora);
    expect(diaEmLisboa(voltar)).toBe("2026-11-24");
    expect(pecasEmLisboa(voltar).hora).toBe(10);
    const ciclo = { voltarEm: voltar, canal: "whatsapp" as const };
    expect(proximoPassoDoSeguimento(ciclo, em("2026-11-23T18:00"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo, em("2026-11-24T09:50"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo, em("2026-11-24T10:05"))).toBe("mensagem1");
    expect(NOTA_DO_VAI_PENSAR).toBe("Seguimento automático — o cliente disse que ia pensar");
  });

  it("a equipa respondeu ontem à pergunta dele e ele calou-se: arranca hoje; de há dois dias, ou sem pergunta, não", () => {
    const agora = em("2026-11-24T10:20");
    const daEquipa = (t: string) => t.startsWith("[à mão]");
    const horas = (h: number) => h * 3600;
    const fio = [
      { direccao: "in", texto: "Inclui desmontar a cama?", haSegundos: horas(20) },
      { direccao: "out", texto: "[à mão] Inclui, sim.", haSegundos: horas(19) },
    ];
    expect(aEquipaRespondeuEOClienteCalou(fio, agora, daEquipa)).toBe(true);
    expect(aEquipaRespondeuEOClienteCalou([fio[0], { ...fio[1], haSegundos: horas(1) }], agora, daEquipa)).toBe(false);
    expect(aEquipaRespondeuEOClienteCalou([fio[0], { ...fio[1], haSegundos: horas(50) }], agora, daEquipa)).toBe(false);
    expect(aEquipaRespondeuEOClienteCalou([{ ...fio[0], texto: "Obrigada" }, fio[1]], agora, daEquipa)).toBe(false);
    expect(aEquipaRespondeuEOClienteCalou([fio[0], { ...fio[1], texto: "A Vitória respondeu" }], agora, daEquipa)).toBe(false);
  });
});

/* ── d93, ponto 1 ────────────────────────────────────────────────────────── */

describe("d93 — a conversa parada a meio: lembretes que retomam, e o rascunho que sobrevive ao dia seguinte", () => {
  it("o rascunho vale 7 dias (era 1): a cliente das 11h58 não volta a ouvir «o que é para levar?»", () => {
    expect(HORAS_DO_RASCUNHO).toBe(168);
    const agora = em("2026-11-24T10:00");
    expect(rascunhoAindaVale(em("2026-11-23T11:58"), agora)).toBe(true);
    expect(rascunhoAindaVale(em("2026-11-18T11:58"), agora)).toBe(true);
    expect(rascunhoAindaVale(em("2026-11-16T09:00"), agora)).toBe(false);
    // As três leituras da conversa usam a regra dos 7 dias, e já não as 24 horas.
    const src = readFileSync(new URL("./whatsapp-negociacao.ts", import.meta.url), "utf8");
    expect(src.match(/rascunhoAindaVale\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/actualizadoEm\)\.getTime\(\)\s*[<>]\s*24 \* 3600_000/);
  });

  it("o calendário: 2 h depois (no próprio dia), a manhã seguinte, o último, e o fecho", () => {
    const desde = em("2026-11-23T11:58");
    expect(proximoPassoDaConversaParada({ desde }, em("2026-11-23T13:00"))).toBeNull();
    expect(proximoPassoDaConversaParada({ desde }, em("2026-11-23T14:05"))).toBe("lembrete1");
    const l1 = em("2026-11-23T14:05");
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1 }, em("2026-11-23T19:00"))).toBeNull();
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1 }, em("2026-11-24T09:30"))).toBeNull();
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1 }, em("2026-11-24T10:10"))).toBe("lembrete2");
    const l2 = em("2026-11-24T10:10");
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1, lembrete2Em: l2 }, em("2026-11-25T10:10"))).toBe("lembrete3");
    const l3 = em("2026-11-25T10:10");
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1, lembrete2Em: l2, lembrete3Em: l3 }, em("2026-11-25T18:00"))).toBeNull();
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1, lembrete2Em: l2, lembrete3Em: l3 }, em("2026-11-26T10:10"))).toBe("fechar");
    // Nunca de noite.
    expect(proximoPassoDaConversaParada({ desde, lembrete1Em: l1 }, em("2026-11-24T21:30"))).toBeNull();
  });

  it("a pergunta às 20h: as 2 horas caem de noite — o primeiro é o da manhã seguinte", () => {
    const desde = em("2026-11-23T20:00");
    expect(proximoPassoDaConversaParada({ desde }, em("2026-11-23T20:59"))).toBeNull();
    expect(proximoPassoDaConversaParada({ desde }, em("2026-11-24T10:00"))).toBe("lembrete2");
  });

  it("cada lembrete retoma de onde ficou — diz o que está anotado e repete só a pergunta em falta, nunca a do serviço", () => {
    const d: DadosDaRecolha = {
      serviceType: "recolha_monos",
      contactName: "Odília",
      description: "um sofá de três lugares e uma cómoda",
      address: "Rua das Amendoeiras 12",
      postalCode: "2800-123",
      city: "Almada",
    };
    const anotado = oQueJaEstaAnotado(d);
    expect(anotado.some((l) => l.startsWith("Serviço: "))).toBe(true);
    expect(anotado.some((l) => l.startsWith("Morada: Rua das Amendoeiras 12"))).toBe(true);
    expect(anotado.some((l) => l.includes("—"))).toBe(false);
    for (const passo of ["lembrete1", "lembrete2", "lembrete3"] as const) {
      const t = textoDaConversaParada(passo, { nome: "Odília", servico: "recolha de monos", anotado, pergunta: perguntaParaContinuar("andar", d) });
      expect(t).toContain("Já tenho anotado:");
      expect(t).toContain("- Morada: Rua das Amendoeiras 12");
      expect(t).not.toContain(perguntaDo("servico", {}, false));
      // A resposta dele cai na pergunta certa.
      expect(passoDaPergunta(t)).toBe("andar");
      expect(t).not.toMatch(/😊/);
    }
    expect(textoDaConversaParada("lembrete3", { nome: null, servico: "recolha de monos", anotado, pergunta: "x" })).toContain("amanhã deixo-o sem registar");
    expect(textoDaConversaParada("fechar", { nome: "Odília", servico: "recolha de monos", anotado, pergunta: "x" })).toBe(
      "Olá, Odília! Como não voltámos a falar, deixei o seu pedido de recolha de monos sem registar. Se ainda precisar, é só escrever-me por aqui quando quiser: pedir é grátis e sem compromisso.",
    );
  });

  it("os lembretes contam para a uma-por-dia comum (a tabela entra na lista das fontes)", () => {
    const src = readFileSync(new URL("./uma-mensagem-automatica-por-dia.ts", import.meta.url), "utf8");
    expect(src).toContain('tabela: "conversasParadas"');
    expect(src).toContain("porTelefone: true");
  });
});

/* ── d93, ponto 2 ────────────────────────────────────────────────────────── */

describe("d93 — o cliente cancela pela conversa", () => {
  it("claro, ambíguo, ou nada", () => {
    for (const t of [
      "Quero cancelar o pedido",
      "Queria cancelar o pedido #812",
      "Já não preciso, cancelem",
      "Pode cancelar o pedido, por favor",
      "Já não preciso do serviço",
      "Please cancel my request",
      "Je veux annuler ma demande",
      "Quiero cancelar mi pedido",
    ]) {
      expect(querCancelar(t), t).toBe("claro");
    }
    for (const t of ["Cancelar a data", "Se calhar já não", "Já não preciso", "Posso cancelar o pedido?", "CANCELAR", "acho que já não"]) {
      expect(querCancelar(t), t).toBe("ambiguo");
    }
    for (const t of ["Bom dia, quando vem o parceiro?", "Vou pensar", "Obrigada"]) expect(querCancelar(t), t).toBeNull();
    expect(pedidoNaFrase("Queria cancelar o pedido #812")).toBe(812);
    expect(pedidoNaFrase("cancelar o pedido 1203")).toBe(1203);
    expect(pedidoNaFrase("quero cancelar")).toBeNull();
  });

  it("as excepções vão à equipa: contratado, data marcada, pago, referência viva, faturado, fechado", () => {
    const livre: OPedidoParaCancelar = {
      existe: true,
      status: "enviado",
      anonimizado: false,
      contratado: false,
      dataMarcada: false,
      pago: false,
      referenciaViva: false,
      faturado: false,
    };
    expect(porqueFicaComAEquipa(livre)).toBeNull();
    expect(porqueFicaComAEquipa({ ...livre, contratado: true })).toMatch(/contratado/);
    expect(porqueFicaComAEquipa({ ...livre, dataMarcada: true })).toMatch(/data marcada/);
    expect(porqueFicaComAEquipa({ ...livre, pago: true })).toMatch(/pagamento/);
    expect(porqueFicaComAEquipa({ ...livre, referenciaViva: true })).toMatch(/referência/);
    expect(porqueFicaComAEquipa({ ...livre, faturado: true })).toMatch(/faturado/);
    expect(porqueFicaComAEquipa({ ...livre, status: "cancelado" })).toMatch(/cancelado/);
    expect(porqueFicaComAEquipa({ ...livre, existe: false })).toBeTruthy();
  });

  it("a mensagem ao cliente (letra a letra) e a pergunta do CANCELAR, que vale 48 h e só para o pedido dela", () => {
    expect(mensagemDoCancelamentoPeloCliente(812)).toBe("O seu pedido #812 foi cancelado. Não voltaremos a contactá-lo e os seus dados foram apagados.");
    const pergunta = textoDaConfirmacaoDoCancelamento(812);
    expect(aPerguntaDoCancelarVale({ texto: pergunta, haSegundos: 600 }, 812)).toBe(true);
    expect(aPerguntaDoCancelarVale({ texto: pergunta, haSegundos: 49 * 3600 }, 812)).toBe(false);
    expect(aPerguntaDoCancelarVale({ texto: pergunta, haSegundos: 600 }, 81)).toBe(false);
    expect(aPerguntaDoCancelarVale({ texto: "Olá!", haSegundos: 600 }, 812)).toBe(false);
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(mensagemDoCancelamentoPeloCliente(812), l), l).not.toBeNull();
  });

  it("não contactar: o número guarda-se pela impressão, igual em todas as formas, e nunca escrito", () => {
    const a = chaveDoNumero("+351 910 000 111");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDoNumero("910000111")).toBe(a);
    expect(chaveDoNumero("00351910000111")).toBe(a);
    expect(chaveDoNumero("910000112")).not.toBe(a);
    expect(chaveDoNumero("123")).toBeNull();
    expect(a).not.toContain("910000111");
  });
});

/* ── d91 ─────────────────────────────────────────────────────────────────── */

const LEMBRETE = { pedidoId: 612, nome: "Rosalinda", servico: "recolha de monos", semIva: 100, total: 123, parceiro: "Recolhas Exemplo", validaAte: "2026-11-27", nota: { media: 4.8, quantas: 12 } };

describe("d91 — os textos novos, com os marcadores letra a letra", () => {
  it("3.1 e 3.3: a apresentação diz porque pergunta; as desculpas seguram o pedido", () => {
    const a = apresentacao("Bom dia", "Rosalinda");
    expect(a).toContain("Aqui é a Vitória");
    expect(a).toContain("pedir é grátis e sem compromisso");
    expect(a.match(/😊/g)?.length).toBe(1);
    expect(desculpasPeloAtendimento("Rosalinda")).toMatch(/Nada do que já me disse se perde\.$/);
  });

  it("3.5: o pedido registado começa pelo marcador, tem um só emoji e diz «a partir das 9h» de noite", () => {
    const dia = mensagemDePedidoRegistado(812, false, "Rosalinda", false, false, em("2026-11-23T15:00"));
    expect(dia).toMatch(/^Pedido #812 registado[.!]/);
    expect(dia).toContain("em menos de 6 horas");
    expect(dia).toContain("Depois é só escolher: pedir é grátis e não paga nada adiantado.");
    expect(dia).toContain("Uma ou duas fotografias do que é para levar");
    expect(dia.match(/😊/g)?.length).toBe(1);
    const noite = mensagemDePedidoRegistado(812, true, "Rosalinda", false, false, em("2026-11-23T23:30"));
    expect(noite).toContain("a partir das 9h");
    expect(noite).not.toContain("fotografias do que é para levar");
  });

  it("3.7 e 3.19: o modelo do que falta e os lembretes — reconhecidos pela d86 e pela d71; a 3.ª avisa o arquivo amanhã", () => {
    const p = { id: 812, serviceType: "recolha_monos", city: "Almada" };
    const faltas = ["fotografias", "andar"] as const;
    const agora = em("2026-11-23T10:00");
    const m1 = mensagemDoQueFalta(p, [...faltas], agora);
    expect(m1).toContain("Aqui é a equipa da CLYON.");
    expect(m1).toContain("Pode responder a esta mensagem com o que falta.");
    expect(m1).toContain("pedido #812");
    expect(m1).toContain("está quase pronto");
    expect(m1).toContain("2 ou 3 fotografias do que é para levar: com elas, os parceiros dão um preço certo e sem surpresas no dia.");
    const m2 = textoDoLembrete2(p, [...faltas], agora);
    const m3 = textoDoLembrete3(p, [...faltas], agora);
    for (const t of [m1, m2, m3]) expect(pedidoDoEnvioDeModelo(t), t.slice(0, 40)).toBe(812);
    for (const t of [m2, m3]) expect(eLembreteDoQueFalta(t, 812)).toBe(true);
    expect(m2).toContain("continua guardado");
    expect(m3).toContain("o pedido fica arquivado amanhã");
    expect(textoDoArquivo(p, agora)).toContain("é grátis e sem compromisso");
    expect(assuntoDoLembrete("lembrete2", 812)).toBe("Pedido #812: falta pouco para receber propostas");
    expect(assuntoDoLembrete("lembrete3", 812)).toBe("Pedido #812: último aviso antes de arquivar");
    expect(assuntoDoLembrete("arquivar", 812)).toBe("Pedido #812 arquivado");
    for (const t of [m1, m2, m3]) expect(t).not.toMatch(/[😊—“”]/);
  });

  it("3.13 e 5.2: o lembrete D+1 tem A (par) e B (ímpar), as duas com as três opções e o «#N»", () => {
    expect(varianteDoLembrete(612)).toBe("A");
    expect(varianteDoLembrete(613)).toBe("B");
    const a = textoDoLembrete(LEMBRETE);
    const b = textoDoLembrete({ ...LEMBRETE, pedidoId: 613 });
    expect(a).toContain("continua à sua espera");
    expect(a).toContain("É o total a pagar, e não paga nada adiantado.");
    expect(a).toContain("Válido até sexta-feira, 27/11.");
    expect(b).toContain("Ficou alguma dúvida sobre o orçamento do pedido #613");
    expect(b).toContain("nota 4,8 em 12 avaliações");
    for (const [t, id] of [[a, 612], [b, 613]] as const) {
      expect(t.endsWith(AS_TRES_OPCOES)).toBe(true);
      expect(aUltimaSaidaE(t, id)).toBe("lembrete");
    }
    // Por carga, nunca «é o total a pagar» (o total depende das cargas).
    expect(textoDoLembrete({ ...LEMBRETE, unidade: "carga" })).not.toContain("É o total a pagar");
    expect(textoDoUltimoAviso(LEMBRETE)).toContain("e para avançar depois terá de pedir propostas de novo");
    expect(textoDoFechoAoCliente(612)).toBe(
      "Fechámos o pedido #612, porque não tivemos resposta. Se ainda precisar, responda aqui e reabrimo-lo para os parceiros. Obrigada pelo seu tempo.",
    );
    expect(textoDoAvancarNumTrabalhoClyon(612, "Recolhas Exemplo", "Rosalinda")).toBe(
      "Obrigada, Rosalinda! O pedido #612 fica reservado com o parceiro Recolhas Exemplo. Uma pessoa da equipa fala consigo por aqui para combinar o dia.",
    );
    const pergunta = textoDaConfirmacaoDoCancelamento(612);
    expect(pergunta.startsWith("Confirma que quer cancelar o pedido #612? Responda CANCELAR.")).toBe(true);
    expect(aUltimaSaidaE(pergunta, 612)).toBe("confirmacao");
  });

  it("3.18 e 5.3: o seguimento — a frase das opções inteira (o reconhecimento e o email), A/B na 1.ª do «Vai pensar»", () => {
    expect(varianteDaMensagem1(612)).toBe("A");
    expect(varianteDaMensagem1(613)).toBe("B");
    for (const id of [612, 613]) {
      for (const resposta of ["vai_pensar", "nao_atendeu", "outra_data"] as const) {
        const d = { pedidoId: id, nome: "Rosalinda", servico: "recolha de monos", resposta };
        for (const t of [textoDaMensagem1(d), textoDaMensagem2(d), textoDaMensagem3(d)]) {
          expect(t).toContain(AS_OPCOES_DO_SEGUIMENTO);
          expect(eMensagemDoSeguimento(t, id)).toBe(true);
          expect(paraEmail(t)).not.toContain("Responda 1");
        }
      }
    }
    const a = textoDaMensagem1({ pedidoId: 612, nome: "Rosalinda", servico: "recolha de monos", resposta: "vai_pensar" });
    const b = textoDaMensagem1({ pedidoId: 613, nome: "Rosalinda", servico: "recolha de monos", resposta: "vai_pensar" });
    expect(a).toContain("Ficou de pensar no seu pedido #612");
    expect(a).toContain("não paga nada adiantado");
    expect(b).toContain("o que falta para decidir, o valor, o dia ou outra coisa?");
    expect(textoDaMensagem3({ pedidoId: 612, nome: null, servico: "recolha de monos", resposta: "vai_pensar" })).toContain(
      "terá de pedir propostas de novo",
    );
  });

  it("a variante do A/B fica no histórico do pedido (validade e seguimento)", () => {
    const validade = readFileSync(new URL("./validade-do-orcamento-na-base.ts", import.meta.url), "utf8");
    const seguimento = readFileSync(new URL("./seguimento-do-cliente-na-base.ts", import.meta.url), "utf8");
    expect(validade).toContain("Variante ${varianteDoLembrete(pedidoId)} (A/B da d91)");
    expect(seguimento).toContain("Variante ${varianteDaMensagem1(pedidoId)} (A/B da d91)");
  });

  it("o banco de objecções: a foto amanhã, a limpeza, e a escolha com condição (que não fecha nada)", () => {
    expect(respostaFrequente("Posso enviar a foto amanhã?", em("2026-11-23T10:00"))).toBe(PODE_ENVIAR_DEPOIS);
    expect(respostaFrequente("A limpeza está incluída?", em("2026-11-23T10:00"))).toBe(A_LIMPEZA_SO_NA_PROPOSTA);
    expect(escolheComCondicao("Escolho o Recolhas Exemplo com a condição de ser até quinta-feira")).toBe(true);
    expect(escolheComCondicao("Aceito a proposta do Recolhas Exemplo")).toBe(false);
    expect(ESCOLHA_COM_CONDICAO_ANOTADA).toContain("Até lá nada fica marcado nem pago.");
  });

  it("nenhum texto novo promete «só paga depois do trabalho feito» (a correcção do CEO)", () => {
    const todos = [
      mensagemDePedidoRegistado(812, false, "Rosalinda"),
      textoDoLembrete(LEMBRETE),
      textoDoLembrete({ ...LEMBRETE, pedidoId: 613 }),
      textoDoAvancarNumTrabalhoClyon(612, null),
      textoDaMensagem1({ pedidoId: 612, nome: null, servico: "x", resposta: "vai_pensar" }),
      textoDaMensagem2({ pedidoId: 612, nome: null, servico: "x", resposta: "vai_pensar" }),
      respostaAoVaiPensar("outras_empresas"),
      PEDIR_E_GRATIS_NO_EMAIL,
    ];
    for (const t of todos) expect(t).not.toMatch(/só (paga )?depois do trabalho feito|até o trabalho estar feito/);
  });

  it("as traduções fixas em, fr e es das mensagens da Vitória (sem elas, a conversa passaria à equipa)", () => {
    const dados: DadosDaRecolha = { serviceType: "recolha_monos", contactName: "Oliver", address: "Rua dos Choupos Brancos 17", postalCode: "1950-123", city: "Lisboa" };
    const ms: string[] = [
      apresentacao("Bom dia", "Oliver"),
      desculpasPeloAtendimento("Oliver"),
      mensagemDePedidoRegistado(512, false, "Oliver"),
      mensagemDePedidoRegistado(512, true, "Oliver", false, true),
      mensagemDePedidoRegistado(512, false, "Oliver", false, false, em("2026-11-23T23:00")),
      PEDIDO_FICA_COMPLETO,
      PEDIDO_JA_SEGUIU,
      PODE_ENVIAR_O_QUE_FALTA,
      textoDoFechoAoCliente(612),
      textoDaConfirmacaoDoCancelamento(612),
      textoDoAvancarNumTrabalhoClyon(612, "Recolhas Exemplo", "Oliver"),
      textoDoAvancarNumTrabalhoClyon(612, null),
      respostaAoVaiPensar("depois"),
      respostaAoVaiPensar("outras_empresas", "sexta-feira, 27/11"),
      mensagemDoCancelamentoPeloCliente(612),
      A_LIMPEZA_SO_NA_PROPOSTA,
      ESCOLHA_COM_CONDICAO_ANOTADA,
      PODE_ENVIAR_DEPOIS,
    ];
    for (const id of [612, 613]) {
      for (const unidade of [null, "carga", "hora"] as const) {
        const d = { ...LEMBRETE, pedidoId: id, unidade };
        ms.push(textoDoLembrete(d), textoDoUltimoAviso(d), textoDoLembrete({ ...d, parceiro: null, nota: null, validaAte: null }));
      }
      for (const resposta of ["vai_pensar", "nao_atendeu", "outra_data"] as const) {
        const d = { pedidoId: id, nome: "Oliver", servico: "recolha de monos", resposta };
        ms.push(textoDaMensagem1(d), textoDaMensagem2(d), textoDaMensagem3(d));
      }
    }
    for (const passo of ["lembrete1", "lembrete2", "lembrete3", "fechar"] as const) {
      ms.push(textoDaConversaParada(passo, { nome: "Oliver", servico: "recolha de monos", anotado: oQueJaEstaAnotado(dados), pergunta: perguntaParaContinuar("andar", dados) }));
      ms.push(textoDaConversaParada(passo, { nome: null, servico: null, anotado: [], pergunta: perguntaParaContinuar("nome", {}) }));
    }
    for (const l of ["en", "fr", "es"] as const) {
      const faltam = ms.filter((m) => traducaoFixa(m, l) == null);
      expect(faltam, l).toEqual([]);
    }
    expect(traducaoFixa(textoDoLembrete(LEMBRETE), "en")).toContain("is still waiting for you");
  });
});
