import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aindaNaoContamDe,
  comissoesPorPeriodo,
  noAlcanceDe,
  pedidosPagos,
  previsaoPorPeriodo,
  type LinhaQueAindaNaoConta,
  type LinhaQueConta,
  type PagamentoDeComissao,
} from "./assistentes";
import {
  comExcepcao,
  contaDepoisDaSaida,
  diaDeSaidaValido,
  excepcoesDoJson,
  rotuloDaSaida,
  type SaidaDaConta,
} from "./saida-da-assistente";

/**
 * d40, 15-11-2026 — a saída de uma assistente. Depois do dia de saída nada
 * conta para ela («todos» ou «os seus»), pelo dia que o período usa; excepto
 * os pedidos marcados um a um, que contam quando ficarem concluídos, na
 * quinzena em que forem feitos. Os períodos pagos não mudam.
 *
 * Nomes e valores inventados (o repositório é público).
 */

const ID = 7;
const OUTRA = 8;
const SAIDA: SaidaDaConta = { saiuA: "2026-11-10", excepcoes: [903] };

const concluido = (id: number, feitoEm: string, extra: Partial<LinhaQueConta> = {}): LinhaQueConta => ({
  id,
  status: "concluido",
  concluidoEm: feitoEm,
  feitoEm,
  lucroManual: 10,
  assignedToId: ID,
  ...extra,
});

// Ao meio-dia de Lisboa (11:00 UTC no Inverno).
const linhas: LinhaQueConta[] = [
  concluido(901, "2026-11-05T11:00:00Z"), // antes da saída
  concluido(902, "2026-11-10T22:30:00Z"), // 22:30 UTC de 10/11 = 22:30 em Lisboa: ainda o dia da saída
  concluido(903, "2026-11-12T11:00:00Z"), // depois, marcado
  concluido(904, "2026-11-12T11:00:00Z"), // depois, sem marca
  concluido(905, "2026-11-13T11:00:00Z", { assignedToId: OUTRA }), // depois, de outra pessoa
  concluido(906, "2026-11-04T11:00:00Z", { assignedToId: OUTRA }), // antes, de outra pessoa
];

const ids = (l: Array<{ id: number }>) => l.map((x) => Number(x.id)).sort((a, b) => a - b);

describe("a regra pura", () => {
  it("sem saída, tudo conta como antes", () => {
    expect(contaDepoisDaSaida(1, "2030-01-01", { saiuA: null, excepcoes: [] })).toEqual({ conta: true, porExcepcao: false });
    expect(contaDepoisDaSaida(1, null, undefined).conta).toBe(true);
  });

  it("o próprio dia da saída ainda conta; o seguinte já não", () => {
    expect(contaDepoisDaSaida(1, "2026-11-10", SAIDA).conta).toBe(true);
    expect(contaDepoisDaSaida(1, "2026-11-11", SAIDA).conta).toBe(false);
  });

  it("um marcado conta depois da saída, e diz que é por excepção", () => {
    expect(contaDepoisDaSaida(903, "2026-11-20", SAIDA)).toEqual({ conta: true, porExcepcao: true });
    // Antes da saída não precisa da marca: não se diz «por excepção».
    expect(contaDepoisDaSaida(903, "2026-11-01", SAIDA)).toEqual({ conta: true, porExcepcao: false });
  });

  it("lê e escreve a lista das excepções com desconfiança", () => {
    expect(excepcoesDoJson('[5, "7", 5, -1, "x", 0]')).toEqual([7, 5]);
    expect(excepcoesDoJson("não é json")).toEqual([]);
    expect(excepcoesDoJson(null)).toEqual([]);
    expect(comExcepcao([5], 9, true)).toEqual([9, 5]);
    expect(comExcepcao([9, 5], 9, false)).toEqual([5]);
    expect(comExcepcao([9], 9, true)).toEqual([9]);
  });

  it("só aceita dias que existem", () => {
    expect(diaDeSaidaValido("2026-11-10")).toBe("2026-11-10");
    expect(diaDeSaidaValido("2026-02-30")).toBeNull();
    expect(diaDeSaidaValido("10/11/2026")).toBeNull();
    expect(rotuloDaSaida("2026-11-10")).toBe("Saiu a 10/11/2026");
  });
});

