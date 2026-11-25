import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d116 — A VITÓRIA RESPONDE SEMPRE; A EQUIPA PAUSA COM «*» E RETOMA COM «»»
 * (25-11-2026). Textos e números inventados; a base é fingida.
 */

const base = vi.hoisted(() => ({
  interrompidos: [] as Array<{ telefone: string; motivo: string; quem: string }>,
  retomados: [] as string[],
  devolvidos: [] as string[],
  fila: [] as Array<{ texto: string }>,
  falha: false,
}));

vi.mock("./db", () => ({
  interromperNumeroWhatsApp: async (telefone: string, motivo: string, quem: string) =>
    void base.interrompidos.push({ telefone, motivo, quem }),
  retomarNumeroWhatsApp: async (telefone: string) => void base.retomados.push(telefone),
  getPool: async () => ({
    execute: async () => {
      if (base.falha) throw new Error("a base caiu");
      return [base.fila, []];
    },
  }),
}));
vi.mock("./pedido-em-curso-na-base", () => ({
  marcarDevolvidaWhatsApp: async (telefone: string) => void base.devolvidos.push(telefone),
}));

import {
  COMO_PAUSAR_A_VITORIA,
  MOTIVO_DA_PAUSA,
  oQueFazAMensagemDaEquipa,
  semOSinal,
  sinalDaEquipa,
} from "./pausa-da-vitoria";
import { aplicarOSinalDaEquipa, saiuPeloSiteHaPouco } from "./pausa-da-vitoria-na-base";
import { linhaDaEntrega } from "./sinais-da-equipa";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import { mensagemDoQueFalta } from "./mensagem-do-que-falta";
import { aEquipaFalouHaPouco, A_EQUIPA_A_ESCREVER_CALA_A_VITORIA } from "./pedido-em-curso";
import { entregaPorResposta, MOTIVO_DA_RESPOSTA_A_MAO, voltouAVitoria } from "./volta-a-vitoria";
import { linhaDoFioParaOModelo, mensagemDoTurno, AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { naMesa, type FactosDaConversa } from "./mesa-das-conversas";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const TEL = "351910000116";

describe("os sinais — «*» pausa, «»» retoma, o último manda", () => {
  it("«*» em qualquer sítio pausa; sozinho também", () => {
    expect(sinalDaEquipa("*")).toBe("pausar");
    expect(sinalDaEquipa("Bom dia, eu trato disto * obrigado")).toBe("pausar");
    expect(sinalDaEquipa(`${MARCA_DE_MAO} *Já lhe ligo*`)).toBe("pausar");
  });

  it("«»» em qualquer sítio retoma; sozinho também", () => {
    expect(sinalDaEquipa("»")).toBe("retomar");
    expect(sinalDaEquipa("Pronto, a Vitória continua » obrigado")).toBe("retomar");
  });

  it("com os dois, vale o que aparece por último", () => {
    expect(sinalDaEquipa("* já vi » ")).toBe("retomar");
    expect(sinalDaEquipa("» já vi *")).toBe("pausar");
  });

  it("sem sinal, nada", () => {
    expect(sinalDaEquipa("Bom dia! O parceiro passa amanhã de manhã.")).toBeNull();
    expect(sinalDaEquipa("")).toBeNull();
    expect(sinalDaEquipa(null)).toBeNull();
  });

  it("as aspas «…» não são sinal — só o «»» solto", () => {
    expect(sinalDaEquipa("Responda «SIM» para confirmar")).toBeNull();
    expect(sinalDaEquipa("O valor «final» é este » ")).toBe("retomar");
  });

  it("nunca contam nas mensagens da Vitória nem no envio de modelo (d86)", () => {
    // As frases dela usam «» nas aspas: sem «»» solto, nunca retomam.
    for (const dela of [
      "Para confirmar, responda «SIM».",
      "Escreva «CANCELAR» se quiser cancelar o pedido #812.",
    ]) {
      expect(sinalDaEquipa(dela)).toBeNull();
    }
    const modelo = mensagemDoQueFalta({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["fotografias"], new Date("2026-11-25T10:00:00Z"));
    expect(sinalDaEquipa(`${modelo} *`)).toBeNull();
    expect(oQueFazAMensagemDaEquipa({ texto: `${modelo} »`, profissional: false })).toBe("nada");
  });
});

describe("o que faz uma mensagem à mão no telemóvel", () => {
  it("sem sinal, a um cliente: nada — a Vitória continua a responder", () => {
    expect(oQueFazAMensagemDaEquipa({ texto: "Bom dia, já vejo isso", profissional: false })).toBe("nada");
  });

  it("sem sinal, a um profissional registado: continua a passar à equipa", () => {
    expect(oQueFazAMensagemDaEquipa({ texto: "Amanhã às 9h?", profissional: true })).toBe("entregar");
  });

  it("com sinal, o sinal manda — também a um profissional", () => {
    expect(oQueFazAMensagemDaEquipa({ texto: "Eu falo com ele *", profissional: false })).toBe("pausar");
    expect(oQueFazAMensagemDaEquipa({ texto: "»", profissional: true })).toBe("retomar");
  });
});

describe("no backoffice, o sinal sai antes de a mensagem seguir", () => {
  it("tira o sinal e arruma os espaços", () => {
    expect(semOSinal("Bom dia, eu trato disto * obrigado")).toBe("Bom dia, eu trato disto obrigado");
    expect(semOSinal("*Já lhe ligo*")).toBe("Já lhe ligo");
    expect(semOSinal("Pronto » a Vitória continua")).toBe("Pronto a Vitória continua");
  });

  it("as aspas ficam", () => {
    expect(semOSinal("Responda «SIM» » ")).toBe("Responda «SIM»");
  });

  it("só o sinal: não sobra nada para enviar", () => {
    expect(semOSinal("*")).toBe("");
    expect(semOSinal("  »  ")).toBe("");
    expect(semOSinal("* »")).toBe("");
  });

  it("a rota do backoffice aplica o sinal, tira-o e não envia a mensagem vazia", () => {
    const rota = ler("src/app/api/admin/whatsapp/route.ts");
    const bloco = rota.slice(rota.indexOf('if (accao === "responder") {'), rota.indexOf('if (accao === "enviarPelaClyon") {'));
    const sinal = bloco.indexOf("const sinal = sinalDaEquipa(escrito);");
    const limpo = bloco.indexOf("const texto = sinal ? semOSinal(escrito) : escrito;");
    const aplica = bloco.indexOf("if (sinal) await aplicarOSinalDaEquipa(telefone, sinal);");
    const vazio = bloco.indexOf("return NextResponse.json({ ok: true, sinal, enviada: false });");
    const envia = bloco.indexOf("enviarTextoManualWhatsApp(telefone, texto)");
    for (const i of [sinal, limpo, aplica, vazio, envia]) expect(i).toBeGreaterThan(-1);
    expect(sinal).toBeLessThan(limpo);
    expect(vazio).toBeLessThan(envia);
    // E o link à mão também leva o texto sem o sinal.
    expect(bloco).toContain("linkParaEnviarAMao(telefone, texto)");
    expect(bloco).not.toContain("enviarTextoManualWhatsApp(telefone, escrito)");
  });
});

describe("na base — pausar é uma entrega a uma pessoa; retomar é o «Devolver ao site»", () => {
  beforeEach(() => {
    base.interrompidos = [];
    base.retomados = [];
    base.devolvidos = [];
    base.fila = [];
    base.falha = false;
  });

  it("pausar grava «Pausada pela equipa (*)», por uma pessoa", async () => {
    await aplicarOSinalDaEquipa(TEL, "pausar");
    expect(base.interrompidos).toEqual([{ telefone: TEL, motivo: "Pausada pela equipa (*)", quem: "pessoa" }]);
    expect(MOTIVO_DA_PAUSA).toBe("Pausada pela equipa (*)");
    expect(base.retomados).toEqual([]);
  });

  it("retomar tira a entrega e marca a devolução", async () => {
    await aplicarOSinalDaEquipa(TEL, "retomar");
    expect(base.retomados).toEqual([TEL]);
    expect(base.devolvidos).toEqual([TEL]);
    expect(base.interrompidos).toEqual([]);
  });

  it("o texto que afinal saiu do site (pela fila) não conta como da equipa; na dúvida, também não", async () => {
    base.fila = [{ texto: "Para confirmar, responda «SIM» »" }];
    expect(await saiuPeloSiteHaPouco(TEL, `${MARCA_DE_MAO}   Para confirmar, responda «SIM» »`)).toBe(true);
    expect(await saiuPeloSiteHaPouco(TEL, "Eu trato disto *")).toBe(false);
    base.falha = true;
    expect(await saiuPeloSiteHaPouco(TEL, "Eu trato disto *")).toBe(true);
  });

  it("a ponte: o envio de modelo primeiro, depois o texto do site, depois o sinal", () => {
    const rota = ler("src/app/api/whatsapp/ponte/route.ts");
    const i = rota.indexOf('if (corpo.accao === "interromper") {');
    const bloco = rota.slice(i, rota.indexOf("if (await numeroBloqueadoWhatsApp(telefone))", i));
    const modelo = bloco.indexOf("if (eEnvioDeModelo(daMao)) {");
    const doSite = bloco.indexOf("await saiuPeloSiteHaPouco(telefone, daMao)");
    const faz = bloco.indexOf("oQueFazAMensagemDaEquipa({ texto: daMao, profissional })");
    for (const n of [modelo, doSite, faz]) expect(n).toBeGreaterThan(-1);
    expect(modelo).toBeLessThan(doSite);
    expect(doSite).toBeLessThan(faz);
    // A resposta à mão já não entrega a conversa a um cliente: só a um profissional («entregar»).
    expect(bloco).toContain('} else if (faz === "entregar") {');
    expect(bloco).not.toContain('interromperNumeroWhatsApp(telefone, "Respondeu à mão no WhatsApp"');
  });
});

describe("a resposta à mão já não cala a Vitória", () => {
  it("as 12 h da d73 deixaram de calar", () => {
    expect(A_EQUIPA_A_ESCREVER_CALA_A_VITORIA).toBe(false);
    const fio = [{ direccao: "out", texto: `${MARCA_DE_MAO} Bom dia!`, haSegundos: 60 }];
    expect(aEquipaFalouHaPouco(fio, { respondidaHaSegundos: 30 })).toBe(false);
  });

  it("as entregas que já existem por «Respondeu à mão» deixam de calar já — salvo de um profissional", () => {
    expect(entregaPorResposta({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa" })).toBe(true);
    expect(voltouAVitoria({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", profissional: false })).toBe(true);
    expect(voltouAVitoria({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: null, profissional: false })).toBe(true);
    expect(voltouAVitoria({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", profissional: true })).toBe(false);
  });

  it("ficam como estão: os limites dela, pediu uma pessoa, a queixa, o «Assumir» e a pausa", () => {
    for (const motivo of [
      MOTIVO_DA_PAUSA,
      "Pediu para falar com uma pessoa",
      "Cliente a perder a paciência — responder já",
      "Pelo backoffice",
      "Valor acima de 500 € com IVA — confirmar com o cliente",
      "Mudança à hora — combinar com o cliente",
      "O tradutor falhou e a mensagem da Vitória não tem tradução fixa — responder à mão, em inglês",
      "Guia por verificar - quis fechar",
    ]) {
      for (const quem of ["vitoria", "pessoa", null] as const) {
        expect(voltouAVitoria({ motivo, quem, profissional: false })).toBe(false);
      }
    }
  });
});

describe("a Vitória lê o que a equipa escreveu", () => {
  it("as linhas da equipa vão ao modelo como «[equipa]», sem a marca", () => {
    expect(linhaDoFioParaOModelo({ direccao: "out", texto: `${MARCA_DE_MAO} Boa tarde! Consegue mandar  uma fotografia?` })).toBe(
      "[equipa] Boa tarde! Consegue mandar uma fotografia?",
    );
    expect(linhaDoFioParaOModelo({ direccao: "out", texto: "Obrigada!" })).toBe("[CLYON] Obrigada!");
    expect(linhaDoFioParaOModelo({ direccao: "in", texto: "Sim, já envio" })).toBe("[cliente] Sim, já envio");
    const m = mensagemDoTurno(new Date("2026-11-25T10:00:00Z"), [
      { direccao: "out", texto: `${MARCA_DE_MAO} O parceiro passa amanhã.` },
      { direccao: "in", texto: "A que horas?" },
    ], [812]);
    expect(m).toContain("[equipa] O parceiro passa amanhã.");
  });

  it("o aviso diz-lhe para não contradizer nem repetir a equipa", () => {
    expect(AVISO_AO_MODELO).toContain("As linhas «[equipa]» foram escritas por uma pessoa da equipa da CLYON nesta conversa");
    expect(AVISO_AO_MODELO).toContain("não as contradigas, não repitas o que a equipa já disse ou perguntou");
  });
});

describe("a Mesa e o cartão do assistente", () => {
  it("uma conversa pausada mostra «Pausada pela equipa (*)», sem «Entregue:»", () => {
    expect(linhaDaEntrega(MOTIVO_DA_PAUSA)).toBe("Pausada pela equipa (*)");
    expect(linhaDaEntrega("Pediu para falar com uma pessoa")).toBe("Entregue: Pediu para falar com uma pessoa");
    const factos: FactosDaConversa = {
      telefone: TEL,
      ultimaEntrada: { id: 11, direccao: "in", texto: "Então?", haSegundos: 60, quando: "2026-11-25 10:00:00" } as never,
      ultimaSaida: { id: 10, direccao: "out", texto: `${MARCA_DE_MAO} já vejo *`, haSegundos: 120, quando: "2026-11-25 09:59:00" } as never,
      bloqueada: false,
      entregue: true,
      motivoDaEntrega: MOTIVO_DA_PAUSA,
      fecho: null,
      recolha: null,
      pedidoVivo: null,
      ultimoPedido: null,
      guardada: null,
    };
    const l = naMesa(factos);
    expect(l.dono).toBe("equipa");
    expect(l.motivoDaEntrega).toBe(MOTIVO_DA_PAUSA);
    expect(ler("src/components/admin/AdminWhatsAppPanel.tsx")).toContain("{linhaDaEntrega(l.motivoDaEntrega)}");
  });

  it("o cartão «Assistente automático» diz como pausar e retomar", () => {
    expect(COMO_PAUSAR_A_VITORIA).toBe("Para pausar a Vitória numa conversa, escreva * na mensagem; para ela voltar, escreva ».");
    expect(ler("src/components/admin/AdminAssistenteAutoPanel.tsx")).toContain("{COMO_PAUSAR_A_VITORIA}");
  });
});
