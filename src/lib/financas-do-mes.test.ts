import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categoria, Movimento } from "./financas";
import {
  contaNoMes,
  estaSuspenso,
  gastosDoMes,
  lerGasto,
  reactivar,
  suspender,
  totalMensalDosRecorrentes,
  type Gasto,
} from "./financas-gastos";
import {
  balancoDoMes,
  contasDoMes,
  dividirEntrada,
  parteDaSociaNoMes,
  previsaoAnual,
  type DadosDasContas,
  type EntradaDaPlataforma,
  type LinhaParaDividir,
  type PeriodoDaSocia,
} from "./financas-do-mes";
import { assistenteComSeccoesPodeChamar, assistentePodeChamar } from "./papel-do-painel";
import ResumoDasFinancas from "@/components/admin/financas/ResumoDasFinancas";
import GastosDaClyon from "@/components/admin/financas/GastosDaClyon";

/**
 * AS CONTAS DO MÊS E OS GASTOS — 07-11-2026 (d21, dono).
 *
 * Bruto, IVA, receita, gastos, lucro; recorrente e ocasional; suspenso e
 * reactivado; a previsão do ano. Todos os nomes e valores aqui são
 * inventados: os gastos verdadeiros são do negócio e vivem só na base.
 */

// Nos testes o JSX sai como `React.createElement` e precisa do `React` à mão.
(globalThis as { React?: typeof React }).React = React;

const CONTA = { total: 123, iva: 23, clyon: 11, profissional: 89 };

function linha(p: Partial<LinhaParaDividir>): LinhaParaDividir {
  return {
    id: 1,
    pedidoId: 500,
    dia: "2026-10-10",
    metodo: "mbway",
    valor: 123,
    formaDoTrabalho: "plataforma",
    trid: null,
    parte: "trabalho",
    comissaoEupago: 0,
    conta: CONTA,
    ...p,
  };
}

function gasto(p: Partial<Gasto>): Gasto {
  return {
    id: 1,
    nome: "Assinatura inventada",
    valor: 10,
    categoriaId: null,
    tipo: "recorrente",
    inicio: "2026-09",
    dia: null,
    pausas: [],
    notas: null,
    criadoPor: null,
    ...p,
  };
}

const CATEGORIAS: Categoria[] = [
  { id: 1, nome: "Serviços", tipo: "despesa", cor: "azul", icone: "servicos", sistema: null },
  { id: 2, nome: "Trabalhos feitos", tipo: "receita", cor: "lima", icone: "trabalho", sistema: null },
  { id: 9, nome: "Pagamentos aos profissionais", tipo: "despesa", cor: "violeta", icone: "profissionais", sistema: "pagamentos_aos_profissionais" },
];

