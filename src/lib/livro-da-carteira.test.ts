import { describe, it, expect } from "vitest";
import { carteiraDe, type Levantamento, type TrabalhoNaCarteira } from "./carteira";
import {
  carteiraDoLivro,
  livroDe,
  movimentoDoTrabalho,
  movimentosDoLevantamento,
  quandoLiberta,
} from "./livro-da-carteira";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { TAXA_PROFISSIONAL } from "./taxas-plataforma";

/**
 * O LIVRO TEM DE DAR O MESMO NÚMERO QUE A CARTEIRA DE HOJE.
 *
 * Fase 1 do plano dos pagamentos. A carteira passa a ser a soma de linhas em
 * vez de uma conta refeita a partir das negociações — e a única coisa que esta
 * fase promete é que **nenhum profissional vê o seu saldo mexer**.
 *
 * É por isso que a maior parte deste ficheiro não testa o livro sozinho: testa
 * os DOIS caminhos lado a lado, sobre os mesmos dados, e exige o mesmo
 * resultado ao cêntimo. Um livro que esteja certo mas dê outro número é um
 * livro errado — porque o número que está nos ecrãs é o outro.
 */

const AGORA = new Date("2026-09-16T12:00:00Z");
const h = (horas: number) => new Date(AGORA.getTime() + horas * 3_600_000);
const dias = (d: number) => h(d * 24);

let proximoId = 1;
function trabalho(p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: proximoId++,
    estado: "acordada",
    valorAcordado: 100,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ...p,
  } as TrabalhoNaCarteira;
}

function levantamento(p: Partial<Levantamento> = {}): Levantamento {
  return { id: proximoId++, valor: 50, estado: "pedido", ...p };
}

/** Os dois caminhos, sobre os mesmos dados. */
function osDois(trabalhos: TrabalhoNaCarteira[], levantamentos: Levantamento[]) {
  return {
    hoje: carteiraDe(trabalhos, levantamentos, AGORA),
    livro: carteiraDoLivro(livroDe(7, trabalhos, levantamentos), AGORA),
  };
}

