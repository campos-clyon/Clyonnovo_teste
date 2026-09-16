import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROTULO_DA_ORIGEM,
  TIPOS_DE_CONVERSA,
  chaveDaConversa,
  conversaDoHistorico,
  lerChave,
  ordenarConversas,
  porResponder,
  semOEmbrulho,
  ultimaEm,
  type ConversaDeSuporte,
} from "./conversas-de-suporte";

/**
 * TODAS AS MENSAGENS NUM SÍTIO SÓ.
 *
 * "Abra um chat directo para o suporte falar com os clientes e pros por aqui.
 * Hoje recebi uma mensagem vinda de uma cliente com dúvida no seu pedido, mas
 * ela ficou presa ao pedido e agora não sei qual era. Faça com que todas as
 * mensagens venham parar aqui, devidamente separadas como no WhatsApp."
 * — 13-09-2026.
 *
 * A avaria não era de desenho. Uma resposta de cliente é gravada como uma linha
 * no `historyJson` do pedido dela, e não existia consulta nenhuma, em lado
 * nenhum, que procurasse essas linhas: para ler a mensagem era preciso abrir o
 * pedido certo, e para saber qual era o pedido certo era preciso já ter lido a
 * mensagem. Uma conversa por dia a cair nesse buraco.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const PURO = ler("src/lib/conversas-de-suporte.ts");
const ROTA = ler("src/app/api/admin/suporte/conversas/route.ts");
const PAINEL = ler("src/components/admin/AdminConversasPanel.tsx");
const ECRA = ler("src/components/admin/LegacyAdminClient.tsx");
const AJUDA_PAINEL = ler("src/components/admin/AdminAjudaPanel.tsx");

const historico = (...entradas: Array<Record<string, unknown>>) => JSON.stringify(entradas);

describe("a conversa que estava presa dentro do pedido", () => {
  it("a pergunta da cliente e a nossa resposta saem por ordem, e de lados diferentes", () => {
    const fio = conversaDoHistorico(
      historico(
        { type: "info_requested", message: "Pode dizer-nos o andar?", createdAt: "2026-09-13T09:00:00Z" },
        { type: "client_reply", message: "3.º sem elevador", createdAt: "2026-09-13T09:10:00Z" },
      ),
    );
    expect(fio.map((m) => m.de)).toEqual(["clyon", "eles"]);
    expect(fio.map((m) => m.texto)).toEqual(["Pode dizer-nos o andar?", "3.º sem elevador"]);
  });

  it("o que é registo de operação NÃO é conversa", () => {
    /*
     * O histórico de um pedido guarda tudo: atribuições, mudanças de estado,
     * valores corrigidos. Se isso entrasse no fio, a pergunta da cliente ficava
     * outra vez enterrada — só que agora num ecrã novo.
     */
    const fio = conversaDoHistorico(
      historico(
        { type: "assigned", message: "Pedido atribuído a Ana.", createdAt: "2026-09-13T08:00:00Z" },
        { type: "status_change", message: "Passou a orçamentado.", createdAt: "2026-09-13T08:01:00Z" },
        { type: "client_reply", message: "Obrigada!", createdAt: "2026-09-13T08:02:00Z" },
      ),
    );
    expect(fio).toHaveLength(1);
    expect(fio[0].texto).toBe("Obrigada!");
  });

  it("uma entrada sem texto não vira balão vazio", () => {
    const fio = conversaDoHistorico(
      historico(
        { type: "client_reply", message: "   ", createdAt: "2026-09-13T08:00:00Z" },
        { type: "client_reply", createdAt: "2026-09-13T08:01:00Z" },
      ),
    );
    expect(fio).toEqual([]);
  });

  it("um histórico estragado cala-se, e não cala o ecrã inteiro", () => {
    // Um pedido com JSON meio escrito não pode levar os outros atrás.
    expect(conversaDoHistorico("{isto não é json")).toEqual([]);
    expect(conversaDoHistorico(null)).toEqual([]);
    expect(conversaDoHistorico('{"type":"client_reply"}')).toEqual([]);
    expect(conversaDoHistorico(historico({ type: "client_reply" }, null as never))).toEqual([]);
  });

  it("guarda quem escreveu do nosso lado, quando se sabe", () => {
    const fio = conversaDoHistorico(
      historico({
        type: "message_to_client",
        message: "Já falámos com o profissional.",
        createdAt: "2026-09-13T10:00:00Z",
        by: { id: 2, nome: "Ana", role: "assistente" },
      }),
    );
    expect(fio[0].autor).toBe("Ana");
  });
});

