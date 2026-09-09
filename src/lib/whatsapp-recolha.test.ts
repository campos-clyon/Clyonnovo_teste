import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  recolhaNova,
  responderNaRecolha,
  servicoDoTexto,
  simOuNao,
  andarDoTexto,
  codigoPostalELocalidade,
  interpretarQuando,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";

/**
 * O assistente que recolhe um pedido pelo WhatsApp.
 *
 * "Se o cliente enviar mensagem, ele responde com o objectivo de recolher os
 * dados do cliente para preencher o pedido e criá-lo automaticamente."
 */

const T0 = new Date("2026-09-09T10:00:00"); // quarta-feira

/** Leva a conversa pelo caminho feliz até ao resumo. */
function conversa(respostas: string[], inicio: EstadoDaRecolha = recolhaNova()) {
  let estado = inicio;
  let ultima = "";
  for (const r of respostas) {
    const saida = responderNaRecolha(estado, r, T0);
    estado = saida.estado;
    ultima = saida.resposta;
  }
  return { estado, ultima };
}

describe("uma recolha inteira, do olá ao registo", () => {
  it("pergunta uma coisa de cada vez, pela ordem do formulário, e acaba num resumo", () => {
    const { estado, ultima } = conversa([
      "1", // recolha de móveis
      "Ana Silva",
      "Rua Sousa Viterbo 29",
      "2845-513 Amora",
      "2º",
      "não",
      "sim",
      "amanhã de manhã",
      "Um sofá de 3 lugares e uma cómoda",
      "não",
    ]);
    expect(estado.passo).toBe("confirmar");
    expect(estado.dados).toMatchObject({
      serviceType: "recolha_moveis",
      contactName: "Ana Silva",
      address: "Rua Sousa Viterbo 29",
      postalCode: "2845-513",
      city: "Amora",
      floor: "2",
      hasElevator: "no",
      parkingDistance: "near",
      urgency: "tomorrow",
      description: "Um sofá de 3 lugares e uma cómoda",
      precisaFatura: false,
    });
    expect(estado.dados.dataDesejada).toContain("2026-09-10");
    expect(ultima).toContain("Confirme, por favor");
    expect(ultima).toContain("Responda SIM para registar");
  });

  it("o SIM no resumo manda registar", () => {
    const { estado } = conversa(["1", "Ana", "Rua X 1", "2845-513 Amora", "r/c", "não", "sim", "sem pressa", "Cómoda", "sim"]);
    const r = responderNaRecolha(estado, "Sim!", T0);
    expect(r.registar).toBe(true);
    expect(r.estado.dados.precisaFatura).toBe(true);
  });

  it("no resumo, «morada Rua Nova 5» corrige e volta a mostrar o resumo", () => {
    const { estado } = conversa(["1", "Ana", "Rua X 1", "2845-513 Amora", "r/c", "não", "sim", "sem pressa", "Cómoda", "não"]);
    const r = responderNaRecolha(estado, "morada Rua Nova 5", T0);
    expect(r.registar).toBeUndefined();
    expect(r.estado.dados.address).toBe("Rua Nova 5");
    expect(r.resposta).toContain("Rua Nova 5");
  });

  it("uma mudança pergunta o destino; um entulho pergunta a quantidade", () => {
    const m = conversa(["mudança", "Rui", "Rua A 1", "1000-001 Lisboa"]);
    expect(m.estado.passo).toBe("moradaDestino");
    const e = conversa(["3", "Rui", "Rua A 1", "1000-001 Lisboa", "r/c", "não", "sim"]);
    expect(e.estado.passo).toBe("entulhoQuantidade");
  });

  it("a primeira mensagem já com o serviço salta a lista", () => {
    const r = responderNaRecolha(recolhaNova(), "Boa tarde, preciso de levar um sofá velho", T0);
    expect(r.estado.passo).toBe("nome");
    expect(r.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r.resposta).toContain("Recolha de móveis");
  });

  it("«2º sem elevador» responde a duas perguntas de uma vez", () => {
    const { estado } = conversa(["1", "Ana", "Rua X 1", "2845-513 Amora", "2º sem elevador"]);
    expect(estado.dados.floor).toBe("2");
    expect(estado.dados.hasElevator).toBe("no");
    expect(estado.passo).toBe("estacionamento");
  });
});

describe("as três palavras que valem em qualquer passo", () => {
  it("«falar com alguém» entrega a conversa a uma pessoa", () => {
    const { estado } = conversa(["1", "Ana"]);
    const r = responderNaRecolha(estado, "quero falar com uma pessoa", T0);
    expect(r.pedirPessoa).toBe(true);
  });

  it("«cancelar» desiste; «recomeçar» volta ao início", () => {
    const { estado } = conversa(["1", "Ana"]);
    expect(responderNaRecolha(estado, "cancelar", T0).desistir).toBe(true);
    const r = responderNaRecolha(estado, "recomeçar", T0);
    expect(r.estado.passo).toBe("servico");
    expect(r.estado.dados).toEqual({});
  });
});

