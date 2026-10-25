import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOLGA_DO_TELEMOVEL_S,
  linhasDoSeparador,
  naMesa,
  ultimaPalavra,
  type FactosDaConversa,
  type MensagemDaMesa,
  type NoTelemovel,
} from "./mesa-das-conversas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import { conversasPorLer, temNovidades } from "./ler-as-conversas";

/**
 * A MESA VÊ O TELEMÓVEL — 23-10-2026.
 *
 * *«Quero que essa página seja responsável por gerir todos os trabalhos que
 * chegam à CLYON pelo WhatsApp, para termos a noção de quais clientes já
 * foram respondidos, quais não foram, quem foi o último a mandar mensagem, se
 * fomos nós, se o pedido já foi finalizado ou não.»* — o dono, com 68 em
 * «Por responder», quase todas «Entregue: Respondeu à mão no WhatsApp».
 *
 * As respostas dadas no telemóvel antes de 21-10 nunca chegaram ao site. A
 * ponte passa a ler a lista das conversas do WhatsApp de 10 em 10 minutos, e
 * a mesa junta o que o telemóvel diz ao fio do site.
 */

const H = 3600;
const D = 24 * H;
const entrada = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "in",
  texto,
  haSegundos,
  quando: "2026-10-20 15:41:00",
});
const saida = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "out",
  texto,
  haSegundos,
  quando: "2026-10-20 15:00:00",
});
const telemovel = (t: Partial<NoTelemovel>): NoTelemovel => ({
  deMim: true,
  haSegundos: H,
  quando: "2026-10-22T10:00:00.000Z",
  texto: "",
  porLer: 0,
  arquivada: false,
  ...t,
});
const conversa = (f: Partial<FactosDaConversa>): FactosDaConversa => ({
  telefone: "351910000007",
  ultimaEntrada: null,
  ultimaSaida: null,
  bloqueada: false,
  entregue: true,
  motivoDaEntrega: "Respondeu à mão no WhatsApp",
  fecho: null,
  recolha: null,
  pedidoVivo: null,
  ultimoPedido: null,
  guardada: null,
  ...f,
});