describe("o embrulho do registo não vai para o balão", () => {
  it("tira a frase com que o pedido de informação foi gravado", () => {
    expect(
      semOEmbrulho('Pedido de informação enviado ao cliente: "Pode dizer-nos o andar?"'),
    ).toBe("Pode dizer-nos o andar?");
  });

  it("se o formato mudar, fica o texto inteiro — feio, nunca vazio", () => {
    const outro = "Enviámos-lhe uma pergunta.";
    expect(semOEmbrulho(outro)).toBe(outro);
  });
});

describe("a ordem da caixa de entrada", () => {
  const conversa = (
    chave: string,
    ultimaDe: "eles" | "clyon",
    quando: string,
  ): ConversaDeSuporte => ({
    chave,
    origem: "pedido",
    quem: chave,
    contacto: null,
    pedidoId: 1,
    assunto: null,
    mensagens: [{ de: ultimaDe, texto: "olá", quando }],
  });

  it("quem está à espera de nós vem primeiro, mesmo sendo mais antigo", () => {
    /*
     * É o único critério que interessa a quem abre isto de manhã: a bola está
     * do lado de cá. Uma conversa nossa, acabada de enviar, não precisa de
     * nada de ninguém — e estava a ocupar o topo só por ser recente.
     */
    const ordenadas = ordenarConversas([
      conversa("nossa-recente", "clyon", "2026-09-13T18:00:00Z"),
      conversa("dela-antiga", "eles", "2026-09-11T09:00:00Z"),
    ]);
    expect(ordenadas.map((c) => c.chave)).toEqual(["dela-antiga", "nossa-recente"]);
  });

  it("dentro do mesmo grupo, a mais recente à frente", () => {
    const ordenadas = ordenarConversas([
      conversa("a", "eles", "2026-09-11T09:00:00Z"),
      conversa("b", "eles", "2026-09-13T09:00:00Z"),
    ]);
    expect(ordenadas.map((c) => c.chave)).toEqual(["b", "a"]);
  });

  it("não mexe na lista que recebeu", () => {
    const original = [conversa("a", "eles", "2026-09-11T09:00:00Z"), conversa("b", "clyon", "2026-09-13T09:00:00Z")];
    const antes = original.map((c) => c.chave);
    ordenarConversas(original);
    expect(original.map((c) => c.chave)).toEqual(antes);
  });

  it("uma data que a base devolveu com espaço em vez de T continua a ordenar", () => {
    // O MySQL devolve "2026-09-13 09:00:00". Sem isto, todas empatavam a zero
    // e a lista vinha por ordem de chegada das consultas.
    expect(ultimaEm(conversa("a", "eles", "2026-09-13 09:00:00"))).toBeGreaterThan(0);
  });

  it("uma conversa sem mensagens não parte a ordenação", () => {
    const vazia: ConversaDeSuporte = { ...conversa("z", "eles", "2026-09-13T09:00:00Z"), mensagens: [] };
    expect(porResponder(vazia)).toBe(false);
    expect(ultimaEm(vazia)).toBe(0);
    expect(() => ordenarConversas([vazia])).not.toThrow();
  });
});

