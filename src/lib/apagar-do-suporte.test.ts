import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chaveDaMensagem,
  marcaDaMensagem,
  semOsApagados,
  soOsApagados,
  type ConversaDeSuporte,
  type MensagemDaConversa,
} from "./conversas-de-suporte";

/**
 * APAGAR UMA CONVERSA, OU UMA MENSAGEM — sem destruir o que não é nosso.
 *
 * "Me dê a opção de poder apagar uma conversa ou mensagem." — 17-09-2026.
 *
 * A caixa do suporte não é dona de nada. É uma VISTA sobre três sítios que já
 * existiam antes dela: o `historyJson` de um pedido, a tabela da ajuda da
 * plataforma e os tickets da app. Um DELETE a sério aqui arrancava uma linha
 * do histórico de um pedido — que é o registo de operações desse pedido e a
 * prova do que foi dito ao cliente — e do lado dele a mensagem ficava na
 * mesma, porque a conversa é dele também.
 *
 * Por isso apagar é ESCONDER DESTE ECRÃ, com quem o fez e quando, e com volta
 * atrás. Resolve o que ele quer resolver — as conversas de teste a ocupar a
 * lista — sem apagar o que ninguém pediu para apagar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/*
 * O código sem comentários: os comentários desta mudança citam nomes de
 * funções para explicar de onde viemos, e um teste que os procure no ficheiro
 * inteiro encontra-os lá dentro e fica verde sem guardar nada.
 */
const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const m = (texto: string, quando: string, de: "eles" | "clyon" = "eles"): MensagemDaConversa => ({
  de,
  texto,
  quando,
});

const conversa = (chave: string, mensagens: MensagemDaConversa[]): ConversaDeSuporte => ({
  chave,
  origem: "pedido",
  quem: "Alguém",
  contacto: null,
  pedidoId: 133,
  assunto: null,
  mensagens,
});

describe("a marca de uma mensagem", () => {
  it("é feita do que a mensagem É, e não da posição dela", () => {
    /*
     * Guardar o índice era frágil: basta uma entrada nova mais acima e a
     * marca passa a apontar para outra frase. A frase errada apagada é pior
     * do que não haver botão nenhum.
     */
    const um = m("Bom dia", "2026-07-30T09:00:00Z");
    expect(marcaDaMensagem(um)).toBe(marcaDaMensagem({ ...um }));
  });

  it("muda com o texto e muda com a hora", () => {
    const base = m("Bom dia", "2026-07-30T09:00:00Z");
    expect(marcaDaMensagem(base)).not.toBe(marcaDaMensagem(m("Boa tarde", "2026-07-30T09:00:00Z")));
    expect(marcaDaMensagem(base)).not.toBe(marcaDaMensagem(m("Bom dia", "2026-07-31T09:00:00Z")));
  });

  it("a chave diz a que conversa pertence", () => {
    const um = m("Bom dia", "2026-07-30T09:00:00Z");
    expect(chaveDaMensagem("pedido:133", um)).toBe(`pedido:133#${marcaDaMensagem(um)}`);
    // A mesma frase em duas conversas são duas coisas diferentes: apagá-la
    // numa não a pode apagar na outra.
    expect(chaveDaMensagem("pedido:133", um)).not.toBe(chaveDaMensagem("pedido:134", um));
  });
});

describe("o que fica à vista depois de apagar", () => {
  const a = conversa("pedido:133", [m("Primeira", "2026-07-30T09:00:00Z")]);
  const b = conversa("plataforma:7", [
    m("Uma", "2026-07-30T10:00:00Z"),
    m("Outra", "2026-07-30T11:00:00Z"),
  ]);

  it("sem nada apagado, devolve o que recebeu", () => {
    expect(semOsApagados([a, b], [])).toEqual([a, b]);
  });

  it("uma conversa apagada sai da lista", () => {
    expect(semOsApagados([a, b], ["pedido:133"]).map((c) => c.chave)).toEqual(["plataforma:7"]);
  });

  it("uma mensagem apagada sai do fio, e o resto fica", () => {
    const fora = chaveDaMensagem(b.chave, b.mensagens[0]);
    const saida = semOsApagados([a, b], [fora]);
    expect(saida).toHaveLength(2);
    expect(saida[1].mensagens.map((x) => x.texto)).toEqual(["Outra"]);
  });

  it("uma conversa que fica sem mensagens nenhumas desaparece", () => {
    /*
     * Deixá-la era deixar um nome e uma data a apontar para um fio vazio — e
     * quem apagou as três mensagens de um teste não quer continuar a ver o
     * teste na lista.
     */
    const fora = a.mensagens.map((x) => chaveDaMensagem(a.chave, x));
    expect(semOsApagados([a, b], fora).map((c) => c.chave)).toEqual(["plataforma:7"]);
  });

  it("a papeleira mostra exactamente o contrário", () => {
    expect(soOsApagados([a, b], ["pedido:133"]).map((c) => c.chave)).toEqual(["pedido:133"]);
  });

  it("apagar não mexe no objecto original — a lista é uma cópia", () => {
    // O ecrã guarda as conversas em estado. Uma função que mutasse o que
    // recebe fazia o React não dar pela mudança, ou dá-la duas vezes.
    const fora = chaveDaMensagem(b.chave, b.mensagens[0]);
    semOsApagados([a, b], [fora]);
    expect(b.mensagens).toHaveLength(2);
  });
});

