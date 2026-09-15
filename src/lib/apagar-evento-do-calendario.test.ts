import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agendaDaClyon,
  chavePrivada,
  eEventoASerio,
  apagarEventoDoCalendario,
} from "./apagar-evento-do-calendario";

/**
 * O EVENTO NA AGENDA TEM DE SE IR COM O PEDIDO.
 *
 * Verificado a 14-09-2026: não havia um único `events.delete` no repositório.
 * Apagava-se um pedido — à mão ou pela purga — e ficava, na agenda partilhada
 * da CLYON, um evento com o nome do cliente, o telefone, a morada e o andar.
 * Pior, o `calendarEventId` era a única forma de lá chegar e ia-se com a
 * linha: o evento ficava sem ninguém saber que existia.
 *
 * Este ficheiro guarda quatro coisas: que se apaga, que se apaga na agenda
 * CERTA, que falhar não desfaz o apagar do pedido, e que o ponteiro fica
 * escrito no registo antes de a linha se ir.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");

/** O corpo de uma função de db.ts — a mesma âncora da purga, e pela mesma razão (CRLF). */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

const ANTES = { ...process.env };
afterEach(() => {
  process.env.CLYON_GOOGLE_CALENDAR_ID = ANTES.CLYON_GOOGLE_CALENDAR_ID;
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = ANTES.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  process.env.GOOGLE_PRIVATE_KEY = ANTES.GOOGLE_PRIVATE_KEY;
});

describe("a chave privada", () => {
  /*
   * ESTE É O TESTE QUE FALTAVA, E CUSTOU CARO.
   *
   * A primeira versão desta função escrevia `.replace(/\n/g, "\n")` — num
   * literal de expressão regular, `/\n/` é a quebra de linha a sério, e o
   * substituto é a mesma quebra de linha. Trocava uma quebra de linha por uma
   * quebra de linha: não fazia nada. A chave chegava ao Google numa linha só,
   * a assinatura rebentava, e o apagar do evento devolvia erro em TODAS as
   * chamadas. Uma funcionalidade inteira, feita por causa do RGPD, que nunca
   * teria apagado um único evento em produção.
   *
   * Os testes estavam todos verdes: o único que mexia em credenciais era o do
   * caminho SEM credenciais, onde a chave nem chega a ser usada.
   */
  const PEM =
    "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\\nAAAAAAAA\\n-----END PRIVATE KEY-----\\n";

  it("desescapa os \\n literais em quebras de linha a sério", () => {
    const k = chavePrivada(PEM);
    expect(k).not.toContain("\\n");
    expect(k.split("\n").length).toBeGreaterThan(3);
  });

  it("o que sai é um PEM que começa onde deve", () => {
    expect(chavePrivada(PEM).startsWith("-----BEGIN")).toBe(true);
  });

  it("aspas à volta do valor não entram na chave", () => {
    // É como ela chega quando alguém a cola com aspas na Vercel.
    expect(chavePrivada(`"${PEM}"`).startsWith("-----BEGIN")).toBe(true);
  });

  it("uma chave já com quebras a sério passa na mesma", () => {
    // Desescapar o que já está desescapado tem de ser inofensivo.
    const real = PEM.replace(/\\n/g, "\n");
    expect(chavePrivada(real)).toBe(real.trim());
  });

  it("os \\r do Windows saem", () => {
    expect(chavePrivada("-----BEGIN\\nabc\r\n-----END")).not.toContain("\r");
  });
});

describe("que evento é a sério", () => {
  it("um id vazio não é evento nenhum", () => {
    expect(eEventoASerio(null)).toBe(false);
    expect(eEventoASerio(undefined)).toBe(false);
    expect(eEventoASerio("")).toBe(false);
    expect(eEventoASerio("   ")).toBe(false);
  });

  it("clyon-order-... é marca nossa, não é evento da Google", () => {
    // A própria rota o trata como "ainda não existe evento". Pedir à Google
    // que o apague é uma chamada de rede para receber um 404.
    expect(eEventoASerio("clyon-order-311")).toBe(false);
    expect(eEventoASerio("abc123def456")).toBe(true);
  });
});

describe("a agenda certa", () => {
  it("a que o pedido guardou manda sobre a variável de hoje", () => {
    // A variável pode ter mudado depois de o evento ser criado. Apagar na
    // agenda de hoje um evento que ficou na de ontem não apaga nada.
    process.env.CLYON_GOOGLE_CALENDAR_ID = "nova@clyon.pt";
    expect(agendaDaClyon("antiga@clyon.pt")).toBe("antiga@clyon.pt");
  });

  it("sem a do pedido, a da variável", () => {
    process.env.CLYON_GOOGLE_CALENDAR_ID = "nova@clyon.pt";
    expect(agendaDaClyon(null)).toBe("nova@clyon.pt");
    expect(agendaDaClyon("")).toBe("nova@clyon.pt");
  });

  it("um id de exemplo por substituir não conta, venha de onde vier", () => {
    process.env.CLYON_GOOGLE_CALENDAR_ID = "<id real da agenda>";
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
    expect(agendaDaClyon("<por preencher>")).toBe("geral@clyon.pt");
  });

  it("sem variável nenhuma, a agenda conhecida", () => {
    delete process.env.CLYON_GOOGLE_CALENDAR_ID;
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
  });

  it("aspas e quebras de linha à volta do valor não estragam o id", () => {
    // É como ele chega da Vercel quando alguém o cola com aspas.
    process.env.CLYON_GOOGLE_CALENDAR_ID = '"geral@clyon.pt"\n';
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
  });
});

