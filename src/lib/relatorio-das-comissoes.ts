/**
 * O RELATÓRIO GERAL DAS COMISSÕES — 17-10-2026.
 *
 * *«Quero que aqui seja possível ver e gerir os lucros dela, não só passados
 * mas futuros… o histórico de cada 15 dias e relatórios gerais.»* — o dono,
 * que escolheu tudo: todas as quinzenas com totais, os totais por mês, a
 * divisão por operador e o CSV.
 *
 * Não faz contas novas: junta as que já existem. Cada período traz a comissão
 * que o servidor calculou (num pago, a que se pagou); a previsão traz a de
 * `previsaoPorPeriodo`. Por mês somam-se PERÍODOS, e não trabalhos — é o
 * período que se paga, e o relatório tem de bater com o que se pagou. O
 * primeiro (23/09–15/10) conta no mês em que fecha.
 *
 * Puro — sem base, sem relógio —, para se testar.
 */

export type EstadoNoRelatorio = "previsto" | "em_curso" | "por_pagar" | "pago";

export type PeriodoParaRelatorio = {
  inicio: string;
  fim: string;
  rotulo: string;
  estado: "em_curso" | "por_pagar" | "pago";
  trabalhos: number;
  lucro: number;
  comissaoAssistente: number;
  pago: { pagoEm: string | null } | null;
  detalhe: Array<{ operador?: string; lucro: number; comissaoAssistente: number; conta?: boolean }>;
};

export type PrevisaoParaRelatorio = {
  inicio: string;
  fim: string;
  rotulo: string;
  trabalhos: number;
  lucro: number;
  comissaoAssistente: number;
};

export type LinhaDoRelatorio = {
  inicio: string;
  fim: string;
  rotulo: string;
  estado: EstadoNoRelatorio;
  trabalhos: number;
  lucro: number;
  comissao: number;
  previstoTrabalhos: number;
  previstoLucro: number;
  previstoComissao: number;
  pagoEm: string | null;
};

export type Relatorio = {
  linhas: LinhaDoRelatorio[];
  totais: {
    trabalhos: number;
    lucro: number;
    /** Tudo o que já conta: em curso + por pagar + pago. */
    ganho: number;
    pago: number;
    porPagar: number;
    emCurso: number;
    previsto: number;
  };
  porMes: Array<{ mes: string; rotulo: string; trabalhos: number; lucro: number; comissao: number; previsto: number }>;
  porOperador: Array<{ operador: string; trabalhos: number; lucro: number; comissao: number }>;
};

const centimos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** «2026-10» → «outubro de 2026». */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

