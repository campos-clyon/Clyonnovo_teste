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

describe("uma conversa entregue a uma pessoa continua a ficar escrita", () => {
  const PONTE = ler("src/app/api/whatsapp/ponte/route.ts");

  it("a mensagem do cliente regista-se ANTES de o site se calar", () => {
    /*
     * Calar o assistente e não guardar a conversa são duas decisões
     * diferentes, e só a primeira foi pedida. Voltava-se para trás sem
     * escrever nada, e o painel — onde a pessoa que ficou com a conversa vai
     * ler — ficava cego: três mensagens seguidas de uma cliente às 16:49 e
     * nenhuma no ecrã.
     */
    const i = PONTE.indexOf("if (await numeroInterrompidoWhatsApp(telefone)) {");
    const bloco = PONTE.slice(i, PONTE.indexOf("return NextResponse.json({ meu: true, paraEnviar: [] });", i));
    expect(bloco).toContain('registarMensagemWhatsApp(telefone, "in", texto)');
    expect(bloco).toContain('registarMensagemWhatsApp(telefone, "in", "[fotografia]")');
  });

  it("mas o cérebro NÃO lhe responde — a conversa é da pessoa", () => {
    const i = PONTE.indexOf("if (await numeroInterrompidoWhatsApp(telefone)) {");
    const bloco = PONTE.slice(i, PONTE.indexOf("return NextResponse.json({ meu: true, paraEnviar: [] });", i));
    expect(bloco).not.toContain("tratarMensagemDoCliente");
    // E a fila continua vazia: nada sai por este caminho.
    expect(PONTE.slice(i, i + 900)).toContain("paraEnviar: []");
  });

  it("um bloqueado continua a não deixar rasto — esse foi mesmo o pedido", () => {
    // Bloquear é "nunca mais recebem nada, e o que escreverem é ignorado".
    const i = PONTE.indexOf("numeroBloqueadoWhatsApp(telefone)");
    const bloco = PONTE.slice(i, i + 200);
    expect(bloco).not.toContain("registarMensagemWhatsApp");
  });
});

describe("a ponte aguenta um arranque lento, e não morre à primeira", () => {
  it("dá ao Chromium mais do que os 180 s por omissão", () => {
    /*
     * O `Client.inject` da whatsapp-web.js corre um `page.evaluate` enorme, e
     * o puppeteer desiste ao fim de 180 s. Num contentor pequeno isso não
     * chega. Apanhou-se ao segundo nos registos de 11-09-2026: emparelhou às
     * 01:14:43 e rebentou às 01:17:43 — exactamente os 180 s — com
     * «ProtocolError: Runtime.callFunctionOn timed out».
     */
    expect(PONTE_CLIENTE).toContain("protocolTimeout:");
    const m = PONTE_CLIENTE.match(/protocolTimeout:\s*(\d+)\s*\*\s*(\d+)_?(\d*)/);
    expect(m, "o protocolTimeout tem de estar escrito em minutos").not.toBeNull();
    const ms = Number(m![1]) * Number(`${m![2]}${m![3]}`);
    expect(ms).toBeGreaterThan(180_000);
  });

  it("um arranque falhado espera e tenta outra vez — não faz exit", () => {
    /*
     * `process.exit(1)` punha o Railway a reiniciar, e cada volta paga o
     * arranque a frio outra vez — o que torna a volta seguinte MAIS provável
     * de falhar. O ciclo alimenta-se a si próprio.
     */
    const i = PONTE_CLIENTE.indexOf("while (!(await confirmarOSite()))");
    const fim = PONTE_CLIENTE.slice(i);
    expect(fim).toContain("await arrancar();");
    expect(fim).toContain("espera = Math.min(espera * 2");
  });

  it("mata o Chromium pendurado antes de tentar de novo", () => {
    // Senão o `destrancarOPerfil` da tentativa seguinte apaga uma tranca que
    // ainda tem dono, e ficam dois a disputar o mesmo perfil.
    const i = PONTE_CLIENTE.indexOf("while (!(await confirmarOSite()))");
    const fim = PONTE_CLIENTE.slice(i);
    expect(fim).toContain("await client?.destroy();");
    expect(fim.indexOf("await client?.destroy();")).toBeLessThan(
      fim.indexOf("espera = Math.min(espera * 2"),
    );
  });
});

describe("sem chave e falhou não são a mesma avaria", () => {
  const ROTA_ADMIN = ler("src/app/api/admin/whatsapp/route.ts");

  it("a releitura diz QUAL das duas, porque têm donos diferentes", () => {
    /*
     * Dizia "sem chave do Gemini, ou a leitura falhou" — e quem lê aquilo não
     * sabe se tem de ir à Vercel pôr uma variável ou se basta carregar outra
     * vez.
     */
    const i = ROTA_ADMIN.indexOf("const semChave = !compreensaoDisponivel();");
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA_ADMIN.slice(i, i + 900);
    expect(bloco).toContain("falta a GEMINI_API_KEY");
    expect(bloco).toContain("[whatsapp/compreensao]");
  });

  it("a chave que o código lê é a que o .env.example documenta", () => {
    // Há um GOOGLE_API_KEY neste projecto que é outra coisa — Maps. Trocá-los
    // deixa o assistente a responder pela lista numerada sem ninguém perceber.
    const EXEMPLO = ler(".env.example");
    expect(ler("src/lib/whatsapp-compreensao.ts")).toContain("process.env.GEMINI_API_KEY");
    expect(EXEMPLO).toMatch(/^GEMINI_API_KEY=/m);
  });
});

describe("o .env.example não esconde o que desliga produção", () => {
  const EXEMPLO = ler(".env.example");

  it("a CRON_SECRET está lá, e diz o que se cala sem ela", () => {
    /*
     * Faltava. As duas rotas de cron falham fechadas de propósito — mas em
     * silêncio: a Vercel chama, recebe 503, e mais nada. Quem monta um
     * ambiente novo não tinha como saber que a purga e a libertação por prazo
     * dependem disto.
     */
    expect(EXEMPLO).toMatch(/^CRON_SECRET=/m);
    expect(EXEMPLO).toContain("/api/cron/purgar-pedidos");
    expect(EXEMPLO).toContain("/api/cron/libertar-por-prazo");
  });

  it("e o segredo da ponte também", () => {
    expect(EXEMPLO).toMatch(/^PONTE_WHATSAPP_SEGREDO=/m);
  });
});
