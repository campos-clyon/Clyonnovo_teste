import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agendaDe,
  bomPorKmDe,
  horaNaAgenda,
  linkDoCalendario,
  ordenarTrabalhos,
  valorNoCartao,
  type Separador,
  type Trabalho,
} from "../../app-pro/src/lib/trabalhos";
import {
  diaCurto,
  lerValorDaTransferencia,
  mediaCurta,
  movimentosPorMes,
  podeTransferir,
  type Movimento,
} from "../../app-pro/src/lib/conta";
import * as PAINEL from "@/app/profissionais/painel/sinais-do-cartao";

/**
 * A APP DO PROFISSIONAL, FASE 4 — a agenda, a carteira e a conta (18-10-2026).
 *
 * As regras puras da app correm aqui, na bateria do site, como as da fase 2.
 */

const T = (o: Partial<Trabalho>): Trabalho =>
  ({
    negociacaoId: 1,
    pedidoId: 10,
    estado: "acordada",
    fase: "a_executar",
    propostas: "[]",
    valorAcordado: 100,
    querPagar: null,
    recebeSeAceitar: null,
    recebeSeFechado: 94,
    valorDaClyon: null,
    sugestao: null,
    taxas: { cliente: 0.05, profissional: 0.06 },
    ofertaClyon: null,
    arquivadoEm: null,
    confirmadoEm: null,
    pagoEm: null,
    abertoEm: null,
    dataCombinada: null,
    dataAgendada: null,
    duracaoMinutos: null,
    distanciaKm: null,
    filesJson: null,
    serviceType: "recolha_entulho",
    ...o,
  }) as Trabalho;

// Domingo, 18-10-2026, 10:00 em Lisboa.
const AGORA = new Date("2026-10-18T09:00:00.000Z");

describe("a agenda, pelo dia em Lisboa", () => {
  const lista = [
    T({ negociacaoId: 1, dataCombinada: "2026-10-19T08:30:00.000Z" }), // amanhã, 09:30
    T({ negociacaoId: 2, dataCombinada: "2026-10-18T14:00:00.000Z" }), // hoje, 15:00
    T({ negociacaoId: 3, dataCombinada: "2026-10-18T07:00:00.000Z" }), // hoje, 08:00
    T({ negociacaoId: 4 }), // sem data
    T({ negociacaoId: 5, dataCombinada: "2026-10-16T09:00:00.000Z" }), // passou o dia
    T({ negociacaoId: 6, fase: "a_confirmar", dataCombinada: "2026-10-18T10:00:00.000Z" }), // já feito
    T({ negociacaoId: 7, arquivadoEm: "2026-10-17T10:00:00.000Z", dataCombinada: "2026-10-18T10:00:00.000Z" }), // arquivado
    T({ negociacaoId: 8, estado: "aberta", dataAgendada: "2026-10-18" }), // ainda não é dele
    // 23:30 UTC de 18/10 já é segunda, 19/10, em Lisboa.
    T({ negociacaoId: 9, dataCombinada: "2026-10-18T23:30:00.000Z" }),
  ];
  const a = agendaDe(lista, AGORA);

  it("só os trabalhos dele por fazer, e os sem dia à parte", () => {
    expect(a.semData.map((t) => t.negociacaoId)).toEqual([4]);
    const todos = a.dias.flatMap((d) => d.trabalhos.map((t) => t.negociacaoId));
    expect(todos).not.toContain(6);
    expect(todos).not.toContain(7);
    expect(todos).not.toContain(8);
    expect(a.marcados).toBe(5);
  });

  it("os dias por ordem, os que passaram primeiro, e dentro do dia pela hora", () => {
    expect(a.dias.map((d) => [d.dia, d.rotulo, d.passou])).toEqual([
      ["2026-10-16", "Sexta-feira, 16 de outubro", true],
      ["2026-10-18", "Hoje", false],
      ["2026-10-19", "Amanhã", false],
    ]);
    expect(a.dias[1].trabalhos.map((t) => t.negociacaoId)).toEqual([3, 2]);
    // O 9 é às 00:30 de dia 19 em Lisboa: vem antes do das 09:30.
    expect(a.dias[2].trabalhos.map((t) => t.negociacaoId)).toEqual([9, 1]);
  });

  it("a hora é a de Lisboa, e uma data sem hora não inventa a meia-noite", () => {
    expect(horaNaAgenda(T({ dataCombinada: "2026-10-19T08:30:00.000Z" }))).toBe("09:30");
    expect(horaNaAgenda(T({ dataAgendada: "2026-10-19T00:00:00.000Z" }))).toBeNull();
    expect(horaNaAgenda(T({ dataAgendada: "2026-10-19" }))).toBeNull();
  });

  it("o calendário do telemóvel leva a hora certa e a duração do trabalho", () => {
    const l = linkDoCalendario(T({ dataCombinada: "2026-10-19T08:30:00.000Z", duracaoMinutos: 180 }));
    expect(l).toContain("calendar.google.com");
    expect(l).toContain("dates=20261019T083000Z%2F20261019T113000Z");
    expect(l).toContain("ctz=Europe%2FLisbon");
    // Sem hora combinada não há evento que se marque.
    expect(linkDoCalendario(T({ dataAgendada: "2026-10-19" }))).toBeNull();
  });
});