describe("apagar, e nunca atirar", () => {
  it("sem id, não há chamada nenhuma à Google", async () => {
    const r = await apagarEventoDoCalendario(null);
    expect(r.apagado).toBe(false);
    expect(r.naoExistia).toBe(true);
    expect(r.erro).toBeUndefined();
  });

  it("um marcador clyon-order- também não sai da máquina", async () => {
    const r = await apagarEventoDoCalendario("clyon-order-311");
    expect(r.naoExistia).toBe(true);
  });

  it("não classifica o erro pelo texto da mensagem", async () => {
    /*
     * Fazia `/not found/i.test(msg)` e lia «invalid_grant: Invalid grant:
     * account not found» — a service account apagada no Google Cloud, uma
     * avaria de autenticação — como «o evento já não estava». Com a agenda
     * inteira intacta e nada apagado, escrevia-se uma noite de sucessos.
     */
    const fonte = ler("src/lib/apagar-evento-do-calendario.ts");
    // Só o CÓDIGO do catch, e não o ficheiro inteiro: o comentário que explica
    // este erro cita-o à letra, e um teste que proíbe uma frase não pode
    // chumbar por causa da explicação de porque é que ela foi tirada.
    const i = fonte.indexOf("} catch (e) {");
    expect(i, "o catch não foi encontrado").toBeGreaterThan(-1);
    const apanha = fonte.slice(i);
    expect(apanha).not.toContain("/not found");
    expect(apanha).not.toMatch(/test\(msg\)/);
    expect(fonte).toContain("function codigoDaResposta(");
    // O código vem da RESPOSTA. Sem resposta — rede, DNS, token — nunca é
    // «já não estava».
    expect(fonte).toContain("err?.response?.status ?? err?.status ?? err?.code");
  });

  it("separa o 404 do 410 — um 404 pode ser a agenda, e não o evento", () => {
    // A Google responde 404 tanto a «este evento já não existe» como a «esta
    // agenda não está partilhada contigo». Cem seguidos são configuração
    // partida, e contá-los como apagados escondia isso.
    const fonte = ler("src/lib/apagar-evento-do-calendario.ts");
    expect(fonte).toContain("codigo === 410");
    expect(fonte).toContain("codigo === 404");
    expect(fonte).toContain("naoEncontrado");
    const db = ler("src/lib/db.ts");
    expect(db).toContain("eventosNaoEncontrados");
  });

  it("sem credenciais devolve o motivo em vez de estoirar", async () => {
    // Quem chama está a acabar de apagar um pedido. Uma excepção aqui subia
    // por cima de uma transacção já fechada e fazia parecer que o apagar
    // falhou, quando o pedido já se foi.
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    const r = await apagarEventoDoCalendario("abc123def456");
    expect(r.apagado).toBe(false);
    expect(r.erro).toBeTruthy();
    expect(r.naoExistia).toBeFalsy();
  });
});

describe("o pedido leva o evento consigo", () => {
  const apagar = corpoDe("deleteSimulatorOrder");

  it("lê o id do evento ANTES do DELETE — depois não há a quem perguntar", () => {
    expect(apagar).toContain("calendarEventId, calendarTargetId");
    const leitura = apagar.indexOf("calendarEventId, calendarTargetId");
    const morte = apagar.indexOf("DELETE FROM simulatorOrders");
    expect(leitura).toBeGreaterThan(-1);
    expect(morte).toBeGreaterThan(leitura);
  });

  it("apaga o evento DEPOIS da transacção fechar", () => {
    // A mesma ordem das fotografias no Blob: uma chamada de rede a meio da
    // transacção prende a linha na base enquanto se espera pela internet.
    const commit = apagar.indexOf("conn.commit()");
    const evento = apagar.indexOf("apagarEventoDoCalendario(");
    expect(commit).toBeGreaterThan(-1);
    expect(evento).toBeGreaterThan(commit);
  });

  it("o ponteiro fica no registo antes de a linha se ir", () => {
    // Se a Google estiver em baixo, é isto que permite apagar o evento à mão.
    // Sem ele, o id desaparecia com o pedido.
    const registo = apagar.indexOf("calendarEventId: (pedido?.calendarEventId");
    const morte = apagar.indexOf("DELETE FROM simulatorOrders");
    expect(registo).toBeGreaterThan(-1);
    expect(morte).toBeGreaterThan(registo);
  });
});

