import { describe, it, expect } from "vitest";
import {
  completarAEmpresa,
  comOQueAEmpresaPrecisa,
  espacoDaEmpresaNoTexto,
  FICA_COMO_ESVAZIAMENTO,
  FICA_COMO_RECOLHA,
  foraDeHorasNoTexto,
  oPedidoDaEmpresa,
  pecasNoTexto,
  PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA,
  perguntarSeEUmEsvaziamento,
  responderAoEsvaziamento,
  semAPerguntaDoEsvaziamento,
} from "./esvaziamento-na-recolha";
import { PERGUNTA_DO_ESVAZIAMENTO } from "./parece-um-esvaziamento";
import {
  recolhaNova,
  responderNaRecolha,
  servicoDoTexto,
  servicoPorPalavras,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import {
  decidirOValorUnico,
  eUmSimAoValorUnico,
  motivoDoValorUnicoAceite,
  pedidoDaAceitacaoEscrita,
  VALOR_UNICO_ACEITE,
} from "./valor-unico-no-whatsapp";
import { mensagemDeAceitar } from "../../app-cliente/src/lib/valor-unico";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { readFileSync } from "node:fs";

/**
 * D43 E D39 NA VITÓRIA — 15-11-2026. O esvaziamento de armazém, escritório ou
 * loja na lista e nas palavras dela; a pergunta «parece um esvaziamento» (uma
 * vez, relendo a conversa); e o «SIM, aceito o orçamento do pedido #N» do
 * valor único, que passa à equipa e nunca aceita a proposta de um parceiro.
 * Pedidos e conversas inventados.
 */

const T0 = new Date("2026-11-15T10:00:00Z");

/** A mesma ordem de `recolherPedidoPorWhatsApp`: a resposta pendente, a leitura de sempre, a pergunta, a empresa. */
function vez(estado: EstadoDaRecolha, texto: string, ditos: string[]): RespostaDaRecolha {
  const textos = [...ditos, texto];
  const pendente = responderAoEsvaziamento(estado, texto, T0, textos);
  if (pendente) return pendente;
  const e = semAPerguntaDoEsvaziamento(estado);
  return comOQueAEmpresaPrecisa(perguntarSeEUmEsvaziamento(responderNaRecolha(e, texto, T0, true, false), textos, T0), textos);
}

function conversa(mensagens: string[]): RespostaDaRecolha[] {
  let estado = recolhaNova();
  const ditos: string[] = [];
  const out: RespostaDaRecolha[] = [];
  for (const m of mensagens) {
    const r = vez(estado, m, ditos);
    out.push(r);
    estado = r.estado;
    ditos.push(m);
  }
  return out;
}

describe("o esvaziamento de armazém, escritório ou loja nas palavras da Vitória", () => {
  it("com o trabalho dito, é o serviço novo; a mudança de escritório continua a ser uma mudança", () => {
    expect(servicoDoTexto("Preciso de esvaziar um armazém em Loures")).toBe("esvaziamento_empresa");
    expect(servicoDoTexto("vamos fechar a loja e é preciso tirar tudo")).toBe("esvaziamento_empresa");
    expect(servicoDoTexto("o escritório está cheio de mobiliário velho")).toBe("esvaziamento_empresa");
    expect(servicoDoTexto("o recheio do escritório")).toBe("esvaziamento_empresa");
    expect(servicoPorPalavras("despejar o armazém")).toBe("esvaziamento_empresa");
    expect(servicoDoTexto("mudança de escritório para Oeiras")).toBe("mudanca");
    expect(servicoDoTexto("esvaziar a garagem")).toBe("esvaziamento_garagem");
    // «A casa toda» já é o esvaziamento de casa, sem pergunta.
    expect(servicoDoTexto("a recolha dos móveis da casa toda")).toBe("esvaziamento_casa");
    // «loja» de passagem não é o serviço: é uma recolha (e a pergunta decide).
    expect(servicoDoTexto("recolher um sofá que comprei na loja")).toBe("recolha_moveis");
  });

  it("o espaço, o fora de horas e as peças pelo que ele escreve", () => {
    expect(espacoDaEmpresaNoTexto("o nosso armazém")).toBe("armazem");
    expect(espacoDaEmpresaNoTexto("Escritório no 3.º andar")).toBe("escritorio");
    expect(espacoDaEmpresaNoTexto("uma loja de roupa")).toBe("loja");
    expect(espacoDaEmpresaNoTexto("uma casa")).toBeNull();
    expect(foraDeHorasNoTexto("só pode ser ao fim de semana")).toBe(true);
    expect(foraDeHorasNoTexto("depois do fecho, à noite")).toBe(true);
    expect(foraDeHorasNoTexto("na terça de manhã")).toBe(false);
    expect(pecasNoTexto("são 12 móveis e 3 caixas")).toBe(12);
  });

  it("uma conversa de armazém: o serviço, o espaço, o fora de horas e a fatura (sem a perguntar)", () => {
    const [r] = conversa(["Bom dia, preciso de esvaziar um armazém em Loures, só pode ser ao fim de semana"]);
    expect(r.estado.dados.serviceType).toBe("esvaziamento_empresa");
    expect(r.estado.dados.espacoDaEmpresa).toBe("armazem");
    expect(r.estado.dados.foraDeHoras).toBe(true);
    expect(r.estado.dados.precisaFatura).toBe(true);
    expect(r.resposta).not.toContain(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA);
    const { json, descricao } = oPedidoDaEmpresa(r.estado.dados, "Paletes e estantes.");
    expect(json).toEqual({ espacoDaEmpresa: "armazem", foraDeHoras: "sim" });
    expect(descricao).toBe("Paletes e estantes.\nEspaço da empresa: Armazém.\nPedidos da empresa: fora de horas (à noite ou ao fim de semana).");
    expect(oPedidoDaEmpresa({ serviceType: "recolha_moveis" }, "Um sofá.")).toEqual({ json: {}, descricao: "Um sofá." });
  });

  it("a empresa: o que já lá está não se muda", () => {
    const d = completarAEmpresa({ serviceType: "esvaziamento_empresa", precisaFatura: false, espacoDaEmpresa: "loja" }, ["o armazém"]);
    expect(d.precisaFatura).toBe(false);
    expect(d.espacoDaEmpresa).toBe("loja");
    expect(completarAEmpresa({ serviceType: "esvaziamento_empresa" }, ["sem dizer o espaço"]).espacoDaEmpresa).toBe("outro");
  });
});

describe("«parece um esvaziamento» na recolha do WhatsApp — uma vez, com delicadeza", () => {
  it("as palavras são as do simulador", () => {
    expect(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA).toContain(
      PERGUNTA_DO_ESVAZIAMENTO.charAt(0).toLowerCase() + PERGUNTA_DO_ESVAZIAMENTO.slice(1),
    );
    expect(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA).not.toMatch(/profissiona/i);
  });

  it("herança: pergunta no lugar da pergunta seguinte; com sim passa a esvaziamento de casa", () => {
    const [r1, r2, r3] = conversa([
      "Boa tarde, queria a recolha dos móveis da minha mãe, é uma herança",
      "Sim, o espaço todo",
      "Ana",
    ]);
    expect(r1.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r1.resposta.endsWith(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA)).toBe(true);
    expect(r1.estado.dados.aConfirmarEsvaziamento).toBe("esvaziamento_casa");
    expect(r2.estado.dados.serviceType).toBe("esvaziamento_casa");
    expect(r2.resposta.startsWith(FICA_COMO_ESVAZIAMENTO)).toBe(true);
    expect(r2.estado.dados.aConfirmarEsvaziamento).toBeUndefined();
    expect(r2.estado.passo).toBe("nome");
    // Não se volta a perguntar.
    expect(r3.resposta).not.toContain(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA);
    expect(r3.estado.dados.contactName).toBe("Ana");
  });

  it("com não, fica a recolha; e não se pergunta outra vez, mesmo com mais palavras", () => {
    const [r1, r2, r3] = conversa(["Recolha de 10 móveis", "Não, só a recolha", "Rui, e são móveis da herança"]);
    expect(r1.resposta.endsWith(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA)).toBe(true);
    expect(r2.resposta.startsWith(FICA_COMO_RECOLHA)).toBe(true);
    expect(r2.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r3.resposta).not.toContain(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA);
  });

  it("relê a conversa: o «escritório» dito antes conta, e o sim leva ao esvaziamento de empresa", () => {
    const [r1, r2, r3] = conversa(["Bom dia", "Queria recolher umas secretárias e cadeiras do escritório", "sim"]);
    expect(r1.estado.passo).toBe("servico");
    expect(r2.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r2.estado.dados.aConfirmarEsvaziamento).toBe("esvaziamento_empresa");
    expect(r3.estado.dados.serviceType).toBe("esvaziamento_empresa");
    expect(r3.estado.dados.espacoDaEmpresa).toBe("escritorio");
    expect(r3.estado.dados.precisaFatura).toBe(true);
  });

  it("outra resposta qualquer: a pergunta cai (não se repete) e a mensagem lê-se como sempre", () => {
    const [, r2] = conversa(["Recolha de 9 móveis", "Chamo-me Teresa"]);
    expect(r2.estado.dados.aConfirmarEsvaziamento).toBeUndefined();
    expect(r2.estado.dados.esvaziamentoPerguntado).toBe(true);
    expect(r2.estado.dados.serviceType).toBe("recolha_moveis");
  });

  it("uma recolha pequena não pergunta nada, nem um entulho", () => {
    const [r] = conversa(["Recolha de um sofá e uma cama"]);
    expect(r.resposta).not.toContain(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA);
    const [e] = conversa(["Tenho 20 sacos de entulho de uma obra na casa toda"]);
    expect(e.estado.dados.serviceType).toBe("recolha_entulho");
    expect(e.resposta).not.toContain(PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA);
  });

  it("as frases novas têm tradução fixa", () => {
    for (const f of [PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA, FICA_COMO_ESVAZIAMENTO, FICA_COMO_RECOLHA, VALOR_UNICO_ACEITE]) {
      for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(f, l), `${l}: ${f}`).not.toBeNull();
    }
  });
});

