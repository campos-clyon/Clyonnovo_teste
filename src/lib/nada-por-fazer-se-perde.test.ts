import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { combinaComABusca } from "./procurar-pedido";

/**
 * UM TRABALHO POR FAZER NÃO PODE DESAPARECER DA MESA.
 *
 * "Não encontro esse trabalho (…) os trabalhos que ainda não foram concluídos
 * mas foram criados e não finalizados devem estar em algum lugar."
 * — 18-09-2026.
 *
 * Era o #298: esvaziamento de apartamento, contratado com a TRSul por 350 €,
 * com a data já passada — «Atrasado · 1 dia» na Agenda — e em lado nenhum nas
 * Negociações. Procurar por «298» dava «Nenhum pedido com isso».
 *
 * A causa eram duas, e tinham de ser as duas:
 *
 *   1. A MESA CARREGAVA OS TRINTA MAIS RECENTES, por data. À trigésima
 *      primeira entrada, um trabalho contratado e por fazer saía do ecrã sem
 *      aviso — só porque entretanto tinham entrado pedidos novos.
 *   2. A BUSCA FILTRA O QUE ESTÁ CARREGADO. Procurava por número, morada,
 *      telefone, nome e profissional, e procurava bem — o que ela não podia
 *      era encontrar um pedido que nunca chegou ao browser.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DB = semComentarios(ler("src/lib/db.ts"));
const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/route.ts"));
const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

describe("o limite corta pela cauda do que já acabou", () => {
  it("o que está em jogo vem primeiro, e só depois a data", () => {
    /*
     * Se um dia o limite cortar alguma coisa, corta um cancelado ou um
     * concluído — que têm prateleira própria e não esperam por ninguém.
     */
    expect(DB).toContain(
      "ORDER BY (o.status IN ('cancelado','concluido','arquivado')) ASC, o.createdAt DESC",
    );
  });

  it("e é NESTA consulta, a da mesa — não noutra qualquer", () => {
    // `db.ts` tem dezenas de consultas a `simulatorOrders`. A promessa é desta.
    const consulta = DB.slice(DB.indexOf("export async function pedidosComNegociacoes"));
    const fim = consulta.indexOf("export async function", 10);
    const corpo = fim === -1 ? consulta : consulta.slice(0, fim);
    expect(corpo).toContain("ORDER BY (o.status IN");
    expect(corpo.indexOf("ORDER BY (o.status IN")).toBeLessThan(corpo.indexOf("LIMIT ?"));
  });
});

describe("quem procura procura em tudo", () => {
  it("a rota sabe trazer a mesa inteira", () => {
    expect(ROTA).toContain('searchParams.get("tudo") === "1"');
    expect(ROTA).toContain("pedidosComNegociacoes(tudo ? 500 : 60)");
  });

  it("e o painel pede-a assim que alguém escreve na caixa", () => {
    expect(MESA).toContain("if (aProcurar && !temTudo && token) void carregar(true, true);");
  });

  it("uma vez por sessão, e não a cada tecla", () => {
    // Quem procura escreve, apaga e escreve outra vez. Cada uma dessas teclas
    // seria uma viagem à base por quinhentos pedidos.
    expect(MESA).toContain("if (tudo) setTemTudo(true);");
  });

  it("e a batida de 30s não encolhe a lista por baixo de quem procura", () => {
    /*
     * Sem isto, meio minuto depois de escrever, a mesa voltava aos mais
     * recentes e o pedido encontrado desaparecia do ecrã — sem nada a
     * explicar porquê, que é a pior maneira de perder uma coisa.
     */
    /*
     * O que isto guarda é o `temTudo` passado à batida. As opções ao lado são
     * outra promessa — desde 19-09-2026 a batida também pára enquanto alguém
     * escreve uma nota — e prender o teste ao parêntese fechado fazia-o
     * chumbar por causa de um argumento que não é o desta.
     */
    expect(MESA).toContain("useAutoRefresh(() => carregar(true, temTudo)");
  });

  it("o ecrã diz que está a mostrar os recentes, em vez de o deixar adivinhar", () => {
    // Dizia «30 pedidos na plataforma», que se lê como «são só estes».
    expect(MESA).toContain("os mais recentes. Escreva na busca para procurar em todos");
  });
});

describe("a busca procura por tudo aquilo que ele nomeou", () => {
  /*
   * "A pesquisa deve procurar por número de telefone, endereço, número do
   * pedido, nome do cliente e localidade, até mesmo através do profissional."
   *
   * Já procurava — e continua a ser a MESMA função, `combinaComABusca`, que
   * decide. Escrevê-la outra vez em SQL dava duas regras para a mesma
   * pergunta, e a segunda a divergir seria sempre a que ninguém vê.
   */
  const pedido = {
    id: 298,
    contactName: "Patricia Goncalves",
    contactPhone: "+351938564627",
    address: "R. Gen. Humberto Delgado 8A, Almada",
    city: "Cova da Piedade",
    postalCode: "2805-155",
    serviceType: "esvaziamento_apartamento",
    profissionais: ["TRSul"],
  };

  const casos: Array<[string, string]> = [
    ["o número do pedido", "298"],
    ["o número com cardinal", "#298"],
    ["o telefone, como se copia de uma chamada", "+351 938 564 627"],
    ["só os últimos dígitos do telefone", "564627"],
    ["a morada", "humberto delgado"],
    ["o nome do cliente", "goncalves"],
    ["o nome do cliente sem acentos certos", "Patrícia"],
    ["a localidade", "cova da piedade"],
    ["o código postal", "2805-155"],
    ["o profissional", "trsul"],
    ["o serviço por palavras", "esvaziamento"],
  ];

  for (const [nome, termo] of casos) {
    it(`encontra-o por ${nome}`, () => {
      expect(combinaComABusca(pedido, termo)).toBe(true);
    });
  }

  it("e não traz o que não é dele", () => {
    expect(combinaComABusca(pedido, "sthefanny")).toBe(false);
    expect(combinaComABusca(pedido, "lisboa")).toBe(false);
  });

  it("o NÚMERO do pedido casa por igualdade, e não por pedaço", () => {
    /*
     * «29» não pode trazer o #298 como se fosse o dele. Com o cardinal, a
     * regra é dura: `#29` é o pedido 29 e mais nada.
     *
     * Sem o cardinal, «29» ainda pode encontrá-lo — por ser um pedaço da
     * morada ou do texto — e isso é de propósito: «25» em «Rua 25 de Abril» é
     * morada e não é número de pedido nenhum.
     */
    expect(combinaComABusca(pedido, "#29")).toBe(false);
    expect(combinaComABusca(pedido, "#298")).toBe(true);
  });
});