describe("o livro dá o mesmo que a carteira de hoje", () => {
  const casos: Array<[string, TrabalhoNaCarteira[], Levantamento[]]> = [
    ["carteira vazia", [], []],
    ["uma negociação ainda a negociar não conta", [trabalho({ estado: "aberta" })], []],
    ["um trabalho por executar fica cativo", [trabalho()], []],
    [
      "um trabalho à espera de confirmação, dentro do prazo",
      [trabalho({ execucaoEnviadaEm: dias(-2) })],
      [],
    ],
    [
      "um trabalho cujo prazo já passou liberta-se sozinho",
      [trabalho({ execucaoEnviadaEm: dias(-(DIAS_ATE_LIBERTAR_SOZINHO + 1)) })],
      [],
    ],
    [
      "exactamente no limite do prazo",
      [trabalho({ execucaoEnviadaEm: dias(-DIAS_ATE_LIBERTAR_SOZINHO) })],
      [],
    ],
    [
      "um segundo antes do limite",
      [trabalho({ execucaoEnviadaEm: h(-DIAS_ATE_LIBERTAR_SOZINHO * 24 + 0.001) })],
      [],
    ],
    [
      "confirmado pelo cliente",
      [trabalho({ execucaoEnviadaEm: dias(-3), confirmadoEm: dias(-1) })],
      [],
    ],
    [
      "já pago ao profissional",
      [trabalho({ execucaoEnviadaEm: dias(-9), confirmadoEm: dias(-8), pagoEm: dias(-7) })],
      [],
    ],
    ["um levantamento pedido", [trabalho({ confirmadoEm: dias(-1) })], [levantamento()]],
    [
      "um levantamento pago",
      [trabalho({ confirmadoEm: dias(-1) })],
      [levantamento({ estado: "pago" })],
    ],
    [
      "um levantamento recusado não desconta nada",
      [trabalho({ confirmadoEm: dias(-1) })],
      [levantamento({ estado: "recusado" })],
    ],
    [
      "vários levantamentos em estados diferentes",
      [trabalho({ valorAcordado: 500, confirmadoEm: dias(-5) })],
      [
        levantamento({ valor: 100, estado: "pago" }),
        levantamento({ valor: 50, estado: "pedido" }),
        levantamento({ valor: 30, estado: "recusado" }),
      ],
    ],
    [
      "uma carteira com tudo ao mesmo tempo",
      [
        trabalho({ valorAcordado: 120 }),
        trabalho({ valorAcordado: 200, execucaoEnviadaEm: dias(-1) }),
        trabalho({ valorAcordado: 80, execucaoEnviadaEm: dias(-10) }),
        trabalho({ valorAcordado: 350, execucaoEnviadaEm: dias(-4), confirmadoEm: dias(-2) }),
        trabalho({ valorAcordado: 90, confirmadoEm: dias(-20), pagoEm: dias(-19) }),
        trabalho({ estado: "morta", valorAcordado: 999 }),
      ],
      [levantamento({ valor: 200, estado: "pago" }), levantamento({ valor: 60 })],
    ],
    [
      "valores com cêntimos, onde o arredondamento se nota",
      [
        trabalho({ valorAcordado: 33.33, confirmadoEm: dias(-1) }),
        trabalho({ valorAcordado: 66.67, confirmadoEm: dias(-1) }),
        trabalho({ valorAcordado: 0.01, confirmadoEm: dias(-1) }),
      ],
      [],
    ],
    [
      "um trabalho sem valor acordado não conta",
      [trabalho({ valorAcordado: null, confirmadoEm: dias(-1) })],
      [],
    ],
    [
      "uma taxa diferente da de origem, presa à negociação",
      [
        {
          ...trabalho({ valorAcordado: 100, confirmadoEm: dias(-1) }),
          taxaProfissional: "0.1500",
        } as TrabalhoNaCarteira,
      ],
      [],
    ],
    [
      "levantamentos a mais do que o disponível — o saldo não fica negativo",
      [trabalho({ valorAcordado: 100, confirmadoEm: dias(-1) })],
      [levantamento({ valor: 500, estado: "pago" })],
    ],
  ];

  it.each(casos)("%s", (_nome, trabalhos, levantamentos) => {
    const { hoje, livro } = osDois(trabalhos, levantamentos);
    expect(livro).toEqual(hoje);
  });
});