describe("a ordem da lista, como no painel", () => {
  const aberto = (o: Partial<Trabalho>) => T({ estado: "aberta", fase: "a_negociar", recebeSeFechado: null, ...o });
  const lista = [
    aberto({ negociacaoId: 1, criadaEm: "2026-10-18T08:00:00.000Z", distanciaKm: 30, recebeSeAceitar: 120 }),
    aberto({ negociacaoId: 2, criadaEm: "2026-10-18T09:00:00.000Z", distanciaKm: null, recebeSeAceitar: 300 }),
    aberto({ negociacaoId: 3, criadaEm: "2026-10-18T07:00:00.000Z", distanciaKm: 5, recebeSeAceitar: 50 }),
  ];
  const ids = (l: Trabalho[]) => l.map((t) => t.negociacaoId);

  it("«Recentes» é a ordem de chegada: o último em cima", () => {
    expect(ids(ordenarTrabalhos(lista, "recentes", "negociacao"))).toEqual([2, 1, 3]);
  });

  it("«Mais perto»: sem distância vai para o fim", () => {
    expect(ids(ordenarTrabalhos(lista, "perto", "negociacao"))).toEqual([3, 1, 2]);
  });

  it("«€/km»: o que paga mais por quilómetro em cima", () => {
    // 120/30 = 4 €/km, 50/5 = 10 €/km; sem distância não há €/km.
    expect(ids(ordenarTrabalhos(lista, "porKm", "negociacao"))).toEqual([3, 1, 2]);
  });
});

describe("os sinais do cartão são os do painel", () => {
  /*
   * `valorNoCartao` e `bomPorKmDe` vivem no painel (`sinais-do-cartao.ts`),
   * fora do src/lib, e a app tem a sua cópia. Esta lista de casos cobre os
   * ramos das duas funções; se uma mudar sem a outra, isto chumba.
   */
  const casos: Array<[string, Partial<Trabalho>]> = [
    ["sem sugestão", { valorDaClyon: null, sugestao: null, distanciaKm: 10 }],
    ["valor da CLYON", { valorDaClyon: 90, sugestao: null, distanciaKm: 10 }],
    [
      "sugestão com os custos dele",
      { valorDaClyon: null, distanciaKm: 10, sugestao: { recebeSePropuser: 150, comOsSeusCustos: true, semDistancia: false } as Trabalho["sugestao"] },
    ],
    [
      "sugestão com os custos dele e valor da CLYON",
      { valorDaClyon: 120, distanciaKm: 10, sugestao: { recebeSePropuser: 150, comOsSeusCustos: true, semDistancia: false } as Trabalho["sugestao"] },
    ],
    [
      "sugestão com a referência da CLYON",
      { valorDaClyon: 120, distanciaKm: 10, sugestao: { recebeSePropuser: 150, comOsSeusCustos: false } as Trabalho["sugestao"] },
    ],
    [
      "sugestão sem distância",
      { valorDaClyon: 120, distanciaKm: 10, sugestao: { recebeSePropuser: 150, comOsSeusCustos: true, semDistancia: true } as Trabalho["sugestao"] },
    ],
    [
      "sem distância medida",
      { valorDaClyon: 120, distanciaKm: null, sugestao: { recebeSePropuser: 150, comOsSeusCustos: true, semDistancia: false } as Trabalho["sugestao"] },
    ],
  ];
  const separadores: Separador[] = ["novos", "negociacao", "contratados"];

  for (const [nome, o] of casos) {
    it(nome, () => {
      const t = T({ estado: "aberta", fase: "a_negociar", ...o });
      for (const s of separadores) {
        expect(valorNoCartao(t, s), s).toBe(PAINEL.valorNoCartao(t as never, s));
        expect(bomPorKmDe(t, s), s).toBe(PAINEL.bomPorKmDe(t as never, s));
      }
    });
  }
});

