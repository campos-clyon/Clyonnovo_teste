import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categoria, Movimento } from "./financas";
import { diasDoMes, gastosDoMes, gastosNoIntervalo, type Gasto } from "./financas-gastos";
import {
  contasDoMes,
  diasEntre,
  dividirEntrada,
  lucroNoIntervalo,
  parteDaSociaNoIntervalo,
  parteDaSociaNoMes,
  type DadosDasContas,
  type LinhaParaDividir,
  type PeriodoDaSocia,
} from "./financas-do-mes";
import { dinheiroDoInicio, intervalosDoInicio, segundaDoDia } from "./dinheiro-do-inicio";
import { operacaoDoInicio, type LinhaDoDesempenho } from "./desempenho";

/**
 * O DINHEIRO NO INÍCIO — d56, 17-11-2026.
 *
 * O lucro de hoje, da semana, do mês e do ano pela conta das Finanças, com
 * os recorrentes rateados por dia, a semana a começar à segunda e a parte da
 * sócia à parte. Todos os nomes e valores aqui são inventados.
 */

const CONTA = { total: 123, iva: 23, clyon: 10, profissional: 90 };

function entrada(p: Partial<LinhaParaDividir>) {
  return dividirEntrada({
    id: 1,
    pedidoId: 900,
    dia: "2026-11-17",
    metodo: "mbway",
    valor: 123,
    formaDoTrabalho: "plataforma",
    trid: null,
    parte: "trabalho",
    comissaoEupago: 0,
    conta: CONTA,
    ...p,
  });
}

function gasto(p: Partial<Gasto>): Gasto {
  return {
    id: 1,
    nome: "Assinatura inventada",
    valor: 30,
    categoriaId: null,
    tipo: "recorrente",
    inicio: "2026-01",
    dia: null,
    pausas: [],
    notas: null,
    criadoPor: null,
    ...p,
  };
}

const CATEGORIAS: Categoria[] = [{ id: 1, nome: "Serviços", tipo: "despesa", cor: "azul", icone: "servicos", sistema: null }];

function mov(p: Partial<Movimento>): Movimento {
  return {
    id: "m1",
    tipo: "despesa",
    valor: 0,
    dia: "2026-11-05",
    descricao: "",
    categoriaId: 1,
    contaId: 1,
    contaDestinoId: null,
    efectivado: true,
    ignorado: false,
    notas: null,
    anexo: null,
    automatico: null,
    criadoPor: null,
    ...p,
  };
}

const SOCIA = "Sócia inventada";
const PERIODOS: PeriodoDaSocia[] = [
  { nome: SOCIA, assistenteId: 7, percentagem: 1, inicio: "2026-11-01", fim: "2026-11-15", rotulo: "1–15 nov", estado: "pago", lucro: 0, comissao: 15, pendentes: 0 },
  { nome: SOCIA, assistenteId: 7, percentagem: 1, inicio: "2026-11-16", fim: "2026-11-30", rotulo: "16–30 nov", estado: "em_curso", lucro: 0, comissao: 4, pendentes: 0 },
];

function dados(extra: Partial<DadosDasContas> = {}): DadosDasContas {
  return {
    entradas: [
      entrada({ id: 1, dia: "2026-11-03" }),
      entrada({ id: 2, dia: "2026-11-16", comissaoEupago: 1 }),
      entrada({ id: 3, dia: "2026-11-17" }),
    ],
    movimentos: [mov({ id: "m1", valor: 6, dia: "2026-11-05" }), mov({ id: "m2", tipo: "receita", valor: 2, dia: "2026-11-17", categoriaId: null })],
    categorias: CATEGORIAS,
    gastos: [gasto({ id: 1, valor: 30 }), gasto({ id: 2, tipo: "ocasional", inicio: null, dia: "2026-11-17", valor: 12 })],
    assistentes: [
      { dia: "2026-11-16", valor: 15, nome: SOCIA, periodo: "2026-11-01 a 2026-11-15", assistenteId: 7 },
      { dia: "2026-11-10", valor: 5, nome: "Assistente inventado", periodo: "x", assistenteId: 8 },
    ],
    ...extra,
  };
}