describe("a resposta dada no telemóvel tira a conversa do «Por responder»", () => {
  it("o +351 910 000 007: a pergunta do «valor por carga», respondida à mão um dia depois", () => {
    const f = conversa({
      ultimaSaida: saida(10, "Encontrámos um profissional…", 3 * D),
      ultimaEntrada: entrada(12, "Boa tarde Tenho de perguntar O que significa valor por carga PF", 2 * D),
      noTelemovel: telemovel({ deMim: true, haSegundos: D, texto: "É o preço de cada carga da carrinha." }),
      pedidoVivo: { id: 901, status: "em_negociacao" },
    });
    expect(ultimaPalavra(f)).toMatchObject({ de: "equipa", onde: "telemovel", haSegundos: D });
    const l = naMesa(f);
    expect(l.estado).toBe("com_pedido");
    expect(l.porque).toBe("À espera do cliente — a última palavra foi nossa, há 1 dia");
    expect(l.quemFalou).toBe("equipa");
    expect(l.onde).toBe("telemovel");
    expect(l.pedido).toEqual({ id: 901, estado: "em negociação", fechado: false });
  });

  it("sem pedido, fica «À espera do cliente», com o que a equipa escreveu", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: entrada(5, "Quanto fica a recolha de um sofá?", 2 * D),
        noTelemovel: telemovel({ deMim: true, haSegundos: 5 * H, texto: "Fica 45 € + IVA. Quer avançar?" }),
      }),
    );
    expect(l.estado).toBe("a_espera");
    expect(l.porque).toBe("A equipa respondeu no telemóvel há 5 h: «Fica 45 € + IVA. Quer avançar?»");
    expect(l.ultimaDoTelemovel).toEqual({ direccao: "out", texto: "Fica 45 € + IVA. Quer avançar?" });
  });

  it("e o cliente que respondeu no telemóvel com a ponte em baixo volta a «Por responder»", () => {
    const l = naMesa(
      conversa({
        entregue: false,
        ultimaSaida: saida(7, "Qual é a morada, por favor?", 3 * H),
        noTelemovel: telemovel({ deMim: false, haSegundos: 20 * 60, texto: "[localização]", porLer: 2, arquivada: true }),
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toBe("Escreveu há 20 min: «[localização]» — só no telemóvel, o site não a recebeu");
    expect(l.quemFalou).toBe("cliente");
    expect(l.porLerNoTelemovel).toBe(2);
    expect(l.arquivadaNoTelemovel).toBe(true);
  });
});

describe("o telemóvel não manda quando o site já sabe", () => {
  it("a resposta da Vitória que saiu atrasada da fila continua a ser da Vitória", () => {
    // O site grava quando ela escreve; o telemóvel, quando sai — com a ponte em baixo, meia hora depois.
    const p = ultimaPalavra(
      conversa({
        ultimaEntrada: entrada(1, "Olá", 2 * H),
        ultimaSaida: saida(2, "Olá! Sou a Vitória. Que serviço procura?", 2 * H - 10),
        noTelemovel: telemovel({ deMim: true, haSegundos: H + 25 * 60, texto: "Olá! Sou a Vitória.  Que serviço procura?" }),
      }),
    );
    expect(p).toMatchObject({ de: "vitoria", onde: "site" });
  });

  it("a resposta à mão que a ponte já gravou é a mesma — fica a do fio", () => {
    const p = ultimaPalavra(
      conversa({
        ultimaEntrada: entrada(1, "E o valor?", 3 * H),
        ultimaSaida: saida(2, `${MARCA_DE_MAO} São 80 €`, 2 * H),
        noTelemovel: telemovel({ deMim: true, haSegundos: 2 * H - 200, texto: "São 80 €" }),
      }),
    );
    expect(p).toMatchObject({ de: "equipa", onde: "site" });
  });

  it("um retrato mais velho do que o fio não conta", () => {
    const p = ultimaPalavra(
      conversa({
        ultimaEntrada: entrada(3, "Pode ser amanhã?", 10 * 60),
        noTelemovel: telemovel({ deMim: true, haSegundos: H, texto: "Bom dia" }),
      }),
    );
    expect(p).toMatchObject({ de: "cliente", onde: "site" });
  });

  it("e por menos do que a folga, os relógios não decidem", () => {
    const p = ultimaPalavra(
      conversa({
        ultimaEntrada: entrada(3, "Pode ser amanhã?", 10 * 60),
        noTelemovel: telemovel({ deMim: true, haSegundos: 10 * 60 - (FOLGA_DO_TELEMOVEL_S - 30), texto: "Pode" }),
      }),
    );
    expect(p?.onde).toBe("site");
  });
});

describe("«Já respondi» — respondeu-se fora do WhatsApp", () => {
  it("passa para «À espera do cliente», e diz que foi marcada", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: entrada(5, "Comprovativo de Transferência Sepa_261020_170814.pdf", 2 * D),
        respondida: { haSegundos: H, quando: "2026-10-23 10:00:00" },
      }),
    );
    expect(l.estado).toBe("a_espera");
    expect(l.porque).toBe("Marcada como respondida há 1 h — à espera do cliente");
    expect(l.onde).toBe("painel");
    expect(l.quemFalou).toBe("equipa");
  });

  it("e volta a «Por responder» quando o cliente escreve depois", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: entrada(6, "Então, já confirmaram?", 30 * 60),
        respondida: { haSegundos: H, quando: "2026-10-23 10:00:00" },
      }),
    );
    expect(l.estado).toBe("por_responder");
  });
});

