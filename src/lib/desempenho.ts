/**
 * O DESEMPENHO — d41, 15-11-2026. A conta, pura, sem base.
 *
 * O Início ganha uma secção «Desempenho»: quantos pedidos entram e quantos
 * trabalhos se fazem, por dia, por mês e no ano, cada número ao lado do
 * período anterior; a conversão mês a mês; e três gráficos. Tudo sai daqui —
 * a rota lê as linhas da base (`desempenho-na-base.ts`) e chama
 * `desempenhoDe`; os testes chamam o mesmo com linhas feitas à mão.
 *
 * AS REGRAS (da ordem aprovada):
 *  - ENTRADOS contam-se pelo dia em que o pedido nasceu; REALIZADOS pelo dia
 *    em que o trabalho foi feito (`feitoEm` da d36 quando existe, senão a
 *    conclusão de sempre — a mesma regra das comissões, `diaQueConta`).
 *  - Contas de teste fora de tudo (`deTeste`).
 *  - Cancelados e arquivados nunca são realizados; contam-se à parte, numa
 *    linha própria, pelo dia em que o pedido entrou.
 *  - Dias, meses, dias da semana e horas: sempre em Lisboa.
 *  - Uma comparação só se faz quando há dados que cheguem ao período
 *    anterior inteiro; senão diz «sem dados para comparar» (`variacao: null`).
 *
 * Não há euros aqui, de propósito: são contagens. Se um dia entrarem, nunca
 * sem IVA sozinhos.
 */
import { diaEmLisboa, pecasEmLisboa, somarDiasAoDia } from "@/lib/hora-de-lisboa";
import { GRUPOS_DE_SERVICOS, grupoDoServico } from "@/lib/service-categories";

/** Um pedido, já lido da base e decidido (teste, cancelado, feito). */
export type LinhaDoDesempenho = {
  id: number;
  /** Quando o pedido nasceu; `null` num pedido apagado sem a data guardada (só conta nos realizados). */
  criadoEm: Date | null;
  /** O serviço do pedido (`recolha_monos`, `mudanca`…). */
  servico: string | null;
  /** Quando o trabalho foi feito — só num pedido concluído. */
  realizadoEm: Date | null;
  /** Cancelado ou arquivado (e não feito). */
  cancelado: boolean;
  deTeste: boolean;
};

/** O filtro por serviço: «todos» ou um dos quatro grupos (a fonte única dos nomes). */
export const FILTROS_DO_DESEMPENHO: ReadonlyArray<{ id: string; label: string }> = [
  { id: "todos", label: "Todos os serviços" },
  ...GRUPOS_DE_SERVICOS.map((g) => ({ id: g.id, label: g.label })),
];

export function filtroValido(v: string | null | undefined): string {
  return FILTROS_DO_DESEMPENHO.some((f) => f.id === v) ? (v as string) : "todos";
}

export function linhasDoFiltro(linhas: readonly LinhaDoDesempenho[], filtro: string): LinhaDoDesempenho[] {
  const f = filtroValido(filtro);
  return linhas.filter((l) => !l.deTeste && (f === "todos" || grupoDoServico(l.servico) === f));
}

/** Um número e o do período anterior. `variacao` em %; `null` = sem dados para comparar. */
export type Comparacao = {
  valor: number;
  anterior: number | null;
  variacao: number | null;
};

export function comparar(valor: number, anterior: number | null): Comparacao {
  if (anterior == null || anterior <= 0) return { valor, anterior, variacao: null };
  return { valor, anterior, variacao: ((valor - anterior) / anterior) * 100 };
}

export type MesDoDesempenho = {
  /** `YYYY-MM`. */
  mes: string;
  entrados: number;
  realizados: number;
  cancelados: number;
  /** Realizados ÷ entrados DESTE mês de entrada (coorte), em %; `null` sem entrados. */
  conversao: number | null;
  /** Os realizados que vieram dos pedidos entrados neste mês (o numerador da conversão). */
  realizadosDaCoorte: number;
  /** O mês corrente ainda não acabou. */
  emCurso: boolean;
};

export type BlocoDoDesempenho = {
  mediaPorDia: Comparacao;
  mediaPorMes: Comparacao;
  /** O último mês completo contra o mesmo mês do ano anterior. */
  mesHomologo: Comparacao & { mes: string; mesAnterior: string };
  /** Do 1.º de Janeiro até hoje, contra o mesmo período do ano anterior. */
  anoAteHoje: Comparacao;
  /** O total do ano se o ritmo dos últimos 90 dias se mantiver, contra o total do ano anterior. */
  previsaoDoAno: Comparacao;
  /** O ritmo dos últimos 90 dias, por dia. */
  ritmo90: number;
  /** Quantos dos 12 meses completos têm dados (a média por mês divide por estes). */
  mesesNaMedia: number;
};