describe("a semana começa à segunda, em dias de Lisboa", () => {
  it("terça, domingo e segunda dão a mesma segunda", () => {
    expect(segundaDoDia("2026-11-17")).toBe("2026-11-16");
    expect(segundaDoDia("2026-11-22")).toBe("2026-11-16");
    expect(segundaDoDia("2026-11-16")).toBe("2026-11-16");
    // Uma semana que começa no mês anterior.
    expect(segundaDoDia("2026-12-02")).toBe("2026-11-30");
  });

  it("os quatro intervalos: hoje e a semana por dia; o mês e o ano com os meses inteiros", () => {
    const iv = intervalosDoInicio("2026-11-17");
    expect(iv.hoje).toEqual({ de: "2026-11-17", recorrentes: "por_dia" });
    expect(iv.semana).toEqual({ de: "2026-11-16", recorrentes: "por_dia" });
    expect(iv.mes).toEqual({ de: "2026-11-01", recorrentes: "mes_inteiro" });
    expect(iv.ano).toEqual({ de: "2026-01-01", recorrentes: "mes_inteiro" });
  });

  it("os pedidos da Operação contam-se pela mesma semana e pelo dia de Lisboa", () => {
    const l = (id: number, iso: string, cancelado = false, deTeste = false): LinhaDoDesempenho => ({
      id,
      criadoEm: new Date(iso),
      servico: "recolha_monos",
      realizadoEm: null,
      cancelado,
      deTeste,
    });
    const op = operacaoDoInicio(
      [
        l(1, "2026-11-17T09:00:00Z"),
        // 23h30 de Lisboa de domingo: é da semana anterior.
        l(2, "2026-11-15T23:30:00Z"),
        l(3, "2026-11-16T08:00:00Z", true),
        l(4, "2026-11-17T10:00:00Z", false, true),
        l(5, "2026-10-31T10:00:00Z"),
      ],
      new Date("2026-11-17T12:00:00Z"),
    );
    expect(op).toEqual({ entradosHoje: 1, entradosSemana: 2, entradosMes: 3, canceladosDoMes: 1 });
  });
});

describe("os recorrentes rateiam-se por dia; os ocasionais contam no dia", () => {
  it("30 € por mês num mês de 30 dias: 1 € hoje, 2 € de segunda a terça, 30 € no mês inteiro", () => {
    const g = [gasto({ valor: 30 })];
    expect(diasDoMes("2026-11")).toBe(30);
    expect(gastosNoIntervalo(g, "2026-11-17", "2026-11-17", "por_dia").recorrentes).toBe(1);
    expect(gastosNoIntervalo(g, "2026-11-16", "2026-11-17", "por_dia").recorrentes).toBe(2);
    expect(gastosNoIntervalo(g, "2026-11-01", "2026-11-30", "por_dia").total).toBe(gastosDoMes(g, "2026-11").total);
    expect(gastosNoIntervalo(g, "2026-11-01", "2026-11-17", "mes_inteiro").recorrentes).toBe(30);
  });

  it("uma semana entre dois meses reparte cada mês pelos dias dele", () => {
    const g = [gasto({ valor: 31 })];
    // 30/11 (31 ÷ 30) + 1–6/12 (6 × 31 ÷ 31).
    expect(gastosNoIntervalo(g, "2026-11-30", "2026-12-06", "por_dia").recorrentes).toBeCloseTo(31 / 30 + 6, 2);
  });

  it("um ocasional só pesa no dia dele, e um suspenso não pesa", () => {
    const g = [gasto({ tipo: "ocasional", inicio: null, dia: "2026-11-17", valor: 12 })];
    expect(gastosNoIntervalo(g, "2026-11-17", "2026-11-17", "por_dia").ocasionais).toBe(12);
    expect(gastosNoIntervalo(g, "2026-11-16", "2026-11-16", "por_dia").ocasionais).toBe(0);
    const suspenso = [gasto({ tipo: "ocasional", inicio: null, dia: "2026-11-17", valor: 12, pausas: [{ de: "2026-11", ate: null }] })];
    expect(gastosNoIntervalo(suspenso, "2026-11-01", "2026-11-30", "por_dia").total).toBe(0);
  });

  it("um recorrente que começa a meio do ano não conta antes", () => {
    const g = [gasto({ valor: 30, inicio: "2026-11" })];
    expect(gastosNoIntervalo(g, "2026-10-31", "2026-10-31", "por_dia").total).toBe(0);
  });
});

describe("o mês inteiro dá o mesmo que as Finanças", () => {
  it("receita, gastos e lucro (sem pagamentos à sócia) iguais aos de contasDoMes, nos dois modos", () => {
    const d = dados({ assistentes: [{ dia: "2026-11-10", valor: 5, nome: "Assistente inventado", periodo: "x" }] });
    const f = contasDoMes(d, "2026-11");
    for (const recorrentes of ["por_dia", "mes_inteiro"] as const) {
      const l = lucroNoIntervalo(d, "2026-11-01", "2026-11-30", { hoje: "2026-11-30", recorrentes, socia: null });
      expect(l.receita).toBe(f.receita.total);
      expect(l.gastos).toBe(f.gastos.total);
      expect(l.assistentes).toBe(f.assistentes);
      expect(l.lucro).toBe(f.lucro);
      expect(l.dias).toBe(30);
      expect(l.mediaPorDia).toBeCloseTo(f.lucro / 30, 2);
    }
  });

  it("o «Este mês» do Início (do dia 1 até hoje) é o mês das Finanças", () => {
    const d = dados({ assistentes: [] });
    const din = dinheiroDoInicio(d, null, "2026-11-17");
    expect(din.mes.lucro).toBe(contasDoMes(d, "2026-11").lucro);
    expect(din.mes.gastos).toBe(contasDoMes(d, "2026-11").gastos.total);
  });
});