describe("fechada, e o cliente voltou a escrever — também pelo telemóvel", () => {
  it("reabre", () => {
    const l = naMesa(
      conversa({
        ultimaSaida: saida(4, "Obrigada!", 3 * H),
        fecho: { haSegundos: 2 * H, quando: "x", motivo: "serviço feito", porQuem: "equipa" },
        noTelemovel: telemovel({ deMim: false, haSegundos: 10 * 60, texto: "Afinal falta um móvel" }),
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toContain("Voltou a escrever depois de fechada");
  });
});

describe("o pedido de cada linha, e se acabou", () => {
  it("concluído é resolvida pelo pedido, e a linha diz que acabou", () => {
    const l = naMesa(conversa({ ultimaSaida: saida(3, "Obrigada!", 30 * H), ultimoPedido: { id: 902, status: "concluido" } }));
    expect(l.estado).toBe("resolvida");
    expect(l.pedido).toEqual({ id: 902, estado: "concluído", fechado: true });
  });
});

describe("a Vitória lê o que só o telemóvel sabe", () => {
  it("a leitura de antes da resposta à mão já não aparece na linha", () => {
    const base = {
      ultimaEntrada: entrada(12, "O que significa valor por carga?", 2 * D),
      noTelemovel: telemovel({ deMim: true, haSegundos: D, texto: "É o preço de cada carga." }),
    };
    const antes = naMesa(
      conversa({ ...base, leitura: { estado: "por_responder", motivo: "pergunta por responder", lidaHaSegundos: 36 * H } }),
    );
    expect(antes.porque).not.toContain("a Vitória leu");
    const depois = naMesa(
      conversa({ ...base, leitura: { estado: "a_espera_do_cliente", motivo: "falta o cliente decidir", lidaHaSegundos: 2 * H } }),
    );
    expect(depois.porque).toContain("a Vitória leu: falta o cliente decidir");
  });

  it("e volta a ler quando o telemóvel tem uma mensagem mais nova do que a leitura", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: entrada(12, "O que significa valor por carga?", 2 * D),
        noTelemovel: telemovel({ deMim: true, haSegundos: D, texto: "É o preço de cada carga." }),
      }),
    );
    expect(temNovidades(l, { ateMensagemId: 12, lidaHaSegundos: 36 * H })).toBe(true);
    expect(temNovidades(l, { ateMensagemId: 12, lidaHaSegundos: 2 * H })).toBe(false);
    expect(conversasPorLer([l], new Map([["910000007", { ateMensagemId: 12, lidaHaSegundos: 36 * H }]]))).toHaveLength(1);
  });

  it("e o fio que lhe vai leva essa mensagem no fim, como resposta da equipa", () => {
    const LER = readFileSync(join(process.cwd(), "src/lib/ler-as-conversas.ts"), "utf8");
    expect(LER).toContain('t.direccao === "out" ? `${MARCA_DE_MAO} ${t.texto}` : t.texto');
  });
});

describe("no «À espera do cliente», as antigas vêm depois", () => {
  it("o cliente que deixou de responder há mais de 3 dias fica abaixo da linha", () => {
    const linhas = [
      naMesa(conversa({ telefone: "351910000001", ultimaSaida: saida(1, "x", 10 * D) })),
      naMesa(conversa({ telefone: "351910000002", ultimaSaida: saida(2, "y", H) })),
    ];
    expect(linhasDoSeparador(linhas, "a_espera").map((l) => l.telefone)).toEqual(["351910000002", "351910000001"]);
  });
});

/* ── a ponte ──────────────────────────────────────────────────────────────── */

const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8").replace(/\r\n/g, "\n");

/** Tira uma função de cima da ponte, para a correr aqui sem o WhatsApp. */
function funcaoDaPonte(nome: string): string {
  const i = PONTE.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`a ponte já não tem a função ${nome}`);
  return PONTE.slice(i, PONTE.indexOf("\n}\n", i) + 2);
}