function mov(p: Partial<Movimento>): Movimento {
  return {
    id: "m1",
    tipo: "despesa",
    valor: 0,
    dia: "2026-10-05",
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

describe("um pagamento em três partes — IVA, taxa e parte do profissional", () => {
  it("o pagamento inteiro do cliente: as três partes da conta, e somam o valor", () => {
    const e = dividirEntrada(linha({}));
    expect([e.iva, e.receita, e.profissional]).toEqual([23, 11, 89]);
    expect(e.entraNaClyon).toBe(true);
    expect(e.daParteDaClyon).toBe(false);
  });

  it("um pagamento parcial divide-se na proporção da conta", () => {
    const e = dividirEntrada(linha({ valor: 61.5 }));
    expect([e.iva, e.profissional, e.receita]).toEqual([11.5, 44.5, 5.5]);
    expect(e.iva + e.profissional + e.receita).toBeCloseTo(61.5, 2);
  });

  it("a parte da CLYON paga pelo profissional (pago em mão) é IVA e taxa, nada dele", () => {
    for (const l of [
      linha({ valor: 34, formaDoTrabalho: "dinheiro" }),
      linha({ valor: 34, metodo: "pro_transferencia" }),
      linha({ valor: 34, metodo: "multibanco", trid: "abatimento-mao-7" }),
    ]) {
      const e = dividirEntrada(l);
      expect(e.daParteDaClyon).toBe(true);
      expect([e.iva, e.receita, e.profissional]).toEqual([23, 11, 0]);
    }
  });

  it("pago em mão ao profissional e acertos no saldo não entram na CLYON (a regra de a-quem-foi-o-dinheiro)", () => {
    for (const metodo of ["ao_profissional", "abatimento", "quitacao"]) {
      const e = dividirEntrada(linha({ metodo }));
      expect(e.entraNaClyon).toBe(false);
      expect([e.iva, e.receita, e.profissional]).toEqual([0, 0, 0]);
    }
  });

  it("sem a conta do trabalho, entra no bruto e fica por separar", () => {
    const e = dividirEntrada(linha({ conta: null }));
    expect(e.semConta).toBe(true);
    expect([e.iva, e.receita]).toEqual([0, 0]);
  });
});

describe("os gastos: recorrente, ocasional, suspenso", () => {
  it("um recorrente conta em cada mês desde o início", () => {
    const g = gasto({ inicio: "2026-09" });
    expect(contaNoMes(g, "2026-08")).toBe(false);
    expect(contaNoMes(g, "2026-09")).toBe(true);
    expect(contaNoMes(g, "2027-03")).toBe(true);
  });

  it("um ocasional conta só no mês da data", () => {
    const g = gasto({ tipo: "ocasional", inicio: null, dia: "2026-11-20" });
    expect(contaNoMes(g, "2026-10")).toBe(false);
    expect(contaNoMes(g, "2026-11")).toBe(true);
    expect(contaNoMes(g, "2026-12")).toBe(false);
  });

  it("suspenso deixa de contar a partir do mês escolhido; reactivado volta, e os meses parados ficam parados", () => {
    const g = gasto({ inicio: "2026-09" });
    const suspenso = { ...g, pausas: suspender(g, "2026-11") };
    expect(contaNoMes(suspenso, "2026-10")).toBe(true);
    expect(contaNoMes(suspenso, "2026-11")).toBe(false);
    expect(contaNoMes(suspenso, "2027-05")).toBe(false);
    expect(estaSuspenso(suspenso, "2026-10")).toBe(true);
    const outraVez = { ...suspenso, pausas: reactivar(suspenso, "2027-01") };
    expect(contaNoMes(outraVez, "2026-12")).toBe(false);
    expect(contaNoMes(outraVez, "2027-01")).toBe(true);
    expect(estaSuspenso(outraVez, "2027-01")).toBe(false);
    // Reactivar antes de a pausa começar desfaz a pausa.
    expect(reactivar(suspenso, "2026-11")).toEqual([]);
  });

  it("um ocasional suspenso não conta; reactivado volta ao mês dele", () => {
    const g = gasto({ tipo: "ocasional", inicio: null, dia: "2026-11-20" });
    const s = { ...g, pausas: suspender(g, "2026-10") };
    expect(contaNoMes(s, "2026-11")).toBe(false);
    expect(contaNoMes({ ...s, pausas: reactivar(s, "2026-10") }, "2026-11")).toBe(true);
  });

  it("o total mensal soma só os recorrentes activos", () => {
    const gastos = [
      gasto({ id: 1, valor: 12.5 }),
      gasto({ id: 2, valor: 7.25 }),
      gasto({ id: 3, valor: 100, pausas: [{ de: "2026-10", ate: null }] }),
      gasto({ id: 4, valor: 40, tipo: "ocasional", inicio: null, dia: "2026-11-03" }),
    ];
    expect(totalMensalDosRecorrentes(gastos, "2026-11")).toBe(19.75);
    expect(gastosDoMes(gastos, "2026-11")).toMatchObject({ recorrentes: 19.75, ocasionais: 40, total: 59.75 });
  });

  it("ao criar, recorrente ou ocasional é obrigatório", () => {
    expect(lerGasto({ nome: "X", valor: "10,00", inicio: "2026-11" }, CATEGORIAS)).toMatchObject({ ok: false });
    expect(lerGasto({ nome: "X", valor: "10,00", tipo: "recorrente", inicio: "2026-11" }, CATEGORIAS)).toMatchObject({
      ok: true,
      dados: { valor: 10, tipo: "recorrente", inicio: "2026-11", dia: null },
    });
    expect(lerGasto({ nome: "X", valor: "1.234,50", tipo: "ocasional", dia: "2026-11-31" }, CATEGORIAS)).toMatchObject({ ok: false });
    expect(lerGasto({ nome: "X", valor: "8", tipo: "ocasional", dia: "2026-11-30" }, CATEGORIAS)).toMatchObject({ ok: true });
    // Só categorias de despesas.
    expect(lerGasto({ nome: "X", valor: "8", tipo: "ocasional", dia: "2026-11-30", categoriaId: 2 }, CATEGORIAS)).toMatchObject({ ok: false });
  });
});

function dados(p: Partial<DadosDasContas> = {}): DadosDasContas {
  return { entradas: [], movimentos: [], categorias: CATEGORIAS, gastos: [], assistentes: [], ...p };
}
const entrada = (p: Partial<LinhaParaDividir>): EntradaDaPlataforma => dividirEntrada(linha(p));

describe("as contas do mês", () => {
  const D = dados({
    entradas: [
      entrada({ id: 1, metodo: "mbway", comissaoEupago: 0.5 }),
      entrada({ id: 2, metodo: "multibanco", comissaoEupago: 0.75 }),
      entrada({ id: 3, metodo: "pro_numerario", valor: 34, formaDoTrabalho: "dinheiro" }),
      entrada({ id: 4, metodo: "ao_profissional", valor: 200 }),
      entrada({ id: 5, metodo: "mbway", dia: "2026-09-30" }),
    ],
    movimentos: [
      mov({ id: "auto:pago:1", automatico: { de: "pago_ao_profissional", pedidoId: 500 }, valor: 89, categoriaId: 9 }),
      mov({ id: "m1", valor: 15 }),
      mov({ id: "m2", tipo: "receita", valor: 30, categoriaId: 2 }),
      // Lançado à mão numa categoria da plataforma: já vem sozinho, não conta duas vezes.
      mov({ id: "m3", valor: 999, categoriaId: 9 }),
      mov({ id: "m4", valor: 1000, ignorado: true }),
    ],
    gastos: [gasto({ valor: 20 }), gasto({ id: 2, valor: 5, tipo: "ocasional", inicio: null, dia: "2026-10-15" })],
    assistentes: [{ dia: "2026-10-16", valor: 8, nome: "Assistente inventada", periodo: "2026-10-01 a 2026-10-15" }],
  });
  const c = contasDoMes(D, "2026-10");

  it("bruto = o que entrou na CLYON, com IVA; o pago em mão fica à parte", () => {
    expect(c.bruto).toBe(123 + 123 + 34);
    expect(c.iva).toBe(23 * 3);
    expect(c.receita.taxas).toBe(11 * 3);
    expect(c.parteDosProfissionais).toBe(89 * 2);
    expect(c.bruto).toBeCloseTo(c.iva + c.receita.taxas + c.parteDosProfissionais, 2);
    expect(c.naoEntrou.emMao).toEqual({ n: 1, valor: 200 });
    expect(c.pagoPelosProfissionais).toEqual({ n: 1, valor: 34 });
  });

  it("por onde entrou", () => {
    expect(c.porOnde.mbway).toEqual({ n: 1, valor: 123 });
    expect(c.porOnde.multibanco).toEqual({ n: 1, valor: 123 });
    expect(c.porOnde.numerario).toEqual({ n: 1, valor: 34 });
  });

  it("gastos = recorrentes + ocasionais + lançados à mão + euPago; lucro = receita − gastos − assistentes", () => {
    expect(c.gastos).toMatchObject({ recorrentes: 20, ocasionais: 5, lancadas: 15, eupago: 1.25, total: 41.25 });
    expect(c.receita).toEqual({ taxas: 33, lancadas: 30, total: 63 });
    expect(c.pagoAosProfissionais).toBe(89);
    expect(c.assistentes).toBe(8);
    expect(c.lucro).toBe(63 - 41.25 - 8);
    expect(balancoDoMes(c)).toEqual({ mes: "2026-10", entradas: 63, gastos: 41.25, assistentes: 8, balanco: 13.75 });
  });

  it("sem acesso aos assistentes, o lucro é antes deles e diz-se", () => {
    const s = contasDoMes({ ...D, assistentes: null }, "2026-10");
    expect(s.assistentes).toBeNull();
    expect(s.lucro).toBe(63 - 41.25);
  });
});

describe("a previsão do ano", () => {
  it("o passado é real; o que falta é a média de 3 meses de receita mais os gastos marcados", () => {
    // Receita de taxas: agosto 11, setembro 22, outubro 33 → média 22.
    const entradas = [
      entrada({ id: 1, dia: "2026-08-10" }),
      entrada({ id: 2, dia: "2026-09-10" }),
      entrada({ id: 3, dia: "2026-09-11" }),
      entrada({ id: 4, dia: "2026-10-10" }),
      entrada({ id: 5, dia: "2026-10-11" }),
      entrada({ id: 6, dia: "2026-10-12" }),
      entrada({ id: 7, dia: "2026-11-02" }),
    ];
    const gastos = [
      gasto({ valor: 4, inicio: "2026-01" }),
      gasto({ id: 2, valor: 6, tipo: "ocasional", inicio: null, dia: "2026-12-05" }),
      gasto({ id: 3, valor: 50, pausas: [{ de: "2026-12", ate: null }] }),
    ];
    const p = previsaoAnual(dados({ entradas, gastos, assistentes: [] }), 2026, "2026-11");
    expect(p.receitaMedia).toBe(22);
    const out = p.meses.find((m) => m.mes === "2026-10")!;
    expect(out).toMatchObject({ estado: "real", receita: 33, gastos: 54 });
    expect(p.meses.find((m) => m.mes === "2026-11")).toMatchObject({ estado: "em_curso", receita: 11 });
    const dez = p.meses.find((m) => m.mes === "2026-12")!;
    // O suspenso a partir de dezembro já não conta; o ocasional com data, sim.
    expect(dez).toMatchObject({ estado: "previsto", receita: 22, gastos: 10, lucro: 12 });
    expect(p.previsto.lucro).toBe(12);
    expect(p.total.receita).toBe(p.real.receita + p.previsto.receita);
  });

  it("num ano que já passou, tudo é real", () => {
    const p = previsaoAnual(dados(), 2025, "2026-11");
    expect(p.meses.every((m) => m.estado === "real")).toBe(true);
  });
});

describe("a parte da sócia", () => {
  const P: PeriodoDaSocia[] = [
    { nome: "Sócia inventada", percentagem: 40, inicio: "2026-10-16", fim: "2026-10-31", rotulo: "16–31 out", estado: "pago", lucro: 100, comissao: 40, pendentes: 0 },
    { nome: "Sócia inventada", percentagem: 40, inicio: "2026-11-01", fim: "2026-11-15", rotulo: "1–15 nov", estado: "em_curso", lucro: 50, comissao: 20, pendentes: 1 },
  ];
  it("os períodos que fecham no mês", () => {
    expect(parteDaSociaNoMes(P, "2026-10")).toMatchObject({ ha: true, lucro: 100, comissao: 40, pago: 40 });
    expect(parteDaSociaNoMes(P, "2026-11")).toMatchObject({ ha: true, emCurso: 20, pendentes: 1 });
  });
  it("sem o dado, diz porquê", () => {
    expect(parteDaSociaNoMes(null, "2026-10")).toEqual({ ha: false, porque: "sem_acesso" });
    expect(parteDaSociaNoMes([], "2026-10")).toEqual({ ha: false, porque: "sem_socia" });
    expect(parteDaSociaNoMes(P, "2026-09")).toEqual({ ha: false, porque: "sem_periodo" });
  });
});

describe("quem mexe nos gastos", () => {
  it("quem tem a secção das Finanças cria, muda e suspende", () => {
    for (const metodo of ["POST", "PATCH"]) {
      expect(assistenteComSeccoesPodeChamar(["carteiras"], "/api/admin/financas/gastos", metodo)).toBe(true);
    }
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], "/api/admin/financas/gastos", "POST")).toBe(false);
  });
  it("eliminar é só do administrador", () => {
    expect(assistentePodeChamar("/api/admin/financas/gastos", "DELETE")).toBe(false);
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/financas/gastos/route.ts"), "utf8");
    expect(ROTA.slice(ROTA.indexOf("export async function DELETE"))).toContain("await requireAdminGeral(req)");
  });
  it("a tabela nasce vazia: nenhum gasto se escreve por código", () => {
    const BASE = readFileSync(join(process.cwd(), "src/lib/financas-gastos-na-base.ts"), "utf8");
    expect(BASE.match(/INSERT INTO financasGastos/g)).toHaveLength(1);
    expect(BASE).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?)");
  });
  it("as contas dos assistentes só vão ao administrador", () => {
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/financas/route.ts"), "utf8");
    expect(ROTA).toContain('const eAdmin = colab?.papel === "admin";');
    expect(ROTA).toContain("eAdmin ? pagamentosAosAssistentes() : Promise.resolve(null)");
    expect(ROTA).toContain("eAdmin ? periodosDaSocia() : Promise.resolve(null)");
  });
});