describe("e dá o mesmo em carteiras que eu não me lembrei de escrever", () => {
  /*
   * OS CASOS ACIMA PROVAM OS CASOS EM QUE EU PENSEI.
   *
   * Com dinheiro isso não chega: o engano que interessa é o que ninguém
   * imaginou. Isto gera quinhentas carteiras de formas aleatórias — valores com
   * cêntimos, datas de um lado e do outro do prazo, taxas diferentes, montes de
   * levantamentos — e exige que os dois caminhos concordem em todas.
   *
   * O acaso é SEMEADO e não `Math.random`: um teste que falha uma vez em cada
   * cem execuções e passa na seguinte não é um teste, é um boato. Com semente,
   * a carteira que falhar falha sempre, e pode ser lida.
   */
  function semente(n: number) {
    let s = n >>> 0;
    return () => {
      // xorshift32 — pequeno, determinista, e chega bem para gerar formas.
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100_000) / 100_000;
    };
  }

  it("quinhentas carteiras geradas, todas iguais nos dois caminhos", () => {
    const r = semente(20260916);
    const escolher = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    let comparadas = 0;
    /*
     * Quantas tinham mesmo dinheiro lá dentro.
     *
     * Sem esta contagem, um gerador que produzisse quinhentas carteiras vazias
     * passava o teste a comparar zeros com zeros — e eu ficava com a
     * impressão de ter provado alguma coisa.
     */
    let comSaldo = 0;
    let comCativo = 0;
    let comLevantamentos = 0;

    for (let i = 0; i < 500; i += 1) {
      const trabalhos: TrabalhoNaCarteira[] = [];
      for (let j = 0; j < Math.floor(r() * 6); j += 1) {
        const enviada = escolher([null, dias(-1), dias(-7), dias(-8), dias(-30)]);
        const confirmada = enviada && r() > 0.5 ? dias(-Math.floor(r() * 5)) : null;
        trabalhos.push(
          trabalho({
            estado: escolher(["acordada", "acordada", "acordada", "aberta", "morta"]),
            valorAcordado: escolher([null, 0.01, 33.33, 99.99, 150, 1234.56]),
            execucaoEnviadaEm: enviada,
            confirmadoEm: confirmada,
            pagoEm: confirmada && r() > 0.7 ? dias(-1) : null,
            taxaProfissional: escolher([null, "0.0600", "0.1500", "0.0000"]),
          } as Partial<TrabalhoNaCarteira>),
        );
      }

      const levantamentos: Levantamento[] = [];
      for (let j = 0; j < Math.floor(r() * 4); j += 1) {
        levantamentos.push(
          levantamento({
            valor: escolher([10, 47.5, 100, 999.99]),
            estado: escolher(["pedido", "pago", "recusado"]),
          }),
        );
      }

      const { hoje, livro } = osDois(trabalhos, levantamentos);
      expect(livro, `carteira gerada #${i}`).toEqual(hoje);
      comparadas += 1;
      if (hoje.totalGanho > 0) comSaldo += 1;
      if (hoje.cativo > 0) comCativo += 1;
      if (hoje.aCaminho > 0 || hoje.levantado > 0) comLevantamentos += 1;
    }

    // Sem isto, um gerador partido produzia zero carteiras e o teste passava
    // a dizer que estava tudo bem.
    expect(comparadas).toBe(500);
    // E estas três exigem que as carteiras tenham tido dinheiro, dinheiro
    // preso, e dinheiro a sair. Comparar zeros com zeros não é comparar nada.
    expect(comSaldo).toBeGreaterThan(100);
    expect(comCativo).toBeGreaterThan(50);
    expect(comLevantamentos).toBeGreaterThan(50);
  });
});

describe("os números, e não só a igualdade", () => {
  /*
   * Os testes acima provam que os dois concordam. Estes provam que concordam
   * no VALOR CERTO — dois caminhos podem estar igualmente errados.
   */
  it("um trabalho de 100 € rende 94 € ao profissional", () => {
    expect(TAXA_PROFISSIONAL).toBe(0.06);
    const c = carteiraDoLivro(livroDe(7, [trabalho({ confirmadoEm: dias(-1) })], []), AGORA);
    expect(c.totalGanho).toBe(94);
    expect(c.disponivel).toBe(94);
    expect(c.cativo).toBe(0);
  });

  it("e fica cativo enquanto o trabalho não estiver provado", () => {
    const c = carteiraDoLivro(livroDe(7, [trabalho()], []), AGORA);
    expect(c.cativo).toBe(94);
    expect(c.disponivel).toBe(0);
    expect(c.totalGanho).toBe(94);
  });

  it("pedir uma transferência tira do disponível e põe a caminho", () => {
    const c = carteiraDoLivro(
      livroDe(7, [trabalho({ confirmadoEm: dias(-1) })], [levantamento({ valor: 40 })]),
      AGORA,
    );
    expect(c.disponivel).toBe(54);
    expect(c.aCaminho).toBe(40);
    expect(c.levantado).toBe(0);
  });
});

describe("quando é que o dinheiro se liberta", () => {
  it("por confirmação, na hora em que o cliente confirmou", () => {
    const t = trabalho({ execucaoEnviadaEm: dias(-3), confirmadoEm: dias(-1) });
    expect(quandoLiberta(t)?.getTime()).toBe(dias(-1).getTime());
  });

  it("por prazo, sete dias depois da prova", () => {
    const t = trabalho({ execucaoEnviadaEm: dias(-2) });
    expect(quandoLiberta(t)?.getTime()).toBe(dias(-2 + DIAS_ATE_LIBERTAR_SOZINHO).getTime());
  });

  it("um trabalho por executar não tem data nenhuma", () => {
    // Antes da prova não há nada a libertar: o trabalho ainda nem foi feito.
    expect(quandoLiberta(trabalho())).toBeNull();
  });

  it("um pago sem data de confirmação cai na data do pagamento", () => {
    // Linhas antigas podem ter sido pagas sem a confirmação ter ficado
    // gravada. Uma data é melhor do que nenhuma.
    const t = trabalho({ execucaoEnviadaEm: dias(-9), pagoEm: dias(-7) });
    expect(quandoLiberta(t)?.getTime()).toBe(dias(-7).getTime());
  });
});

