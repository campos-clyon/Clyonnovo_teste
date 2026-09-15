import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS ÚLTIMOS SÍTIOS ONDE OS DADOS DE ALGUÉM FICAVAM PARA TRÁS.
 *
 * Quatro, encontrados pela revisão adversarial de 15-09-2026 depois de as três
 * fugas maiores estarem fechadas. Nenhum deles se via de fora:
 *
 *   · o ponteiro para um evento que não saiu da agenda era apagado pela
 *     própria anonimização — desaparecia no dia do pedido de apagamento;
 *   · o nome do profissional ficava dentro do `detalheJson` de uma linha que a
 *     anonimização dele não apanhava;
 *   · o nome dele ficava também na folha do Google Sheets, para sempre;
 *   · «apagar a conversa» do WhatsApp deixava metade dela numa tabela ao lado.
 *
 * E uma minimização: a morada e a descrição do cliente continuam a ir para a
 * API do Gemini — são precisas para o resumo operacional — mas o nome não.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");

const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  /*
   * Corta na próxima declaração de topo OU no próximo comentário encostado à
   * margem — que é onde a função a seguir começa a ser explicada. Sem a
   * segunda âncora, o corpo corria por cima das funções seguintes e um
   * `not.toContain` passava a olhar para código de outra pessoa.
   */
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──|\/\*)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("a lista dos eventos por apagar", () => {
  it("existe, e não guarda nada que identifique ninguém", () => {
    /*
     * É de propósito que aqui só há ids: esta tabela tem de SOBREVIVER à
     * anonimização, e só pode se não tiver lá dentro nada da pessoa. Era esse
     * o buraco — o ponteiro vivia no `detalheJson` do registo, que
     * `anonimizarRegisto` põe a NULL.
     */
    const i = DB.indexOf("CREATE TABLE IF NOT EXISTS eventosPorApagar");
    expect(i, "a tabela não existe").toBeGreaterThan(-1);
    const tabela = DB.slice(i, DB.indexOf(") ENGINE=InnoDB", i));
    for (const proibida of ["nome", "email", "telefone", "morada", "texto"]) {
      expect(tabela.toLowerCase()).not.toContain(proibida);
    }
    expect(tabela).toContain("eventId");
    expect(tabela).toContain("calendarId");
  });

  it("um evento que não saiu entra na lista", () => {
    const apagar = corpoDe("deleteSimulatorOrder");
    expect(apagar).toContain("guardarEventoPorApagar(");
    // A lista primeiro, o registo depois: a lista é o que faz alguma coisa
    // acontecer amanhã; o registo é para se ler.
    expect(apagar.indexOf("guardarEventoPorApagar(")).toBeLessThan(
      apagar.indexOf("registarSemFalhar("),
    );
  });

  it("e o apagar da conta do cliente também a usa", () => {
    const rota = ler("src/app/api/users/me/route.ts");
    expect(rota).toContain("guardarEventoPorApagar(");
  });

  it("o cron tenta-os todas as noites, armada ou não", () => {
    /*
     * Não apagam pedido nenhum — arrumam o que já foi apagado. Travá-los com
     * a mesma trava da purga deixava dados pessoais numa agenda à espera de
     * uma decisão que não é sobre eles.
     */
    const rota = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(rota).toContain("tentarOsEventosPorApagar(");
    const bloco = rota.slice(rota.indexOf("tentarOsEventosPorApagar("));
    expect(bloco.slice(0, 300)).not.toContain("armada");
  });

  it("sai da lista quando o trabalho está feito, e não antes", () => {
    const tentar = corpoDe("tentarOsEventosPorApagar");
    // Apagado ou «já tinha sido apagado» (410) — nos dois casos, feito.
    expect(tentar).toContain("if (fim.apagado || fim.naoExistia)");
    expect(tentar).toContain("DELETE FROM eventosPorApagar WHERE id = ?");
    // Um 404 fica: pode ser a agenda a ter deixado de estar partilhada, e isso
    // arranja-se. Ao fim de muitas noites desiste-se, com o id nos registos.
    expect(tentar).toContain("TENTATIVAS_ATE_DESISTIR");
    expect(DB).toMatch(/TENTATIVAS_ATE_DESISTIR = \d+/);
  });

  it("nunca estoira quem a está a usar", () => {
    // Quem chama está a acabar de apagar um pedido ou uma conta.
    const guardar = corpoDe("guardarEventoPorApagar");
    expect(guardar).toContain("try {");
    expect(guardar).toContain("catch");
  });
});