export type Desempenho = {
  filtro: string;
  hoje: string;
  ano: number;
  /** O primeiro dia com dados (já sem contas de teste). */
  inicioDosDados: string | null;
  entrados: BlocoDoDesempenho;
  realizados: BlocoDoDesempenho;
  /** A linha «cancelados» (cancelados e arquivados, pelo dia de entrada). */
  cancelados: { ultimos30: number; ultimos12Meses: number; anoAteHoje: number };
  /** Os 12 meses completos e o corrente, do mais antigo para o mais recente. */
  meses: MesDoDesempenho[];
  /** Melhor e pior dos 12 meses completos (só os que têm dados do princípio ao fim). */
  extremos: {
    entrados: { melhor: string; pior: string } | null;
    realizados: { melhor: string; pior: string } | null;
  };
  /** A conversão dos 12 meses completos (coorte), contra a dos 12 anteriores. */
  conversao12Meses: Comparacao;
  /** Os últimos 90 dias, um a um. */
  dias: Array<{ dia: string; entrados: number; realizados: number }>;
  /** Pedidos entrados nos últimos 12 meses por dia da semana (0 = segunda) e hora (0–23), em Lisboa. */
  mapa: number[][];
  totalNoMapa: number;
};

/** `YYYY-MM` de um dia `YYYY-MM-DD`. */
const mesDe = (dia: string) => dia.slice(0, 7);

/** `YYYY-MM` mais `n` meses. */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Quantos dias tem o período `[de, ate]` (dias `YYYY-MM-DD`, inclusive). */
function diasEntre(de: string, ate: string): number {
  const ms = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) -
    Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10));
  return Math.round(ms / 86_400_000) + 1;
}

/** O mesmo dia um ano antes (29/02 → 28/02). */
function umAnoAntes(dia: string): string {
  const a = Number(dia.slice(0, 4)) - 1;
  const md = dia.slice(5);
  if (md === "02-29") return `${a}-02-28`;
  return `${a}-${md}`;
}