describe("antes e depois da sócia", () => {
  it("a parte da sócia espalha-se pelos dias do período; o em curso só até hoje", () => {
    // 1–15 pago (15 € em 15 dias = 1 €/dia); 16–30 em curso, 4 € em 2 dias até hoje = 2 €/dia.
    expect(parteDaSociaNoIntervalo(PERIODOS, "2026-11-17", "2026-11-17", "2026-11-17")).toBe(2);
    expect(parteDaSociaNoIntervalo(PERIODOS, "2026-11-15", "2026-11-16", "2026-11-17")).toBe(3);
    expect(diasEntre("2026-11-16", "2026-11-17")).toBe(2);
  });

  it("no mês inteiro, a parte da sócia é a das Finanças", () => {
    const l = lucroNoIntervalo(dados(), "2026-11-01", "2026-11-17", { hoje: "2026-11-17", recorrentes: "mes_inteiro", socia: PERIODOS });
    const s = parteDaSociaNoMes(PERIODOS, "2026-11");
    expect(s.ha && s.comissao).toBe(19);
    expect(l.socia).toBe(19);
    expect(l.lucroDepoisDaSocia).toBe(Math.round((l.lucro - 19) * 100) / 100);
  });

  it("o que já se pagou à sócia não conta duas vezes: sai dos assistentes", () => {
    const d = dados();
    const f = contasDoMes(d, "2026-11");
    const l = lucroNoIntervalo(d, "2026-11-01", "2026-11-30", { hoje: "2026-11-17", recorrentes: "mes_inteiro", socia: PERIODOS });
    expect(f.assistentes).toBe(20);
    expect(l.assistentes).toBe(5);
    // O lucro antes da sócia = o das Finanças mais o que lá saiu para ela.
    expect(l.lucro).toBe(Math.round((f.lucro + 15) * 100) / 100);
  });

  it("o «Hoje»: receita do dia, recorrente do dia, ocasional do dia, e a sócia do dia", () => {
    const din = dinheiroDoInicio(dados(), PERIODOS, "2026-11-17");
    const h = din.hoje;
    // Receita: a taxa de uma entrada (10) + a receita à mão (2). Gastos: 1 (30 ÷ 30) + 12.
    expect(h.receita).toBe(12);
    expect(h.gastos).toBe(13);
    expect(h.assistentes).toBe(0);
    expect(h.lucro).toBe(-1);
    expect(h.socia).toBe(2);
    expect(h.lucroDepoisDaSocia).toBe(-3);
    expect(h.dias).toBe(1);
    // A semana: duas entradas (20) + 2 à mão − (2 recorrente + 12 + 1 euPago) = 7; sócia 4.
    expect(din.semana.lucro).toBe(7);
    expect(din.semana.socia).toBe(4);
    expect(din.semana.mediaPorDia).toBe(3.5);
  });

  it("quem não é o administrador não vê os assistentes nem a sócia", () => {
    const l = lucroNoIntervalo(dados({ assistentes: null }), "2026-11-17", "2026-11-17", {
      hoje: "2026-11-17",
      recorrentes: "por_dia",
      socia: PERIODOS,
    });
    expect(l.assistentes).toBeNull();
    expect(l.socia).toBeNull();
    expect(l.lucroDepoisDaSocia).toBeNull();
  });
});

describe("o ecrã", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("a rota vive debaixo das Finanças, e os assistentes e a sócia só vão ao administrador", () => {
    const rota = ler("src/app/api/admin/financas/inicio/route.ts");
    expect(rota).toContain("dinheiroDoInicio(");
    expect(rota).toContain("diaEmLisboa(new Date())");
    expect(rota).toContain("eAdmin ? pagamentosAosAssistentes() : Promise.resolve(null)");
    expect(rota).toContain("eAdmin ? periodosDaSocia() : Promise.resolve(null)");
  });
  it("a percentagem da sócia não se escreve no Início", () => {
    const ecra = ler("src/components/admin/DinheiroDoInicio.tsx");
    expect(ecra).not.toMatch(/percentagem|\d+\s*%/);
  });
  it("a ordem: precisa de si, dinheiro, operação, desempenho", () => {
    const p = ler("src/components/admin/AdminInicioPanel.tsx");
    const i = (t: string) => p.indexOf(t);
    expect(i("Precisa de si")).toBeGreaterThan(-1);
    expect(i("Precisa de si")).toBeLessThan(i("<DinheiroDoInicio"));
    expect(i("<DinheiroDoInicio")).toBeLessThan(i("Operação</h2>"));
    expect(i("Operação</h2>")).toBeLessThan(i("<DesempenhoDoInicio />"));
  });
});