describe("o endereço da conversa", () => {
  it("vai e volta", () => {
    expect(lerChave(chaveDaConversa("pedido", 283))).toEqual({ origem: "pedido", id: "283" });
    expect(lerChave(chaveDaConversa("app", "abc-123"))).toEqual({
      origem: "app",
      id: "abc-123",
    });
  });

  it("o mesmo número em origens diferentes são conversas diferentes", () => {
    /*
     * O #12 da plataforma e o #12 de um pedido são duas pessoas. Um id solto
     * mandava a resposta de uma para a caixa da outra.
     */
    expect(chaveDaConversa("pedido", 12)).not.toBe(chaveDaConversa("plataforma", 12));
  });

  it("recusa o que não reconhece", () => {
    expect(lerChave("")).toBeNull();
    expect(lerChave("283")).toBeNull();
    expect(lerChave(":283")).toBeNull();
    expect(lerChave("pedido:")).toBeNull();
    expect(lerChave("email:283")).toBeNull();
  });
});

describe("a consulta que foi buscar o que estava perdido", () => {
  const consulta = DB.slice(
    DB.indexOf("export async function pedidosComConversa"),
    DB.indexOf("export async function ajudaPorId"),
  );

  it("existe, e procura pelos tipos que a conversa reconhece", () => {
    expect(consulta.length).toBeGreaterThan(0);
    /*
     * Se alguém acrescentar um quarto tipo de mensagem à lista pura e se
     * esquecer do SQL, os pedidos com esse tipo deixam de aparecer na caixa de
     * entrada — a avaria original, outra vez, e outra vez em silêncio.
     */
    const noSql = [...consulta.matchAll(/historyJson LIKE '%"([a-z_]+)"%'/g)].map((m) => m[1]);
    expect([...noSql].sort()).toEqual([...TIPOS_DE_CONVERSA].sort());
  });

  it("está travada dos dois lados — pelo tempo e pelo número de linhas", () => {
    // Um LIKE sobre um LONGTEXT sem travão lê a tabela toda a cada abertura.
    expect(consulta).toContain("INTERVAL 180 DAY");
    expect(consulta).toContain("LIMIT");
  });

  it("traz o contacto, para se poder responder por fora se for preciso", () => {
    expect(consulta).toContain("contactEmail");
    expect(consulta).toContain("contactPhone");
  });
});

