import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  JANELA_SEM_MARCA_MS,
  SECCOES_COM_AVISO,
  desdeQuando,
  eSeccaoComAviso,
  nenhumaNovidade,
} from "./novidades-do-backoffice";

/**
 * O SELO VERMELHO EM TODAS AS SECÇÕES — e o «3 novos» que nunca chegava a zero.
 *
 * "Diz que tem 3 pedidos novos mas se já foi visto tem que ficar em 0. Coloque
 * todas as categorias — Pedidos, Profissionais, Agenda, WhatsApp, Carteiras —
 * para terem notificações como no supp, mas devem sumir ao abrir ou
 * visualizar." — 17-09-2026.
 *
 * Duas coisas no mesmo pedido:
 *
 * 1. O CARTÃO «NOVOS» contava os pedidos que ninguém abriu — a tabela INTEIRA,
 *    com arquivados e concluídos lá dentro. A lista, com o mesmo filtro,
 *    manda um arquivado para a prateleira dos arquivados. Três pedidos fora
 *    da fila ficavam a contar para sempre, e não havia clique que lá chegasse.
 *
 * 2. AS OUTRAS SECÇÕES não tinham aviso nenhum. Para saber se entrou um pedido
 *    era preciso abrir Pedidos e comparar de cabeça com o que lá estava da
 *    última vez — trabalho que o ecrã devia fazer.
 */

/*
 * Com as linhas todas em `\n`. Os ficheiros do repositório estão em CRLF, e
 * uma asserção de duas linhas nunca casaria com o `\r\n` que vem do disco —
 * chumbava por causa do fim de linha e não do que está lá escrito.
 */
const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/*
 * O código sem comentários: os comentários desta mudança citam colunas e nomes
 * de funções para explicar de onde viemos, e um teste que os procure no
 * ficheiro inteiro encontra-os lá dentro e fica verde sem guardar nada.
 */
const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("que secções avisam", () => {
  it("as cinco que ele nomeou, e os levantamentos ao lado delas", () => {
    expect([...SECCOES_COM_AVISO]).toEqual([
      "pedidos",
      "profissionais",
      "agenda",
      "whatsapp",
      "carteiras",
      "levantamentos",
    ]);
  });

  it("o suporte NÃO entra — já tem o dele, e é outra pergunta", () => {
    /*
     * O do suporte conta quem espera por resposta: é uma fila de trabalho e só
     * se esvazia respondendo. Este conta o que chegou desde que ele olhou, e
     * apaga-se por se olhar. Dois selos no mesmo item seriam dois números a
     * discordar sobre a mesma secção.
     */
    expect(eSeccaoComAviso("suporte")).toBe(false);
    expect(eSeccaoComAviso("pedidos")).toBe(true);
  });

  it("e nada que venha de fora passa por secção", () => {
    for (const lixo of ["", "configs", "DROP TABLE", null, 7, undefined]) {
      expect(eSeccaoComAviso(lixo)).toBe(false);
    }
  });
});

describe("a partir de quando é que uma coisa é nova", () => {
  const agora = Date.parse("2026-09-17T18:00:00Z");

  it("com marca, conta a partir dela", () => {
    /*
     * NO FUSO DA MÁQUINA, e não em UTC — é isso que faz a volta fechar.
     *
     * A marca sai da base como `'2026-09-17 09:30:00'`, sem fuso, e volta
     * para lá como parâmetro de uma consulta. O driver escreve e lê pela
     * mesma regra, e o que importa é que a ida e a volta usem a mesma: um `Z`
     * a mais aqui punha o selo a contar a partir de uma hora que não existe
     * em lado nenhum — e num país com hora de Verão isso é uma hora de
     * novidades a aparecer ou a desaparecer duas vezes por ano.
     */
    expect(desdeQuando("2026-09-17 09:30:00", agora).getTime()).toBe(
      new Date("2026-09-17T09:30:00").getTime(),
    );
  });

  it("e a marca ganha à janela — é essa a diferença que interessa", () => {
    expect(desdeQuando("2026-09-17 09:30:00", agora).getTime()).not.toBe(
      desdeQuando(null, agora).getTime(),
    );
  });

  it("sem marca, conta as últimas 24 horas", () => {
    /*
     * As duas saídas extremas são más: contar desde sempre põe «107» ao lado
     * de Pedidos no primeiro dia — um número que não é notícia nenhuma e que
     * ensina a ignorar o selo; contar zero esconde o que entrou esta manhã a
     * quem entra pela primeira vez.
     */
    expect(desdeQuando(null, agora).getTime()).toBe(agora - JANELA_SEM_MARCA_MS);
    expect(desdeQuando(undefined, agora).getTime()).toBe(agora - JANELA_SEM_MARCA_MS);
    expect(desdeQuando("", agora).getTime()).toBe(agora - JANELA_SEM_MARCA_MS);
  });

  it("uma data ilegível conta como não haver marca — mostra a mais", () => {
    // Esconder novidades não se vê; mostrar a mais vê-se e corrige-se.
    expect(desdeQuando("nem uma data", agora).getTime()).toBe(agora - JANELA_SEM_MARCA_MS);
  });

  it("zeros em todas é o ponto de partida, e o que se devolve quando falha", () => {
    expect(nenhumaNovidade()).toEqual({
      pedidos: 0,
      profissionais: 0,
      agenda: 0,
      whatsapp: 0,
      carteiras: 0,
      levantamentos: 0,
    });
  });
});