describe("cada facto é lançado uma vez, e só uma", () => {
  it("o movimento de um trabalho leva a chave da negociação", () => {
    const m = movimentoDoTrabalho({ ...trabalho({ negociacaoId: 312 }), providerId: 7 });
    expect(m?.chave).toBe("trabalho:312");
  });

  it("um levantamento pedido e pago são duas chaves diferentes", () => {
    // Dois factos, duas linhas: sai da carteira quando ele pede, chega-lhe à
    // conta quando se transfere. Entre um e outro há dias.
    const ms = movimentosDoLevantamento({ ...levantamento({ id: 45, estado: "pago" }), providerId: 7 });
    expect(ms.map((m) => m.chave)).toEqual(["levantamento:45:pedido", "levantamento:45:pago"]);
  });

  it("a linha do pago não volta a tirar dinheiro", () => {
    // O dinheiro saiu na primeira. Se a segunda também tirasse, um levantamento
    // pago descontava a dobrar.
    const ms = movimentosDoLevantamento({ ...levantamento({ id: 45, valor: 80, estado: "pago" }), providerId: 7 });
    expect(ms.map((m) => m.valor)).toEqual([-80, 0]);
  });

  it("um recusado não deixa rasto nenhum", () => {
    expect(movimentosDoLevantamento({ ...levantamento({ estado: "recusado" }), providerId: 7 })).toEqual([]);
  });

  it("as chaves de um livro inteiro nunca se repetem", () => {
    /*
     * É esta a propriedade que a coluna única da base vai impor. Se duas linhas
     * diferentes puderem gerar a mesma chave, a segunda é recusada e o dinheiro
     * dela desaparece — em silêncio.
     */
    const livro = livroDe(
      7,
      [trabalho(), trabalho(), trabalho({ confirmadoEm: dias(-1) })],
      [levantamento({ estado: "pago" }), levantamento(), levantamento({ estado: "pago" })],
    );
    const chaves = livro.map((m) => m.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("o que o livro passa a poder fazer e a carteira de hoje não podia", () => {
  it("um acerto à mão entra como movimento, sem mexer em linha nenhuma", () => {
    /*
     * "Se um número estiver errado, a correcção é um movimento novo — nunca uma
     * linha reescrita." É a regra do plano, e é o que permite explicar um saldo
     * daqui a um ano.
     */
    const base = livroDe(7, [trabalho({ confirmadoEm: dias(-1) })], []);
    const comAcerto = [
      ...base,
      {
        providerId: 7,
        tipo: "acerto" as const,
        valor: 6,
        disponivelEm: dias(-1),
        chave: "acerto:1",
        nota: "arredondamento combinado ao telefone",
      },
    ];
    expect(carteiraDoLivro(comAcerto, AGORA).disponivel).toBe(100);
  });

  it("um reembolso parcial tira o que foi devolvido", () => {
    // Metade de um trabalho devolvida ao cliente não é um estado de uma
    // negociação — é um movimento, e não havia tabela para ele.
    const base = livroDe(7, [trabalho({ valorAcordado: 200, confirmadoEm: dias(-1) })], []);
    expect(carteiraDoLivro(base, AGORA).disponivel).toBe(188);
    const comReembolso = [
      ...base,
      {
        providerId: 7,
        tipo: "reembolso" as const,
        valor: -94,
        disponivelEm: dias(-1),
        chave: "reembolso:eupago:abc123",
        referencia: "abc123",
      },
    ];
    expect(carteiraDoLivro(comReembolso, AGORA).disponivel).toBe(94);
  });
});