describe("a carteira", () => {
  it("transferir pede IBAN, nenhum pedido em curso e pelo menos 10 €", () => {
    expect(podeTransferir({ temIban: true, temPedidoPendente: false, levantavel: 10 })).toBe(true);
    expect(podeTransferir({ temIban: false, temPedidoPendente: false, levantavel: 500 })).toBe(false);
    expect(podeTransferir({ temIban: true, temPedidoPendente: true, levantavel: 500 })).toBe(false);
    expect(podeTransferir({ temIban: true, temPedidoPendente: false, levantavel: 9.99 })).toBe(false);
  });

  it("o valor lê-se como ele o escreve, entre o mínimo e o que pode pedir", () => {
    expect(lerValorDaTransferencia("12,50", 100)).toBe(12.5);
    expect(lerValorDaTransferencia("100 €", 100)).toBe(100);
    expect(lerValorDaTransferencia("9,99", 100)).toBeNull();
    expect(lerValorDaTransferencia("100,01", 100)).toBeNull();
    expect(lerValorDaTransferencia("abc", 100)).toBeNull();
  });

  it("o histórico agrupa por mês de Lisboa, o mais recente em cima, com o total", () => {
    const m = (id: number, valor: number, data: string): Movimento => ({
      tipo: "trabalho",
      id,
      pedidoId: id,
      titulo: "x",
      zona: null,
      valor,
      fase: "confirmado",
      data,
    });
    const meses = movimentosPorMes([
      m(1, 100, "2026-10-05T10:00:00.000Z"),
      m(2, -40, "2026-10-12T10:00:00.000Z"),
      // 23:30 UTC de 30/09 já é 1 de Outubro em Lisboa.
      m(3, 20, "2026-09-30T23:30:00.000Z"),
      m(4, 50, "2026-09-10T10:00:00.000Z"),
    ]);
    expect(meses.map((x) => [x.mes, x.rotulo, x.total])).toEqual([
      ["2026-10", "Outubro de 2026", 80],
      ["2026-09", "Setembro de 2026", 50],
    ]);
  });

  it("as datas e a média dizem-se à portuguesa", () => {
    expect(diaCurto("2026-10-18T23:30:00.000Z")).toBe("19/10/2026");
    expect(mediaCurta(4.85)).toBe("4,8");
    expect(mediaCurta(null)).toBeNull();
  });
});

describe("a app lê o que o site manda", () => {
  /*
   * Um campo que a app espere e o site não mande chega como `undefined`, e o
   * ecrã cala-se sem ninguém dar por isso. As listas saem dos tipos da app.
   */
  const camposDoTipo = (ficheiro: string, tipo: string): string[] => {
    const fonte = readFileSync(join(process.cwd(), ficheiro), "utf8");
    const i = fonte.indexOf(`export type ${tipo} = {`);
    expect(i, tipo).toBeGreaterThan(-1);
    const corpo = fonte.slice(i, fonte.indexOf("\n};", i));
    return [...corpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  };
  const temCampo = (rota: string, campo: string) => new RegExp(String.raw`(^|[\s{,])${campo}(:|,|\s*\})`, "m").test(rota);

  it("cada campo do perfil da app vem do GET do perfil", () => {
    const campos = camposDoTipo("app-pro/src/lib/conta.ts", "Perfil");
    expect(campos.length).toBeGreaterThan(40);
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/perfil/route.ts"), "utf8");
    expect(campos.filter((c) => !temCampo(rota, c))).toEqual([]);
  });

  it("cada campo da carteira da app vem do GET da carteira", () => {
    const campos = camposDoTipo("app-pro/src/lib/conta.ts", "RespostaDaCarteira");
    expect(campos.length).toBeGreaterThanOrEqual(10);
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/carteira/route.ts"), "utf8");
    expect(campos.filter((c) => !temCampo(rota, c))).toEqual([]);
  });
});