describe("o nome do profissional não fica escondido no JSON", () => {
  it("o retrato leva o número, e não o nome", () => {
    /*
     * `anonimizarRegisto` procura por `clienteEmail = ? OR providerId = ?`. A
     * linha-retrato não leva providerId na coluna — leva vários profissionais
     * dentro do detalhe — por isso não casava com o WHERE e o nome ficava lá
     * para sempre depois de ele apagar a conta.
     */
    const apagar = corpoDe("deleteSimulatorOrder");
    const retrato = apagar.slice(apagar.indexOf("negociacoes: negociacoes.map("));
    expect(retrato.slice(0, 400)).toContain("providerId: Number(n.providerId)");
    expect(retrato.slice(0, 400)).not.toContain("profissional:");
  });

  it("o nome continua a existir na linha que a anonimização apanha", () => {
    // Não se perde: há uma linha por profissional, com providerId na coluna.
    const apagar = corpoDe("deleteSimulatorOrder");
    expect(apagar).toContain("providerNome: (n.profissionalNome as string) ?? null");
    expect(apagar).toContain("providerId: Number(n.providerId)");
  });
});

describe("a folha do Google Sheets", () => {
  const FOLHA = ler("src/lib/google-sheets.ts");

  it("sabe tirar o nome de um profissional", () => {
    expect(FOLHA).toContain("export async function limparNomeDoProfissionalNaFolha(");
  });

  it("encontra as linhas pelo NÚMERO DO PEDIDO, e não pelo nome", () => {
    // Dois profissionais podem chamar-se o mesmo, e apagar a conta de um não
    // pode levar o nome do outro.
    const f = FOLHA.slice(FOLHA.indexOf("export async function limparNomeDoProfissionalNaFolha("));
    expect(f).toContain('range: "A:A"');
    expect(f).toContain("procurados.has(idNaFolha)");
  });

  it("nunca atira — uma folha de cálculo não pode travar o apagar de uma conta", () => {
    const f = FOLHA.slice(FOLHA.indexOf("export async function limparNomeDoProfissionalNaFolha("));
    expect(f).toContain("try {");
    expect(f).toContain("return 0;");
  });

  it("e o apagar da conta chama-a", () => {
    const apagar = corpoDe("apagarProfissional");
    expect(apagar).toContain("limparNomeDoProfissionalNaFolha(pedidosDele)");
    // Depois do commit, como tudo o que vive fora da base.
    expect(apagar.indexOf("limparNomeDoProfissionalNaFolha")).toBeGreaterThan(
      apagar.indexOf("conn.commit()"),
    );
  });
});

describe("apagar a conversa apaga a conversa toda", () => {
  it("a fila sai inteira, e não só o que ainda não tinha saído", () => {
    /*
     * Tinha `enviadoEm IS NULL`. Cada linha já entregue guarda o TEXTO da
     * resposta, e as respostas do assistente citam o nome, a morada e o resumo
     * do pedido. O painel dizia «conversa apagada» e o fio continuava numa
     * tabela ao lado.
     */
    const apagar = corpoDe("apagarConversaWhatsApp");
    // A INSTRUÇÃO, e não o ficheiro: o comentário que explica esta correcção
    // cita a condição que foi tirada, e um teste que proíba a frase no texto
    // todo chumba por causa da própria explicação.
    const i = apagar.indexOf("DELETE FROM whatsappFila");
    expect(i, "o DELETE da fila não foi encontrado").toBeGreaterThan(-1);
    const instrucao = apagar.slice(i, apagar.indexOf('"', i + 25));
    expect(instrucao).toContain("RIGHT(telefone, 9)");
    expect(instrucao).not.toContain("enviadoEm");
  });
});

describe("o que sai para o Gemini", () => {
  it("leva a morada e a descrição, que são precisas — e não leva o nome", () => {
    /*
     * O resumo operacional é para a equipa saber onde vai e o que leva. O nome
     * não entra em nada disso, e isto é uma transferência para um terceiro sem
     * caminho de apagamento nenhum.
     */
    const H = ler("src/lib/calendar-helpers.ts");
    const i = H.indexOf("export async function generateOperationalSummary(");
    expect(i).toBeGreaterThan(-1);
    const corpo = H.slice(i, H.indexOf("\nexport ", i + 1));
    expect(corpo).not.toContain("Cliente: ${order.contactName");
    expect(corpo).toContain("Descrição original: ${order.description");
  });

  it("a ficha do evento continua a levar o nome, escrita por nós", () => {
    // Não se perde nada: o nome vai em campo próprio, sem passar por modelo.
    const H = ler("src/lib/calendar-helpers.ts");
    expect(H).toContain("buildStructuredDescription");
    expect(H).toMatch(/Nome/);
  });
});