describe("que trabalhos contam para a conta", () => {
  it("«todos», com saída: os de até ao dia, mais os marcados", () => {
    const r = noAlcanceDe(linhas, { id: ID, comissaoSobre: "todos", saida: SAIDA });
    expect(ids(r)).toEqual([901, 902, 903, 906]);
    expect(r.find((l) => l.id === 903)?.porExcepcao).toBe(true);
    expect(r.find((l) => l.id === 901)?.porExcepcao).toBeUndefined();
  });

  it("«os seus», com saída: os dela até ao dia, mais os marcados", () => {
    const r = noAlcanceDe(linhas, { id: ID, comissaoSobre: "seus", saida: SAIDA });
    expect(ids(r)).toEqual([901, 902, 903]);
  });

  it("um marcado de outra pessoa também conta para ela, mesmo em «os seus»", () => {
    const r = noAlcanceDe(linhas, { id: ID, comissaoSobre: "seus", saida: { ...SAIDA, excepcoes: [905] } });
    expect(ids(r)).toEqual([901, 902, 905]);
  });

  it("sem saída, as marcas não mudam nada", () => {
    const r = noAlcanceDe(linhas, { id: ID, comissaoSobre: "seus", saida: { saiuA: null, excepcoes: [905] } });
    expect(ids(r)).toEqual([901, 902, 903, 904]);
  });

  it("nos antigos sem feitoEm, conta o dia da conclusão", () => {
    const antigo = concluido(907, "2026-11-12T11:00:00Z", { feitoEm: null });
    expect(noAlcanceDe([antigo], { id: ID, comissaoSobre: "todos", saida: SAIDA })).toHaveLength(0);
    // Feito antes da saída e confirmado depois: conta (pelo dia em que foi feito).
    const tarde = concluido(908, "2026-11-12T11:00:00Z", { feitoEm: "2026-11-09T11:00:00Z" });
    expect(noAlcanceDe([tarde], { id: ID, comissaoSobre: "todos", saida: SAIDA })).toHaveLength(1);
  });
});

describe("os períodos", () => {
  const hoje = "2026-11-20";

  it("o marcado entra na quinzena em que é feito, e não antes", () => {
    const marcado = concluido(903, "2026-11-18T11:00:00Z");
    const r = comissoesPorPeriodo({
      linhas: noAlcanceDe([...linhas.slice(0, 2), marcado], { id: ID, comissaoSobre: "todos", saida: SAIDA }),
      pagamentos: [],
      minhaPercent: 40,
      hoje,
    });
    const primeira = r.periodos.find((p) => p.inicio === "2026-11-01")!;
    const segunda = r.periodos.find((p) => p.inicio === "2026-11-16")!;
    expect(primeira.detalhe.map((t) => t.pedidoId).sort()).toEqual([901, 902]);
    expect(segunda.detalhe.map((t) => t.pedidoId)).toEqual([903]);
    expect(segunda.detalhe[0].porExcepcao).toBe(true);
    expect(segunda.comissaoAssistente).toBe(4);
  });

  it("um período pago não muda, nem aparece diferença, com uma saída posta para trás", () => {
    const pago: PagamentoDeComissao = {
      periodoInicio: "2026-10-16",
      periodoFim: "2026-10-31",
      valorTrabalhos: 0,
      comissaoPercent: 40,
      valorPago: 8,
      trabalhos: [
        { pedidoId: 801, valor: 0, fonteDoValor: "lucro_manual", lucro: 10, comissaoAssistente: 4, concluidoEm: null, servico: null },
        { pedidoId: 802, valor: 0, fonteDoValor: "lucro_manual", lucro: 10, comissaoAssistente: 4, concluidoEm: null, servico: null },
      ],
      pagoEm: "2026-11-01T10:00:00Z",
      pagoPor: "ADMIN",
    };
    const doPago = [concluido(801, "2026-10-20T11:00:00Z"), concluido(802, "2026-10-25T11:00:00Z")];
    const saidaParaTras: SaidaDaConta = { saiuA: "2026-10-18", excepcoes: [] };
    const r = comissoesPorPeriodo({
      linhas: noAlcanceDe(doPago, { id: ID, comissaoSobre: "todos", saida: saidaParaTras }, pedidosPagos([pago])),
      pagamentos: [pago],
      minhaPercent: 40,
      hoje,
    });
    const p = r.periodos.find((x) => x.inicio === "2026-10-16")!;
    expect(p.estado).toBe("pago");
    expect(p.comissaoAssistente).toBe(8);
    expect(p.trabalhos).toBe(2);
    expect(p.diferenca).toBeNull();
  });
});