describe("a página, desenhada", () => {
  it("os cartões, por onde entrou, o balanço e a previsão — real e previsão separados", () => {
    const html = renderToStaticMarkup(
      createElement(ResumoDasFinancas, {
        dados: { ...dados({ entradas: [entrada({ dia: "2026-11-02" })] }), socia: [], eAdmin: true, semEntradas: false },
        mes: "2026-11",
        hoje: "2026-11-10",
        onVerGastos: () => {},
      }),
    ).replace(/<!-- -->/g, "");
    for (const t of ["Bruto", "IVA", "Pago aos profissionais", "Receita da CLYON", "Gastos", "Pago aos assistentes", "Lucro líquido", "A parte da sócia"]) {
      expect(html).toContain(t);
    }
    expect(html).toContain("Quanto entrou e por onde");
    expect(html).toContain("Pagos em mão ao profissional");
    expect(html).toContain("Balanço do mês");
    expect(html).toContain("Previsão de 2026");
    expect(html).toContain("Real até agora");
    expect(html).toContain("Previsão do resto do ano");
    expect(html).toContain("nenhuma conta de assistente ganha sobre todos os trabalhos");
  });

  it("a lista dos gastos começa vazia e diz como criar", () => {
    const html = renderToStaticMarkup(
      createElement(GastosDaClyon, {
        gastos: [],
        categorias: CATEGORIAS,
        mes: "2026-11",
        hoje: "2026-11-10",
        token: null,
        podeEliminar: true,
        onMudou: () => {},
      }),
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("Ainda não há gastos");
    expect(html).toContain("Novo gasto");
  });
});