describe("a ponte tira o retrato do telemóvel", () => {
  const ler = new Function("window", `${funcaoDaPonte("lerAsConversasNaPagina")}\nreturn lerAsConversasNaPagina;`);

  const janela = (chats: unknown[]) => ({
    require: (m: string) =>
      m === "WAWebCollections"
        ? { Chat: { getModelsArray: () => chats } }
        : { toPn: (wid: { _serialized: string }) => (wid._serialized === "999@lid" ? { _serialized: "351911111111@c.us" } : null) },
  });
  const chat = (id: string, t: number, msgs: unknown[], mais: Record<string, unknown> = {}) => ({
    id: { _serialized: id },
    t,
    unreadCount: 0,
    archive: false,
    msgs: { getModelsArray: () => msgs },
    ...mais,
  });
  const msg = (fromMe: boolean, t: number, type: string, body: string, caption?: string) => ({
    id: { fromMe },
    t,
    type,
    body,
    caption,
  });

  it("a última mensagem de verdade — as notificações do WhatsApp não contam", () => {
    const linhas = ler(
      janela([
        chat("351922222222@c.us", 300, [
          msg(false, 100, "chat", "Olá"),
          msg(true, 200, "chat", "Bom dia, em que posso ajudar?"),
          msg(false, 300, "e2e_notification", ""),
        ], { unreadCount: 1, archive: true }),
      ]),
    )(1, 50);
    expect(linhas).toEqual([
      {
        id: "351922222222@c.us",
        pn: null,
        deMim: true,
        quando: 200,
        tipo: "chat",
        corpo: "Bom dia, em que posso ajudar?",
        porLer: 1,
        arquivada: true,
      },
    ]);
  });

  it("de uma fotografia vai a legenda, e não a miniatura", () => {
    const [l] = ler(janela([chat("351933333333@c.us", 50, [msg(false, 50, "image", "/9j/4AAQSkZJRg…", "o sofá")])]))(1, 50);
    expect(l.corpo).toBe("o sofá");
    expect(l.tipo).toBe("image");
  });

  it("sem grupos, sem conversas velhas, e o @lid trocado por telefone", () => {
    const linhas = ler(
      janela([
        chat("1203@g.us", 500, [msg(false, 500, "chat", "grupo")], { groupMetadata: {} }),
        chat("351944444444@c.us", 5, [msg(false, 5, "chat", "velha")]),
        chat("999@lid", 400, [msg(false, 400, "chat", "pelo lid")]),
      ]),
    )(10, 50);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ id: "999@lid", pn: "351911111111@c.us", corpo: "pelo lid" });
  });

  it("e o que não tem texto diz-se pelo que é", () => {
    const textoDaMao = new Function(`${funcaoDaPonte("textoDaMao")}\nreturn textoDaMao;`)();
    expect(textoDaMao({ type: "sticker", body: "" })).toBe("[autocolante]");
    expect(textoDaMao({ type: "location", body: "" })).toBe("[localização]");
    expect(textoDaMao({ type: "image", body: "o sofá" })).toBe("[imagem] o sofá");
  });

  it("de 10 em 10 minutos, a primeira 2 minutos depois de ligar", () => {
    expect(PONTE).toContain("const INTERVALO_DO_RETRATO = 10 * 60_000;");
    expect(PONTE).toContain("setInterval(() => void retratarOTelemovel(), INTERVALO_DO_RETRATO).unref();");
    expect(PONTE).toContain("setTimeout(() => void retratarOTelemovel(), 2 * 60_000).unref();");
    expect(PONTE).toContain('await site("POST", { accao: "retrato", conversas });');
  });
});

describe("o site guarda o retrato e mostra-o", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("a rota trata o retrato antes de pedir o telefone — o retrato é de todas", () => {
    const ROTA = ler("src/app/api/whatsapp/ponte/route.ts");
    const retrato = ROTA.indexOf('if (corpo.accao === "retrato") {');
    expect(retrato).toBeGreaterThan(-1);
    expect(retrato).toBeLessThan(ROTA.indexOf("if (!telefone) {"));
    expect(ROTA).toContain("await guardarRetratoDoTelemovelWhatsApp(limpas);");
  });

  it("a base guarda uma linha por número, e conta as idades sem fuso", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS whatsappNoTelemovel (");
    expect(DB).toContain("CAST(UNIX_TIMESTAMP() AS SIGNED) - quandoUnix AS haSegundos");
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS whatsappRespondidas (");
    const i = DB.indexOf("export async function apagarConversaWhatsApp(");
    const corpo = DB.slice(i, DB.indexOf("\n}", i));
    expect(corpo).toContain("DELETE FROM whatsappRespondidas");
    expect(corpo).toContain("DELETE FROM whatsappNoTelemovel");
  });

  it("a mesa junta o retrato e os «Já respondi» — e, sem retrato, é a de antes", () => {
    const NA_BASE = ler("src/lib/mesa-das-conversas-na-base.ts");
    expect(NA_BASE).toContain("noTelemovel: telemovel.porChave.get(chave) ?? null,");
    expect(NA_BASE).toContain("respondida: respondidas.get(chave) ?? null,");
    expect(NA_BASE).toContain("db.retratoDoTelemovelWhatsApp().catch((e) => {");
  });

  it("o painel diz quem falou por último, o pedido, e tem «Já respondi» e «Fechar» na linha", () => {
    const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
    const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
    expect(PAINEL).toContain('cliente: { texto: "Última: cliente"');
    expect(PAINEL).toContain("href={`/admin/pedido/${l.pedido.id}`}");
    expect(PAINEL).toContain('onClick={() => void agir("respondida", l.telefone)}');
    expect(PAINEL).toContain("Já respondi");
    expect(PAINEL).toContain("leituraDoTelemovel(estado.telemovelLidoHaSegundos)");
    expect(PAINEL).toContain("A lista das conversas não carregou");
    expect(ROTA).toContain('await marcarRespondidaWhatsApp(telefone, accao === "respondida");');
  });
});