describe("o WhatsApp NÃO entra aqui", () => {
  /*
   * "Esse é o Suporte, não é para ser o WhatsApp. Eu pedi para ele ser
   * ORGANIZADO como o WhatsApp, mas não para trazer as suas conversas."
   * — 15-09-2026.
   *
   * Eu li o pedido a mais: «como no wpp» era sobre a FORMA — fio de balões em
   * vez de tabela de estados — e trouxe também o conteúdo. Esteve cá dois
   * dias. O WhatsApp tem o ecrã dele, com a mesa, os separadores, o assumir e
   * o bloquear; repeti-lo aqui dava dois sítios para responder à mesma pessoa
   * e enterrava o que só existe neste.
   */
  it("não é uma origem possível — o compilador não deixa", () => {
    expect(Object.keys(ROTULO_DA_ORIGEM)).toEqual(["pedido", "plataforma", "app"]);
  });

  it("a rota não lê a tabela das mensagens do WhatsApp", () => {
    const get = ROTA.slice(
      ROTA.indexOf("export async function GET"),
      ROTA.indexOf("export async function POST"),
    );
    expect(semNotas(get)).not.toContain("fiosRecentesWhatsApp");
    expect(semNotas(get)).not.toContain("whatsappMensagens");
  });

  it("o ecrã não promete WhatsApp no subtítulo", () => {
    /*
     * Dizia «de dentro de um pedido, do WhatsApp, da app ou da plataforma».
     * Uma promessa por cumprir no cabeçalho manda procurar aqui o que está
     * noutro sítio — e foi o que ficou para trás quando o canal saiu.
     */
    expect(ECRA).not.toContain("de dentro de um pedido, do WhatsApp");
  });

  it("a lista pede SEM CACHE — senão o Actualizar é um enfeite", () => {
    /*
     * Um GET que o browser guarde devolve a mesma lista ao carregar em
     * «Actualizar», e faz parecer que uma mudança no servidor não pegou.
     * Era o único painel deste backoffice a que isto faltava.
     */
    expect(PAINEL).toContain("cache: \"no-store\"");
  });

  it("e não há por onde responder por WhatsApp a partir daqui", () => {
    // Responder existe no painel do WhatsApp, que é onde a conversa vive.
    expect(semNotas(ROTA)).not.toContain("enviarTextoManualWhatsApp");
  });
});
describe("a resposta sai por onde a pergunta entrou", () => {
  const post = ROTA.slice(ROTA.indexOf("export async function POST"));

  it("uma pergunta feita dentro do pedido é respondida dentro do pedido", () => {
    const ramo = post.slice(post.indexOf('alvo.origem === "pedido"'), post.indexOf('alvo.origem === "plataforma"'));
    expect(ramo).toContain("appendOrderHistory");
    /*
     * `message_to_client` e não `info_requested`: a segunda empurra o pedido
     * para «precisa de informação», que é uma decisão de operação. Responder a
     * quem perguntou não pode fazer o pedido andar para trás na fila.
     */
    expect(ramo).toContain('type: "message_to_client"');
    expect(semNotas(ramo)).not.toContain('type: "info_requested"');
  });

  it("a ajuda da plataforma é respondida na plataforma, e as respostas acumulam-se", () => {
    const ramo = post.slice(post.indexOf('alvo.origem === "plataforma"'));
    expect(ramo).toContain("responderPedidoDeAjuda");
    expect(ramo).toContain("anteriores.push");
    // Respondeu-se: fica à espera de quem perguntou. Fechar é decisão de quem
    // lê a resposta, não de quem a escreve.
    expect(ramo).toContain('estado: "waiting_customer"');
  });

  it("a resposta da ajuda é gravada no MESMO formato que o painel da Ajuda lê", () => {
    /*
     * É a mesma linha da mesma tabela, escrita agora por duas telas. Com um
     * campo de nome diferente, cada tela mostrava a data da outra como
     * «Invalid Date» — e a data é metade do que se lê num fio.
     */
    expect(AJUDA_PAINEL).toContain("respostas: Array<{ texto: string; em: string; por: string }>");
    expect(ROTA).toContain("anteriores.push({ texto: texto.slice(0, 4000), em:");
  });


  it("uma chave que não se reconhece não escreve em lado nenhum", () => {
    expect(post).toContain("Conversa desconhecida.");
    expect(post).toContain("lerChave");
  });

  it("a rota é de quem entra no backoffice, e mais ninguém", () => {
    /*
     * CADA VERBO EXIGE ADMIN — e conta-se contra os verbos que existem, não
     * contra um número escrito à mão.
     *
     * Estava `toBe(2)`, e partiu-se ao acrescentar o PATCH que marca uma
     * conversa como lida. O problema de um número fixo não é partir-se: é que
     * a correcção óbvia — pôr 3 — passa a verde tanto um PATCH com guarda como
     * um sem ela. Assim, um verbo novo sem `requireAdmin` chumba.
     */
    const verbos = [
      ...ROTA.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g),
    ].map((m) => m[1]);
    expect(verbos.length).toBeGreaterThan(1);
    expect(ROTA.match(/requireAdmin\(req\)/g)?.length).toBe(verbos.length);
  });
});