/** Contagens por dia de Lisboa. */
function porDia(datas: readonly Date[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of datas) {
    const k = diaEmLisboa(d);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Soma do mapa entre dois dias (inclusive). */
function somaEntre(m: Map<string, number>, de: string, ate: string): number {
  let s = 0;
  for (const [k, v] of m) if (k >= de && k <= ate) s += v;
  return s;
}

/** O período anterior só se compara quando os dados chegam ao início dele. */
const cobre = (inicioDosDados: string | null, desde: string) => inicioDosDados != null && inicioDosDados <= desde;

function bloco(m: Map<string, number>, hoje: string, inicioDosDados: string | null): BlocoDoDesempenho {
  // Os últimos 30 dias, com hoje; e os 30 antes desses.
  const d30 = somarDiasAoDia(hoje, -29);
  const p30de = somarDiasAoDia(hoje, -59);
  const p30ate = somarDiasAoDia(hoje, -30);
  const mediaPorDia = comparar(
    somaEntre(m, d30, hoje) / 30,
    cobre(inicioDosDados, p30de) ? somaEntre(m, p30de, p30ate) / 30 : null,
  );

  // Os 12 meses completos, e os 12 antes desses.
  const mesActual = mesDe(hoje);
  const m12de = `${somarMeses(mesActual, -12)}-01`;
  const m12ate = somarDiasAoDia(`${mesActual}-01`, -1);
  const p12de = `${somarMeses(mesActual, -24)}-01`;
  const p12ate = somarDiasAoDia(m12de, -1);
  /*
   * A MÉDIA POR MÊS DIVIDE PELOS MESES COM DADOS. Os pedidos de antes do
   * registo permanente (Junho de 2026) não existem em lado nenhum; dividir
   * por 12 com sete meses vazios dava uma média que nunca aconteceu. Conta
   * cada mês completo que começa no início dos dados ou depois.
   */
  let mesesNaMedia = 0;
  for (let i = -12; i <= -1; i++) if (cobre(inicioDosDados, `${somarMeses(mesActual, i)}-01`)) mesesNaMedia += 1;
  const mediaPorMes = comparar(
    mesesNaMedia > 0 ? somaEntre(m, `${somarMeses(mesActual, -mesesNaMedia)}-01`, m12ate) / mesesNaMedia : 0,
    cobre(inicioDosDados, p12de) ? somaEntre(m, p12de, p12ate) / 12 : null,
  );

  // O último mês completo contra o mesmo mês do ano anterior.
  const ultimo = somarMeses(mesActual, -1);
  const homologo = somarMeses(ultimo, -12);
  const fimDe = (mes: string) => somarDiasAoDia(`${somarMeses(mes, 1)}-01`, -1);
  const mesHomologo = {
    ...comparar(
      somaEntre(m, `${ultimo}-01`, fimDe(ultimo)),
      cobre(inicioDosDados, `${homologo}-01`) ? somaEntre(m, `${homologo}-01`, fimDe(homologo)) : null,
    ),
    mes: ultimo,
    mesAnterior: homologo,
  };

  // O ano: até hoje, e a previsão pelo ritmo dos últimos 90 dias.
  const ano = hoje.slice(0, 4);
  const inicioDoAno = `${ano}-01-01`;
  const anoPassado = String(Number(ano) - 1);
  const ytd = somaEntre(m, inicioDoAno, hoje);
  const anoAteHoje = comparar(
    ytd,
    cobre(inicioDosDados, `${anoPassado}-01-01`) ? somaEntre(m, `${anoPassado}-01-01`, umAnoAntes(hoje)) : null,
  );
  const ritmo90 = somaEntre(m, somarDiasAoDia(hoje, -89), hoje) / 90;
  const diasQueFaltam = diasEntre(hoje, `${ano}-12-31`) - 1;
  const previsaoDoAno = comparar(
    Math.round(ytd + ritmo90 * diasQueFaltam),
    cobre(inicioDosDados, `${anoPassado}-01-01`)
      ? somaEntre(m, `${anoPassado}-01-01`, `${anoPassado}-12-31`)
      : null,
  );

  return { mediaPorDia, mediaPorMes, mesHomologo, anoAteHoje, previsaoDoAno, ritmo90, mesesNaMedia };
}

/** O mês com mais e o com menos (o mais recente ganha um empate); `null` se forem todos zero. */
function extremosDe(meses: readonly MesDoDesempenho[], campo: "entrados" | "realizados") {
  if (meses.length === 0 || meses.every((x) => x[campo] === 0)) return null;
  let melhor = meses[0];
  let pior = meses[0];
  for (const x of meses) {
    if (x[campo] >= melhor[campo]) melhor = x;
    if (x[campo] <= pior[campo]) pior = x;
  }
  return { melhor: melhor.mes, pior: pior.mes };
}

/**
 * A CONTA INTEIRA, para um filtro. `linhas` são TODAS as lidas (com as de
 * teste — saem aqui); o início dos dados mede-se antes do filtro por serviço,
 * porque é a história da base e não a de um serviço.
 */
export function desempenhoDe(
  linhas: readonly LinhaDoDesempenho[],
  opcoes: { filtro?: string; agora?: Date } = {},
): Desempenho {
  const agora = opcoes.agora ?? new Date();
  const filtro = filtroValido(opcoes.filtro);
  const hoje = diaEmLisboa(agora);
  const mesActual = mesDe(hoje);

  let inicioDosDados: string | null = null;
  for (const l of linhas) {
    if (l.deTeste || !l.criadoEm) continue;
    const d = diaEmLisboa(l.criadoEm);
    if (inicioDosDados == null || d < inicioDosDados) inicioDosDados = d;
  }

  const minhas = linhasDoFiltro(linhas, filtro);
  const entradas = minhas.filter((l) => l.criadoEm).map((l) => l.criadoEm as Date);
  const feitos = minhas.filter((l) => l.realizadoEm && !l.cancelado).map((l) => l.realizadoEm as Date);
  const mEntrados = porDia(entradas);
  const mRealizados = porDia(feitos);
  const mCancelados = porDia(minhas.filter((l) => l.cancelado && l.criadoEm).map((l) => l.criadoEm as Date));

  // Mês a mês: os 12 completos e o corrente.
  const meses: MesDoDesempenho[] = [];
  for (let i = -12; i <= 0; i++) {
    const mes = somarMeses(mesActual, i);
    const deDia = `${mes}-01`;
    const ateDia = somarDiasAoDia(`${somarMeses(mes, 1)}-01`, -1);
    const daCoorte = minhas.filter((l) => l.criadoEm && mesDe(diaEmLisboa(l.criadoEm)) === mes);
    const entrados = daCoorte.length;
    const realizadosDaCoorte = daCoorte.filter((l) => l.realizadoEm && !l.cancelado).length;
    meses.push({
      mes,
      entrados,
      realizados: somaEntre(mRealizados, deDia, ateDia),
      cancelados: daCoorte.filter((l) => l.cancelado).length,
      conversao: entrados > 0 ? (realizadosDaCoorte / entrados) * 100 : null,
      realizadosDaCoorte,
      emCurso: i === 0,
    });
  }
  // O melhor e o pior só entre os meses que têm dados do princípio ao fim.
  const completos = meses.filter((x) => !x.emCurso && cobre(inicioDosDados, `${x.mes}-01`));

  // A conversão dos 12 meses completos contra a dos 12 antes (coorte).
  const coorte = (de: string, ate: string) => {
    const c = minhas.filter((l) => {
      if (!l.criadoEm) return false;
      const mes = mesDe(diaEmLisboa(l.criadoEm));
      return mes >= de && mes <= ate;
    });
    const feitosDaCoorte = c.filter((l) => l.realizadoEm && !l.cancelado).length;
    return c.length > 0 ? (feitosDaCoorte / c.length) * 100 : null;
  };
  const conv12 = coorte(somarMeses(mesActual, -12), somarMeses(mesActual, -1)) ?? 0;
  const convAnt = cobre(inicioDosDados, `${somarMeses(mesActual, -24)}-01`)
    ? coorte(somarMeses(mesActual, -24), somarMeses(mesActual, -13))
    : null;

  // Os últimos 90 dias.
  const dias: Desempenho["dias"] = [];
  for (let i = -89; i <= 0; i++) {
    const dia = somarDiasAoDia(hoje, i);
    dias.push({ dia, entrados: mEntrados.get(dia) ?? 0, realizados: mRealizados.get(dia) ?? 0 });
  }

  // O mapa: dia da semana × hora, dos últimos 12 meses.
  const mapa = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const desdeMapa = somarDiasAoDia(hoje, -364);
  let totalNoMapa = 0;
  for (const d of entradas) {
    if (diaEmLisboa(d) < desdeMapa) continue;
    const p = pecasEmLisboa(d);
    mapa[(p.diaDaSemana + 6) % 7][p.hora] += 1;
    totalNoMapa += 1;
  }

  const d30 = somarDiasAoDia(hoje, -29);
  return {
    filtro,
    hoje,
    ano: Number(hoje.slice(0, 4)),
    inicioDosDados,
    entrados: bloco(mEntrados, hoje, inicioDosDados),
    realizados: bloco(mRealizados, hoje, inicioDosDados),
    cancelados: {
      ultimos30: somaEntre(mCancelados, d30, hoje),
      ultimos12Meses: somaEntre(mCancelados, `${somarMeses(mesActual, -12)}-01`, somarDiasAoDia(`${mesActual}-01`, -1)),
      anoAteHoje: somaEntre(mCancelados, `${hoje.slice(0, 4)}-01-01`, hoje),
    },
    meses,
    extremos: { entrados: extremosDe(completos, "entrados"), realizados: extremosDe(completos, "realizados") },
    conversao12Meses: comparar(conv12, convAnt),
    dias,
    mapa,
    totalNoMapa,
  };
}

/* ── Para o ecrã ─────────────────────────────────────────────────────────── */

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `2026-10` → «out 26». */
export function rotuloDoMes(mes: string): string {
  return `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;
}

/** «▲ +12 %», «▼ −8 %», «= 0 %» ou «sem dados para comparar». */
export function fraseDaVariacao(v: number | null): string {
  if (v == null) return "sem dados para comparar";
  const r = Math.round(v);
  if (r === 0) return "= 0 %";
  return r > 0 ? `▲ +${r} %` : `▼ −${Math.abs(r)} %`;
}

/** Número com uma casa decimal à portuguesa (`2,3`), ou inteiro quando é inteiro. */
export function numeroCurto(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

/** Os pedidos de hoje, da semana e do mês, para a «Operação» do Início (d56). */
export type OperacaoDoInicio = {
  entradosHoje: number;
  entradosSemana: number;
  entradosMes: number;
  /** Cancelados ou arquivados dos pedidos que entraram este mês. */
  canceladosDoMes: number;
};

/**
 * A OPERAÇÃO DO INÍCIO — d56, 17-11-2026. Todos os serviços, sem contas de
 * teste, pelo dia em Lisboa em que o pedido entrou; a semana começa à
 * segunda-feira.
 */
export function operacaoDoInicio(linhas: readonly LinhaDoDesempenho[], agora: Date = new Date()): OperacaoDoInicio {
  const hoje = diaEmLisboa(agora);
  const recuar = (pecasEmLisboa(agora).diaDaSemana + 6) % 7;
  const segunda = somarDiasAoDia(hoje, -recuar);
  const mes = hoje.slice(0, 7);
  const r: OperacaoDoInicio = { entradosHoje: 0, entradosSemana: 0, entradosMes: 0, canceladosDoMes: 0 };
  for (const l of linhas) {
    if (l.deTeste || !l.criadoEm) continue;
    const d = diaEmLisboa(l.criadoEm);
    if (d > hoje) continue;
    if (d === hoje) r.entradosHoje += 1;
    if (d >= segunda) r.entradosSemana += 1;
    if (d.slice(0, 7) === mes) {
      r.entradosMes += 1;
      if (l.cancelado) r.canceladosDoMes += 1;
    }
  }
  return r;
}
