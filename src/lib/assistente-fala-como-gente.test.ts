import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  saudacao,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
} from "./whatsapp-recolha";

/**
 * O ASSISTENTE FALA COMO GENTE — e não se cala com a própria voz.
 *
 * Dois defeitos do mesmo dia, 10-09-2026, e o segundo era o que doía a sério.
 *
 * 1. A ABERTURA ERA DE ROBÔ. "Olá! Sou o assistente da CLYON. Trato do seu
 *    pedido por aqui em dois minutos." Ninguém anuncia que é um assistente ao
 *    atender um telefone — diz bom dia e pergunta o que é preciso. "Não quero
 *    que ele fale que é o assistente com essa mensagem engessada; comece como
 *    uma conversa normal."
 *
 * 2. ELE CALAVA-SE SOZINHO. A ponte marca a conversa como entregue a uma
 *    pessoa quando vê sair uma mensagem que não foi ela a mandar. Só que o
 *    `message_create` chega ANTES de o `sendMessage` resolver, e o id — a
 *    única marca que havia — ainda não existia. A ponte via a resposta do
 *    próprio assistente, concluía que o dono tinha respondido à mão, e calava
 *    o assistente naquele número PARA SEMPRE.
 *
 *    Ficou provado no painel: o 33780582689 tinha como última mensagem uma
 *    SAÍDA às 14:17 e estava entregue a uma pessoa "desde 14:17".
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PONTE_CLIENTE = ler("ponte-whatsapp/index.js");
const RECOLHA = ler("src/lib/whatsapp-recolha.ts");

/** Uma hora certa de Lisboa, escrita em UTC — no Verão, Lisboa é UTC+1. */
const emLisboa = (mes: number, dia: number, horaLisboa: number) =>
  new Date(Date.UTC(2026, mes - 1, dia, mes >= 4 && mes <= 10 ? horaLisboa - 1 : horaLisboa, 30));

describe("a saudação segue a hora de Lisboa", () => {
  it("bom dia, boa tarde e boa noite, cada um na sua hora", () => {
    expect(saudacao(emLisboa(9, 10, 9))).toBe("Bom dia");
    expect(saudacao(emLisboa(9, 10, 15))).toBe("Boa tarde");
    expect(saudacao(emLisboa(9, 10, 22))).toBe("Boa noite");
  });

  it("não é a hora de Greenwich, que é onde o servidor corre", () => {
    /*
     * O servidor da Vercel corre em UTC e no Verão está uma hora atrás. Às
     * 13:30 de Lisboa são 12:30 em Greenwich — a fronteira do "bom dia". Se
     * a conta fosse pela hora do servidor, dizia bom dia à hora de almoço.
     */
    const trezeEMeiaEmLisboa = new Date("2026-09-10T12:30:00.000Z");
    expect(trezeEMeiaEmLisboa.getUTCHours()).toBe(12);
    expect(saudacao(trezeEMeiaEmLisboa)).toBe("Boa tarde");
  });

  it("a madrugada é boa noite, e não bom dia", () => {
    expect(saudacao(emLisboa(9, 10, 3))).toBe("Boa noite");
  });
});