describe("«Novos» passa a querer dizer a mesma coisa nos dois sítios", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));
  const MENU = semComentarios(ler("src/components/admin/LegacyAdminClient.tsx"));

  it("o cartão não conta o que já saiu da fila", () => {
    expect(DB).toContain(
      "SUM(CASE WHEN viewedAt IS NULL\n                  AND (status IS NULL OR status NOT IN ('arquivado','concluido','cancelado'))",
    );
  });

  it("e a lista continua a mandá-los para as prateleiras deles", () => {
    // É a outra metade da mesma definição. Se um dia isto mudar sem o de cima
    // mudar, o cartão volta a contar pedidos onde é impossível chegar.
    expect(MENU).toContain('if (p.status === "arquivado") return filtro === "arquivado";');
    expect(MENU).toContain('if (p.status === "concluido") return filtro === "concluido";');
    expect(MENU).toContain('if (filtro === "pendente") return !p.viewedAt;');
  });
});

describe("a contagem conta o que ali é novidade", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));
  /* Só o corpo desta função: daqui até à seguinte, e não até ao fim do ficheiro. */
  const CONTAR = (() => {
    const i = DB.indexOf("export async function contarNovidades");
    const j = DB.indexOf("export async function", i + 10);
    return j === -1 ? DB.slice(i) : DB.slice(i, j);
  })();

  it("no WhatsApp, só o que ELES escreveram", () => {
    // Contar as nossas punha o selo a acender por causa do que nós próprios
    // acabámos de mandar.
    expect(CONTAR).toContain("direccao = 'in'");
  });

  it("nos pedidos, só os que ainda estão em jogo", () => {
    expect(CONTAR).toContain("status NOT IN ('arquivado','concluido','cancelado')");
  });

  it("nos levantamentos, só os que estão por processar", () => {
    expect(CONTAR).toContain("estado = 'pedido'");
  });

  it("uma tabela em baixo apaga o número dela e não os dos outros", () => {
    /*
     * Seis consultas a seis sítios. Se a do WhatsApp rebentar, o selo dos
     * pedidos tem de continuar certo — um menu que não desenha é um backoffice
     * que não abre.
     */
    expect(CONTAR).toContain("catch (e)");
    expect(CONTAR).toContain("const um = async (");
  });
});

describe("o menu acende e apaga", () => {
  const MENU = semComentarios(ler("src/components/admin/LegacyAdminClient.tsx"));
  const ROTA = semComentarios(ler("src/app/api/admin/novidades/route.ts"));

  it("uma chamada só para o menu inteiro", () => {
    // Seis pedidos de dois em dois minutos, um por secção, paga-se na factura
    // e no tempo de resposta de toda a gente.
    expect(MENU).toContain("/api/admin/novidades?_=");
    expect((MENU.match(/\/api\/admin\/novidades/g) ?? []).length).toBe(2);
  });

  it("abrir a secção apaga o selo, e apaga-o já", () => {
    /*
     * Antes da rede responder. Meio segundo de espera pelo servidor lê-se como
     * «não funcionou», e ao segundo dia ninguém acredita no número.
     */
    expect(MENU).toContain("setNovidades((n) => (n[seccao] ? { ...n, [seccao]: 0 } : n))");
    expect(MENU).toContain('method: "PATCH"');
  });

  it("e apaga-se venha ele do menu ou de um link antigo", () => {
    // Há mais de um caminho para abrir uma secção, e um selo que só se apaga
    // por um deles fica aceso sem razão.
    expect(MENU).toContain("if (token) marcarSeccaoVista(activeSection);");
  });

  it("o selo actualiza-se com a secção FECHADA — é essa a razão de existir", () => {
    expect(MENU).toContain("if (token) void carregarNovidades(token);");
  });

  it("a rota só aceita as secções que têm selo", () => {
    expect(ROTA).toContain("eSeccaoComAviso(corpo.seccao)");
    expect(ROTA).toContain("Secção desconhecida.");
  });

  it("e uma falha devolve zeros em vez de partir o menu", () => {
    expect(ROTA).toContain("nenhumaNovidade()");
  });
});