describe("os três canais que não têm outro sítio", () => {
  const get = ROTA.slice(ROTA.indexOf("export async function GET"), ROTA.indexOf("export async function POST"));

  it("lê os três sítios que não têm ecrã próprio", () => {
    /*
     * A pergunta presa dentro de um pedido — a que deu origem a tudo isto —,
     * a ajuda escrita na plataforma, e os tickets da app. O WhatsApp tem o
     * ecrã dele e fica lá.
     */
    expect(get).toContain("pedidosComConversa()");
    expect(get).toContain("ajudasParaAdmin()");
    expect(get).toContain("support_tickets");
  });

  it("uma origem em baixo não apaga as outras da lista", () => {
    /*
     * Três consultas a três sítios diferentes. Se a da app rebentar,
     * as mensagens dos pedidos têm de aparecer na mesma — senão a avaria que
     * isto veio curar volta pela porta do lado.
     */
    expect(get.match(/catch \(e\)/g)?.length).toBe(3);
    expect(get).toContain("ordenarConversas(conversas)");
  });

  it("um ticket da app não finge ser um pedido deste painel", () => {
    /*
     * O ticket tem um `request_id`, mas é um pedido do lado do Supabase e não
     * o `simulatorOrders.id` daqui. Abrir um pelo outro mostrava a quem atende
     * a morada e o valor de OUTRO cliente.
     */
    const bloco = get.slice(get.indexOf("support_tickets"));
    expect(semNotas(bloco)).not.toContain("request_id");
    expect(bloco).toContain("pedidoId: null");
  });

  it("a resposta ao ticket da app sai pela rota que já existia", () => {
    // Uma segunda cópia da gravação acabava por deixar de fazer o mesmo que a
    // primeira — e é essa que já sabe passar o ticket a «em curso».
    expect(PAINEL).toContain("/api/admin/suporte/${encodeURIComponent(idDoTicket)}/mensagens");
    expect(ROTA).toContain("/api/admin/suporte/[id]/mensagens");
    // Esta rota LÊ do Supabase e nunca lá escreve.
    expect(ROTA).not.toContain(".insert(");
  });
});

describe("o ecrã", () => {
  it("a parte pura não importa nada — pode ser lida no browser", () => {
    /*
     * O painel é "use client". Se este ficheiro importasse o `db`, arrastava o
     * mysql2 para o browser e o `next build` caía — como já caiu uma vez, com
     * a conta da sugestão. Zero imports fecha a porta de vez.
     */
    expect(PAINEL).toContain('"use client"');
    expect(PAINEL).toContain('from "@/lib/conversas-de-suporte"');
    expect(semNotas(PURO)).not.toContain("import ");
  });

  it("é um fio de conversa, e não uma tabela de estados", () => {
    // Foi o que ele pediu: "devidamente separadas como no wpp".
    expect(PAINEL).toContain("justify-end");
    expect(PAINEL).toContain("justify-start");
    expect(PAINEL).toContain("ROTULO_DA_ORIGEM");
  });

  it("diz sempre por onde a resposta vai sair — nos três canais", () => {
    /*
     * Escrever sem saber se a pessoa recebe é o que faz ninguém escrever. E na
     * app a frase tem de ser honesta: a resposta fica gravada, mas pode ainda
     * não haver ecrã onde ela apareça — dizer o contrário era criar outra
     * mensagem perdida, agora do nosso lado.
     */
    expect(PAINEL).toContain("Vai para o histórico do pedido");
    expect(PAINEL).toContain("Vai para a conta dela");
    expect(PAINEL).toContain("A app pode ainda não ter ecrã de respostas");
  });

  it("dá para procurar dentro do que foi dito, e não só nos nomes", () => {
    // Quem perdeu uma conversa lembra-se do que lá foi dito.
    expect(PAINEL).toContain("c.mensagens.some((m) => m.texto.toLowerCase().includes(q))");
  });

  it("abre o pedido tal como o cliente o vê, sem gerar link novo", () => {
    expect(PAINEL).toContain("/admin/pedido/${fio.pedidoId}");
  });

  it("está montado no Suporte, e em cima", () => {
    expect(ECRA).toContain("<AdminConversasPanel />");
    expect(ECRA.indexOf("<AdminConversasPanel />")).toBeLessThan(
      ECRA.indexOf("<AdminAjudaPanel />"),
    );
  });
});