describe("a abertura é uma conversa, não uma apresentação", () => {
  it("não anuncia que é um assistente nem promete dois minutos", () => {
    const abertura = perguntaDo("servico", {}, false, emLisboa(9, 10, 9));
    expect(abertura).not.toContain("Sou o assistente");
    expect(abertura).not.toContain("dois minutos");
    // E o mesmo pela lista, que é o caminho de quando não há Gemini.
    expect(perguntaDo("servico", {}, true, emLisboa(9, 10, 9))).not.toContain("Sou o assistente");
  });

  it("cumprimenta pela hora e vai ao assunto", () => {
    expect(perguntaDo("servico", {}, false, emLisboa(9, 10, 9))).toContain("Bom dia");
    expect(perguntaDo("servico", {}, false, emLisboa(9, 10, 15))).toContain("Boa tarde");
    expect(perguntaDo("servico", {}, false, emLisboa(9, 10, 9))).toContain("Diga-me o que precisa");
  });

  it("as perguntas do acesso dizem para que servem", () => {
    // O andar e o elevador não são curiosidade: são o que decide quantas
    // pessoas vêm e quanto custa. Uma pergunta seca com "(sim/não)" ao fundo
    // não o diz.
    expect(perguntaDo("morada", {}, false)).toContain("é por aí que o profissional se orienta");
    expect(perguntaDo("elevador", {}, false)).toContain("cabe o que é para levar");
    expect(perguntaDo("nome", {}, false)).toBe("Com quem estou a falar?");
  });

  it("recomeçar não diz bom dia outra vez", () => {
    /*
     * Dois cumprimentos na mesma conversa é o defeito que `reperguntar` já
     * existia para evitar — e que voltaria pela porta do recomeço.
     */
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "recomecar", campos: {} },
      emLisboa(9, 10, 9),
    );
    expect(r.resposta).not.toContain("Bom dia");
    expect(r.resposta).not.toContain("Aqui é a CLYON");
    expect(r.resposta).toContain("do princípio");
  });

  it("a saudação vive num sítio só", () => {
    // Escrita à mão em cada mensagem, bastava uma para ficar a dizer bom dia
    // à meia-noite.
    expect(RECOLHA).toContain("export function saudacao(");
    expect(RECOLHA).toContain('timeZone: "Europe/Lisbon"');
  });
});

describe("a ponte não toma a própria voz por uma resposta do dono", () => {
  it("marca o que vai enviar ANTES de enviar", () => {
    /*
     * O TESTE QUE IMPORTA DESTE FICHEIRO.
     *
     * Se a marca voltar para depois do `sendMessage`, volta a corrida — e com
     * ela um assistente que responde uma vez e nunca mais fala.
     */
    const enviar = PONTE_CLIENTE.slice(
      PONTE_CLIENTE.indexOf("async function enviar("),
      PONTE_CLIENTE.indexOf("/** Envia o que o site mandou"),
    );
    expect(enviar).toContain("marcarAEnviar(chave)");
    expect(enviar.indexOf("marcarAEnviar(chave)")).toBeLessThan(
      enviar.indexOf("client.sendMessage"),
    );
  });

  it("um envio que falha larga a marca — senão calava a entrega seguinte", () => {
    const enviar = PONTE_CLIENTE.slice(
      PONTE_CLIENTE.indexOf("async function enviar("),
      PONTE_CLIENTE.indexOf("/** Envia o que o site mandou"),
    );
    expect(enviar).toContain("desmarcarAEnviar(chave);");
    expect(enviar).toContain("throw e;");
  });

  it("a marca cai passado um minuto, e não fica para sempre", () => {
    // Uma marca eterna trocava o erro de lado: o dia em que o dono escrevesse
    // à mão o mesmo texto que o assistente já mandara, a entrega não disparava.
    expect(PONTE_CLIENTE).toContain("setTimeout(() => desmarcarAEnviar(chave), 60_000)");
  });

  it("quem vê sair uma mensagem verifica as DUAS marcas antes de entregar", () => {
    // A partir do `fromMe`: o cabeçalho do ficheiro também cita
    // `accao: "interromper"`, e vem antes.
    const i = PONTE_CLIENTE.indexOf("if (msg.fromMe) {");
    const aoVer = PONTE_CLIENTE.slice(i, PONTE_CLIENTE.indexOf('accao: "interromper"', i));
    expect(aoVer).toContain("enviadasPorMim.has(msg.id._serialized)");
    expect(aoVer).toContain("eraNossa(msg.body)");
  });

  it("a marca é o TEXTO, porque o número pode vir como @lid", () => {
    // Entre o que sai daqui e o que volta no evento pode haver um @lid pelo
    // meio; o texto é a única coisa que não muda.
    expect(PONTE_CLIENTE).toContain("const chaveDoEnvio = (texto) =>");
  });
});