describe("as pequenas leituras", () => {
  it("o serviço, por número ou por palavra", () => {
    expect(servicoDoTexto("6")).toBe("mudanca");
    expect(servicoDoTexto("6.")).toBe("mudanca");
    expect(servicoDoTexto("tenho entulho de uma obra")).toBe("recolha_entulho");
    expect(servicoDoTexto("um frigorífico velho")).toBe("recolha_monos");
    expect(servicoDoTexto("esvaziar um apartamento")).toBe("esvaziamento_apartamento");
    expect(servicoDoTexto("bom dia")).toBeNull();
    expect(servicoDoTexto("99")).toBeNull();
  });

  it("sim e não, como um teclado escreve", () => {
    expect(simOuNao("Sim")).toBe("sim");
    expect(simOuNao("não")).toBe("nao");
    expect(simOuNao("nao tem")).toBe("nao");
    expect(simOuNao("talvez")).toBeNull();
  });

  it("o andar", () => {
    expect(andarDoTexto("r/c")).toBe("0");
    expect(andarDoTexto("Rés do chão")).toBe("0");
    expect(andarDoTexto("3º andar")).toBe("3");
    expect(andarDoTexto("terceiro")).toBe("3");
    expect(andarDoTexto("cave")).toBe("-1");
  });

  it("o código postal e a localidade, juntos ou separados", () => {
    expect(codigoPostalELocalidade("2845-513 Amora")).toEqual({ postalCode: "2845-513", city: "Amora" });
    expect(codigoPostalELocalidade("2845513, Amora, Portugal")).toEqual({ postalCode: "2845-513", city: "Amora" });
    expect(codigoPostalELocalidade("Amora")).toEqual({ postalCode: null, city: "Amora" });
  });

  it("para quando: amanhã, um dia da semana com hora, uma data, sem pressa", () => {
    const amanha = interpretarQuando("amanhã de manhã", T0);
    expect(amanha.data?.getDate()).toBe(10);
    expect(amanha.data?.getHours()).toBe(9);
    expect(amanha.urgency).toBe("tomorrow");

    const sexta = interpretarQuando("sexta às 14h", T0);
    expect(sexta.data?.getDay()).toBe(5);
    expect(sexta.data?.getHours()).toBe(14);
    expect(sexta.urgency).toBe("this_week");

    const data = interpretarQuando("14/09 11:30", T0);
    expect(data.data?.getDate()).toBe(14);
    expect(data.data?.getHours()).toBe(11);
    expect(data.data?.getMinutes()).toBe(30);

    expect(interpretarQuando("sem pressa", T0)).toEqual({ data: null, urgency: "flexible" });
    expect(interpretarQuando("urgente", T0).urgency).toBe("today");
  });
});

describe("o assistente está ligado ao cérebro e ao painel", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("um número sem pedido activo cai na recolha, e o painel manda antes", () => {
    const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
    const i = CEREBRO.indexOf("export async function tratarMensagemDoCliente");
    const corpo = CEREBRO.slice(i);
    expect(corpo.indexOf("podeOWhatsAppFalarCom(telefone)")).toBeLessThan(corpo.indexOf("recolherPedidoPorWhatsApp("));
    expect(corpo).toContain("if (pedidos.length === 0) {");
    expect(corpo).toContain("recolherPedidoPorWhatsApp(telefone, conteudo.texto)");
    expect(CEREBRO).not.toContain("clyon.pt/simulador — ou responda aqui");
  });

  it("«falar com alguém» interrompe o número, o mesmo interruptor do painel", () => {
    const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
    expect(CEREBRO).toContain('interromperNumeroWhatsApp(telefone, "Pediu para falar com uma pessoa")');
  });

  it("o pedido nasce «sem_assistente», na fila por enviar, com a origem marcada", () => {
    const REG = ler("src/lib/registar-pedido-por-whatsapp.ts");
    expect(REG).toContain('status: "sem_assistente"');
    expect(REG).toContain('origemPedido: "whatsapp"');
    expect(REG).toContain("contactPhone: telefone");
  });

  it("o painel mostra em que passo vai cada número e pode recomeçar a recolha", () => {
    expect(ler("src/components/admin/AdminWhatsAppPanel.tsx")).toContain("PASSO_DA_RECOLHA");
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain('case "recomecarRecolha"');
  });
});