describe("«SIM, aceito o orçamento do pedido #N» — o valor único pelo WhatsApp (d39)", () => {
  it("lê a mensagem da app, e o número do pedido", () => {
    expect(pedidoDaAceitacaoEscrita(mensagemDeAceitar(812))).toBe(812);
    expect(pedidoDaAceitacaoEscrita("Aceito o valor do pedido 812")).toBe(812);
    expect(pedidoDaAceitacaoEscrita("sim aceito")).toBeNull();
  });

  it("o pedido dele com valor único por decidir: aceite, e passa à equipa para escolher o parceiro", () => {
    expect(decidirOValorUnico(mensagemDeAceitar(812), [812])).toEqual({ tipo: "aceite", pedidoId: 812 });
    expect(motivoDoValorUnicoAceite(812)).toBe("O cliente aceitou o valor único do pedido #812 — escolher o parceiro");
  });

  it("outro pedido (ou sem valor único): nunca aceite — a equipa confirma", () => {
    expect(decidirOValorUnico(mensagemDeAceitar(999), [812])?.tipo).toBe("pessoa");
    expect(decidirOValorUnico(mensagemDeAceitar(812), [])?.tipo).toBe("pessoa");
  });

  it("«sim», «aceito», «pode ser» com um só valor único por decidir", () => {
    for (const t of ["sim", "Sim!", "aceito", "Pode ser", "ok, aceito", "yes", "Sim, aceito"]) {
      expect(eUmSimAoValorUnico(t), t).toBe(true);
      expect(decidirOValorUnico(t, [812]), t).toEqual({ tipo: "aceite", pedidoId: 812 });
    }
    expect(eUmSimAoValorUnico("Ok, obrigada")).toBe(false);
    // Dois por decidir: a equipa vê qual.
    expect(decidirOValorUnico("sim", [812, 813])?.tipo).toBe("pessoa");
  });

  it("um não ou um valor vão para a equipa; sem valor único, a mensagem segue como sempre", () => {
    expect(decidirOValorUnico("não", [812])?.tipo).toBe("pessoa");
    expect(decidirOValorUnico("faz por 100?", [812])?.tipo).toBe("pessoa");
    expect(decidirOValorUnico("sim", [])).toBeNull();
    expect(decidirOValorUnico("A que horas vêm?", [812])).toBeNull();
  });

  it("a resposta não diz nomes nem valores, e o cérebro não aceita propostas nesses pedidos", () => {
    expect(VALOR_UNICO_ACEITE).not.toMatch(/\d|€/);
    const cerebro = readFileSync("src/lib/whatsapp-negociacao.ts", "utf8");
    expect(cerebro).toContain("if (comValorUnico.has(pedidoId)) continue;");
    expect(cerebro).toContain("vu.decidirOValorUnico(conteudo.texto, comValorUnico)");
    const ini = cerebro.indexOf("async function tratarOValorUnico(");
    const corpo = cerebro.slice(ini, cerebro.indexOf("\n}\n", ini));
    expect(corpo).not.toMatch(/fecharPeloCliente|recusarPeloCliente|agirComoCliente/);
  });
});