describe("o que ainda não conta e a previsão", () => {
  const hoje = "2026-11-15";
  const porFazer = (id: number, dataCombinada: string, extra: Partial<LinhaQueAindaNaoConta> = {}): LinhaQueAindaNaoConta => ({
    id,
    status: "confirmado",
    dataCombinada,
    lucroManual: 10,
    assignedToId: ID,
    ...extra,
  });
  const abertos = [porFazer(910, "2026-11-18T09:00:00Z"), porFazer(911, "2026-11-19T09:00:00Z")];
  const saida: SaidaDaConta = { saiuA: "2026-11-10", excepcoes: [910] };

  it("os que ficam depois da saída dizem porquê; o marcado diz que conta por excepção", () => {
    const r = aindaNaoContamDe(abertos, { id: ID, comissaoSobre: "todos", saida }, hoje);
    const marcado = r.find((t) => t.pedidoId === 910)!;
    const outro = r.find((t) => t.pedidoId === 911)!;
    expect(marcado.motivo).toBe("por_fazer");
    expect(marcado.porExcepcao).toBe(true);
    expect(marcado.porque).toContain("falou com o cliente");
    expect(outro.motivo).toBe("depois_da_saida");
  });

  it("a previsão só tem o marcado, na quinzena do dia marcado", () => {
    const r = previsaoPorPeriodo({ linhas: abertos, a: { id: ID, comissaoSobre: "todos", saida }, minhaPercent: 40, hoje });
    const segunda = r.find((p) => p.inicio === "2026-11-16")!;
    expect(segunda.detalhe.map((t) => t.pedidoId)).toEqual([910]);
    expect(segunda.detalhe[0].porExcepcao).toBe(true);
    expect(r.find((p) => p.inicio === "2026-11-01")).toBeUndefined();
  });

  it("sem saída, a previsão fica como era", () => {
    const r = previsaoPorPeriodo({ linhas: abertos, a: { id: ID, comissaoSobre: "todos" }, minhaPercent: 40, hoje });
    expect(r.find((p) => p.inicio === "2026-11-16")!.trabalhos).toBe(2);
  });
});

describe("quem pode mudar", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/admin/assistentes/route.ts"), "utf8");
  it("o dia de saída e as excepções só pela rota do administrador geral, com histórico", () => {
    expect(rota).toMatch(/requireAdminGeral\(req\)/);
    expect(rota).toContain("definirSaidaDoAssistente(");
    expect(rota).toContain("definirExcepcaoDaSaida(");
    // A marca fica no histórico do pedido.
    const depois = rota.slice(rota.indexOf("definirExcepcaoDaSaida(id"));
    expect(depois.indexOf("appendOrderHistory(")).toBeGreaterThan(0);
  });

  it("o ecrã da assistente não traz a gestão da saída (só o do administrador)", () => {
    const ecraDela = readFileSync(join(process.cwd(), "src/components/admin/TrabalhosDoAssistente.tsx"), "utf8");
    expect(ecraDela).not.toContain("excepcaoDaSaida");
    expect(ecraDela).not.toContain("saiuA:");
  });
});