describe("apagar a conta leva os eventos", () => {
  /*
   * O BURACO MAIOR DOS TRÊS, e logo no caminho do RGPD.
   *
   * A pessoa escreve ELIMINAR em /conta. A linha do pedido era anonimizada, as
   * fotografias saíam do Blob — e o evento, com o nome, o telefone, a morada,
   * o andar e a descrição que ela própria escreveu, ficava na agenda. Nem a
   * purga lá chegava: um pedido agendado quase sempre tem negociação com
   * valor, e a guarda do dinheiro protege-o para sempre.
   */
  const conta = corpoDe("apagarContaDeCliente");

  it("lê o evento antes de a linha ser anonimizada", () => {
    const leitura = conta.indexOf("calendarEventId, calendarTargetId");
    const anonimiza = conta.indexOf("SET contactName = NULL");
    expect(leitura).toBeGreaterThan(-1);
    expect(anonimiza).toBeGreaterThan(leitura);
  });

  it("devolve-os a quem chamou, como as fotografias", () => {
    expect(conta).toContain("eventos.push(");
    expect(conta).toContain("return { pedidos: pedidos.length, registosAnonimizados, fotos, eventos }");
  });

  it("e a rota apaga-os depois da resposta", () => {
    // Uma chamada de rede por evento à frente de quem está a fechar a conta
    // fazia-o esperar por arrumação que já não é o pedido dele.
    const rota = ler("src/app/api/users/me/route.ts");
    expect(rota).toContain("apagarEventoDoCalendario(ev.eventId, ev.calendarId)");
    const after = rota.indexOf("if (r.eventos.length > 0)");
    expect(after).toBeGreaterThan(-1);
    expect(rota.slice(after, after + 200)).toContain("after(");
  });
});

describe("a fila do WhatsApp também tem prazo", () => {
  it("o texto já entregue sai aos 60 dias, como as mensagens", () => {
    /*
     * `whatsappFila` guarda o telefone e o TEXTO de cada resposta que sai — e
     * as respostas do assistente citam o nome, a morada e o resumo do pedido.
     * As mensagens têm limpeza aos 60 dias desde sempre; a fila não tinha
     * nenhuma, e o único DELETE por número só apanha o que ainda não saiu.
     */
    const fila = corpoDe("guardarNaFilaWhatsApp");
    expect(fila).toContain("DELETE FROM whatsappFila WHERE enviadoEm IS NOT NULL");
    expect(fila).toContain("INTERVAL 60 DAY");
    // O que está por sair ainda é trabalho por fazer, e não tem idade nenhuma.
    expect(fila).toContain("enviadoEm IS NOT NULL AND enviadoEm <");
  });
});

describe("a purga conta os eventos", () => {
  const purga = corpoDe("purgarPedidosTerminados");

  it("diz quantos saíram da agenda", () => {
    expect(purga).toContain("eventosApagados");
  });

  it("nunca em silêncio: um evento que ficou é dado pessoal que sobreviveu", () => {
    expect(purga).toContain("eventosQueFicaram");
    const rota = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(rota).toContain("r.eventosQueFicaram");
  });

  it("um evento que ficou é dito a quem apagou à mão, e não só ao cron", () => {
    /*
     * As três rotas do backoffice que apagam um pedido não olham para o que
     * `deleteSimulatorOrder` devolve: respondiam «Pedido excluído com
     * sucesso» com o nome, o telefone e a morada ainda na agenda. E é o
     * caminho humano que se usa quando alguém pede o apagamento dos dados.
     * Escreve-se no registo, que o painel da retenção lê.
     */
    const apagar = corpoDe("deleteSimulatorOrder");
    expect(apagar).toContain("if (ficouNaAgenda)");
    expect(apagar).toContain("registarSemFalhar");
    expect(apagar).toContain("NÃO saiu");
  });

  it("um trabalho marcado para o futuro não é apagado nem perde o evento", () => {
    /*
     * O relógio da purga é a última vez que a LINHA mexeu, não o dia do
     * trabalho. Uma mudança reservada em Janeiro para Julho ficava com o
     * relógio em Janeiro e era apanhada em Abril — e desde que a purga apaga
     * o evento, some a linha E some o evento, e a equipa não aparece no dia.
     */
    expect(purga).toContain("o.scheduledDate IS NULL OR o.scheduledDate < CURDATE()");
  });

  it("o modo seco conta-os sem lhes tocar", () => {
    // O número que se quer ver ANTES de armar: quantos eventos com nome,
    // telefone e morada saem da agenda na primeira passagem a sério.
    expect(DB).toContain("async function contarEventosDe(");
    expect(purga).toContain("await contarEventosDe(ids)");
    const conta = DB.slice(DB.indexOf("async function contarEventosDe("));
    expect(conta.slice(0, 900)).toContain("SELECT COUNT(*)");
    // Uma contagem que apagasse alguma coisa deixava de ser modo seco.
    expect(conta.slice(0, 900)).not.toContain("DELETE");
  });
});