export function relatorioDasComissoes(
  periodos: PeriodoParaRelatorio[],
  previsao: PrevisaoParaRelatorio[],
): Relatorio {
  const previstoDe = new Map(previsao.map((p) => [p.inicio, p]));
  const comPeriodo = new Set(periodos.map((p) => p.inicio));

  const futuras: LinhaDoRelatorio[] = previsao
    .filter((p) => !comPeriodo.has(p.inicio))
    .map((p) => ({
      inicio: p.inicio,
      fim: p.fim,
      rotulo: p.rotulo,
      estado: "previsto",
      trabalhos: 0,
      lucro: 0,
      comissao: 0,
      previstoTrabalhos: p.trabalhos,
      previstoLucro: p.lucro,
      previstoComissao: p.comissaoAssistente,
      pagoEm: null,
    }));

  const reais: LinhaDoRelatorio[] = periodos.map((p) => {
    const prev = previstoDe.get(p.inicio);
    return {
      inicio: p.inicio,
      fim: p.fim,
      rotulo: p.rotulo,
      estado: p.estado,
      trabalhos: p.trabalhos,
      lucro: p.lucro,
      comissao: p.comissaoAssistente,
      previstoTrabalhos: prev?.trabalhos ?? 0,
      previstoLucro: prev?.lucro ?? 0,
      previstoComissao: prev?.comissaoAssistente ?? 0,
      pagoEm: p.pago?.pagoEm ?? null,
    };
  });

  // Do mais longe no futuro para o primeiro período — a ordem do ecrã.
  const linhas = [...futuras, ...reais].sort((a, b) => b.inicio.localeCompare(a.inicio));

  const somar = (f: (l: LinhaDoRelatorio) => number, filtro: (l: LinhaDoRelatorio) => boolean = () => true) =>
    centimos(linhas.filter(filtro).reduce((s, l) => s + f(l), 0));
  const pago = somar((l) => l.comissao, (l) => l.estado === "pago");
  const porPagar = somar((l) => l.comissao, (l) => l.estado === "por_pagar");
  const emCurso = somar((l) => l.comissao, (l) => l.estado === "em_curso");

  const meses = new Map<string, Relatorio["porMes"][number]>();
  for (const l of linhas) {
    const mes = l.fim.slice(0, 7);
    const m = meses.get(mes) ?? { mes, rotulo: mesPorExtenso(mes), trabalhos: 0, lucro: 0, comissao: 0, previsto: 0 };
    m.trabalhos += l.trabalhos;
    m.lucro = centimos(m.lucro + l.lucro);
    m.comissao = centimos(m.comissao + l.comissao);
    m.previsto = centimos(m.previsto + l.previstoComissao);
    meses.set(mes, m);
  }

  const operadores = new Map<string, Relatorio["porOperador"][number]>();
  for (const p of periodos) {
    for (const t of p.detalhe) {
      if (t.conta === false) continue;
      const nome = t.operador ?? "Admin";
      const o = operadores.get(nome) ?? { operador: nome, trabalhos: 0, lucro: 0, comissao: 0 };
      o.trabalhos += 1;
      o.lucro = centimos(o.lucro + t.lucro);
      o.comissao = centimos(o.comissao + t.comissaoAssistente);
      operadores.set(nome, o);
    }
  }

  return {
    linhas,
    totais: {
      trabalhos: linhas.reduce((s, l) => s + l.trabalhos, 0),
      lucro: somar((l) => l.lucro),
      ganho: centimos(pago + porPagar + emCurso),
      pago,
      porPagar,
      emCurso,
      previsto: somar((l) => l.previstoComissao),
    },
    porMes: [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes)),
    porOperador: [...operadores.values()].sort((a, b) => b.lucro - a.lucro || a.operador.localeCompare(b.operador)),
  };
}

export const ROTULO_DO_ESTADO_NO_RELATORIO: Record<EstadoNoRelatorio, string> = {
  previsto: "previsto",
  em_curso: "em curso",
  por_pagar: "por pagar",
  pago: "pago",
};

/** O relatório inteiro num CSV — `;` e BOM, como o extracto de cada período. */
export function relatorioEmCsv(nome: string, comissaoPercent: number, r: Relatorio): string {
  const aspas = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) : "");
  const linhas: unknown[][] = [
    [`Relatório de comissões — ${nome} (${comissaoPercent} % do lucro da CLYON)`],
    [],
    ["Período", "Estado", "Trabalhos", "Lucro CLYON", `Comissão ${nome}`, "Previsto: trabalhos", "Previsto: lucro", "Previsto: comissão", "Pago em"],
    ...r.linhas.map((l) => [
      l.rotulo,
      ROTULO_DO_ESTADO_NO_RELATORIO[l.estado],
      l.trabalhos,
      num(l.lucro),
      num(l.comissao),
      l.previstoTrabalhos,
      num(l.previstoLucro),
      num(l.previstoComissao),
      dia(l.pagoEm),
    ]),
    ["TOTAL", "", r.totais.trabalhos, num(r.totais.lucro), num(r.totais.ganho), "", "", num(r.totais.previsto), ""],
    [],
    ["Pago", num(r.totais.pago)],
    ["Por pagar", num(r.totais.porPagar)],
    ["Em curso", num(r.totais.emCurso)],
    ["Previsto", num(r.totais.previsto)],
    [],
    ["Por mês (cada período conta no mês em que fecha)"],
    ["Mês", "Trabalhos", "Lucro CLYON", `Comissão ${nome}`, "Previsto"],
    ...r.porMes.map((m) => [m.rotulo, m.trabalhos, num(m.lucro), num(m.comissao), num(m.previsto)]),
    [],
    ["Por operador (trabalhos que já contam)"],
    ["Operador", "Trabalhos", "Lucro CLYON", `Comissão ${nome}`],
    ...r.porOperador.map((o) => [o.operador, o.trabalhos, num(o.lucro), num(o.comissao)]),
  ];
  return "﻿" + linhas.map((l) => l.map(aspas).join(";")).join("\r\n");
}