describe("a rota apaga da caixa, e não da base", () => {
  const ROTA = semComentarios(ler("src/app/api/admin/suporte/conversas/route.ts"));
  /*
   * SÓ O CORPO DO `DELETE`, e não daí até ao fim do ficheiro.
   *
   * A seguir a ele vêm o `POST` — que escreve mesmo no histórico do pedido,
   * e é suposto — e o `PATCH`. Sem este limite, a asserção de baixo lia o
   * ficheiro quase todo e chumbava por causa da função ao lado.
   */
  const DELETE = (() => {
    const i = ROTA.indexOf("export async function DELETE");
    const j = ROTA.indexOf("export async function", i + 10);
    return j === -1 ? ROTA.slice(i) : ROTA.slice(i, j);
  })();

  it("o DELETE só escreve na papeleira", () => {
    expect(DELETE).toContain("apagarDoSuporte(");
    expect(DELETE).toContain("reporNoSuporte(");
  });

  it("e NUNCA toca no histórico do pedido nem nas linhas de origem", () => {
    /*
     * É a linha que separa «tirar da caixa» de «destruir o registo». O
     * histórico de um pedido é a prova do que foi dito ao cliente; a ajuda da
     * plataforma e o ticket da app são dele, não nossos.
     */
    for (const proibido of [
      "appendOrderHistory",
      "deleteSimulatorOrder",
      "responderPedidoDeAjuda",
      "DELETE FROM",
      "support_tickets",
    ]) {
      expect(DELETE, `o DELETE não pode chamar ${proibido}`).not.toContain(proibido);
    }
  });

  it("recusa uma chave que não é nossa", () => {
    // Sem isto, a tabela enchia-se do que quer que alguém mandasse no corpo.
    expect(DELETE).toContain("lerChave(daConversa)");
    expect(DELETE).toContain("Conversa desconhecida.");
  });

  it("a lista e a contagem passam pelo filtro", () => {
    expect(ROTA).toContain("semOsApagados(conversas, apagados)");
    expect(ROTA).toContain("soOsApagados(conversas, apagados)");
    // O selo do menu contaria uma conversa que ele apagou, e a única saída
    // seria repô-la para o número se calar.
    expect(ROTA).toContain("semOsApagados(conversas, apagados).filter(porResponder).length");
  });
});

describe("o ecrã dá o botão, e diz o que ele faz", () => {
  const PAINEL = semComentarios(ler("src/components/admin/AdminConversasPanel.tsx"));

  it("apaga uma conversa e apaga uma mensagem", () => {
    expect(PAINEL).toContain("Apagar a conversa com ");
    expect(PAINEL).toContain("Apagar esta mensagem da caixa de entrada?");
  });

  it("pergunta antes, e diz que não muda o que a pessoa vê", () => {
    // Um caixote que apaga ao primeiro toque, numa lista de conversas de
    // clientes, é uma perda à espera de acontecer.
    expect(PAINEL).toContain("window.confirm(pergunta)");
    expect(PAINEL).toContain("o que a pessoa vê do lado dela não mudam");
  });

  it("há papeleira, e de lá repõe-se", () => {
    expect(PAINEL).toContain("papeleira=1");
    expect(PAINEL).toContain("Repor na caixa de entrada");
  });

  it("o caixote não vive dentro do botão da linha", () => {
    /*
     * Um botão dentro de um botão é HTML inválido: o browser desfaz o encaixe
     * e o clique passa a ir para o sítio errado — apagar quando se queria
     * abrir.
     */
    expect(PAINEL).toContain("group relative border-b border-slate-800/80");
  });

  it("e vê-se no telemóvel, onde não há «passar por cima»", () => {
    // `group-hover` nunca dispara num ecrã táctil. Um botão que só aparece ao
    // passar o rato é um botão que não existe em metade dos aparelhos.
    expect(PAINEL).toContain("md:opacity-0 md:group-hover:opacity-100");
  });
});
