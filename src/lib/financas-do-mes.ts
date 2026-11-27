import { classificarPagamento, type NaturezaDoPagamento } from "./a-quem-foi-o-dinheiro";
import type { ContaDoPagamento } from "./conta-do-pagamento";
import { aosCentimos, contaParaOSaldo, mesDoDia, somarMeses, type Categoria, type Movimento } from "./financas";
import { gastosDoMes, gastosNoIntervalo, type Gasto } from "./financas-gastos";
import { eLinhaDaDividaEmMao } from "./pago-em-mao";

/**
 * AS CONTAS DO MÊS DA CLYON — 07-11-2026 (d21, dono).
 *
 * *«Quero que ela mostre os lucros e os valores bruto, líquidos, quanto
 * entrou, por onde […] os valores pagos aos assistentes, o balanço do mês e a
 * previsão anual.»*
 *
 * Não inventa dinheiro: lê o que a plataforma já guarda (os pagamentos, com a
 * conta em degraus de cada trabalho — `conta-do-pagamento.ts`), o que se
 * lançou à mão nas Transações, os gastos (`financas-gastos.ts`) e as
 * comissões pagas aos assistentes. A quem foi cada pagamento é a regra de
 * `a-quem-foi-o-dinheiro.ts`: o pago em mão ao profissional nunca entra.
 * As contas de teste e os pagamentos de teste ficam sempre de fora (quem
 * chama já os tira).
 *
 *   bruto   = tudo o que entrou na CLYON, com IVA = IVA + receita + parte dos profissionais
 *   receita = as taxas da plataforma, sem IVA (+ o que se lançou à mão como receita)
 *   gastos  = recorrentes + ocasionais + despesas lançadas à mão + comissões do euPago
 *   lucro   = receita − gastos − assistentes
 *
 * Puro — sem base nem relógio —, para se testar.
 */

/** Um pagamento dado por pago, já dividido nas três partes. */
export type EntradaDaPlataforma = {
  id: number;
  pedidoId: number;
  /** O dia em Lisboa em que foi pago. */
  dia: string;
  metodo: string;
  /** O que se pagou (com IVA, quando o houve). */
  valor: number;
  natureza: NaturezaDoPagamento;
  entraNaClyon: boolean;
  /** O profissional a pagar à CLYON a parte dela de um trabalho que o cliente lhe pagou em mão. */
  daParteDaClyon: boolean;
  iva: number;
  /** As taxas da plataforma, sem IVA. */
  receita: number;
  /** A parte do profissional que entrou com este pagamento (a CLYON paga-lha depois). */
  profissional: number;
  /** Sem a conta do trabalho não se separa o IVA da taxa: entra no bruto, e fica dito. */
  semConta: boolean;
  comissaoEupago: number;
};

/** O que é preciso de uma linha de `pagamentos` para a dividir. */
export type LinhaParaDividir = {
  id: number;
  pedidoId: number;
  dia: string;
  metodo: string;
  valor: number;
  formaDoTrabalho: string | null;
  trid: string | null;
  parte: string | null;
  comissaoEupago: number | null;
  conta: Pick<ContaDoPagamento, "total" | "iva" | "clyon" | "profissional"> | null;
  /**
   * O MODELO DE 15-11-2026 — d3 (CEO e dono, 19-11-2026). Num trabalho do modelo
   * novo o cliente paga ao parceiro, e o que entra na CLYON é só a fatura da taxa
   * que o parceiro lhe passa: a taxa e o IVA DELA (`taxaAPassarAClyon`, a mesma
   * conta da carteira e da referência). Nunca uma parte do IVA do trabalho, que é
   * do parceiro. Ausente (ou nulo) nos trabalhos do modelo antigo.
   */
  passagemDoNovoModelo?: { iva: number; comissao: number } | null;
};

/**
 * UM PAGAMENTO EM TRÊS PARTES — IVA, taxa da plataforma, parte do profissional
 * —, na proporção da conta do trabalho. Assim um pagamento parcial, ou a
 * diferença das horas, divide-se como o trabalho; e as três partes dão sempre
 * o valor ao cêntimo (a receita é o que sobra).
 */
export function dividirEntrada(l: LinhaParaDividir): EntradaDaPlataforma {
  const { natureza, entraNaClyon } = classificarPagamento(l.metodo);
  const valor = aosCentimos(l.valor);
  const passagem = l.passagemDoNovoModelo ?? null;
  const daParteDaClyon =
    entraNaClyon &&
    (passagem != null ||
      l.formaDoTrabalho === "dinheiro" ||
      l.metodo.startsWith("pro_") ||
      eLinhaDaDividaEmMao(l.trid) ||
      l.parte === "divida");
  const base = {
    id: l.id,
    pedidoId: l.pedidoId,
    dia: l.dia,
    metodo: l.metodo,
    valor,
    natureza,
    entraNaClyon,
    daParteDaClyon,
    comissaoEupago: aosCentimos(l.comissaoEupago ?? 0),
  };
  const nada = { iva: 0, receita: 0, profissional: 0 };
  if (!entraNaClyon) return { ...base, ...nada, semConta: false };
  const c = l.conta;
  if (daParteDaClyon && passagem) {
    // A fatura da taxa: o IVA é o da taxa, na proporção da fatura (um pagamento parcial divide-se igual).
    const fatura = passagem.iva + passagem.comissao;
    if (!(fatura > 0)) return { ...base, ...nada, semConta: true };
    const iva = aosCentimos((valor * passagem.iva) / fatura);
    return { ...base, iva, receita: aosCentimos(valor - iva), profissional: 0, semConta: false };
  }
  if (daParteDaClyon) {
    const parte = c ? c.iva + c.clyon : 0;
    if (!c || !(parte > 0)) return { ...base, ...nada, semConta: true };
    const iva = aosCentimos((valor * c.iva) / parte);
    return { ...base, iva, receita: aosCentimos(valor - iva), profissional: 0, semConta: false };
  }
  if (!c || !(c.total > 0)) return { ...base, ...nada, semConta: true };
  const iva = aosCentimos((valor * c.iva) / c.total);
  const profissional = aosCentimos((valor * c.profissional) / c.total);
  return { ...base, iva, profissional, receita: aosCentimos(valor - iva - profissional), semConta: false };
}

/** Uma comissão paga a um assistente (um período marcado como pago). */
export type PagamentoAAssistente = { dia: string; valor: number; nome: string; periodo: string; assistenteId?: number | null };

/** Um período de comissão de uma conta que ganha sobre todos os trabalhos (a sócia). */
export type PeriodoDaSocia = {
  nome: string;
  /** A conta da sócia (para tirar os pagamentos dela dos assistentes no Início, d56). */
  assistenteId?: number | null;
  percentagem: number;
  inicio: string;
  fim: string;
  rotulo: string;
  estado: "em_curso" | "por_pagar" | "pago";
  lucro: number;
  comissao: number;
  pendentes: number;
};

export type Canal = "mbway" | "multibanco" | "transferencia" | "numerario" | "outro";

const CANAL: Record<string, Canal> = {
  mbway: "mbway",
  pro_mbway: "mbway",
  multibanco: "multibanco",
  transferencia: "transferencia",
  pro_transferencia: "transferencia",
  numerario: "numerario",
  pro_numerario: "numerario",
};
export const canalDoMetodo = (m: string): Canal => CANAL[m] ?? "outro";
export const CANAIS: Canal[] = ["mbway", "multibanco", "transferencia", "numerario", "outro"];

type Soma = { n: number; valor: number };
const vazia = (): Soma => ({ n: 0, valor: 0 });
const juntar = (s: Soma, v: number) => {
  s.n += 1;
  s.valor = aosCentimos(s.valor + v);
};

export type DadosDasContas = {
  entradas: EntradaDaPlataforma[];
  /** Os movimentos da gestora: os da plataforma e os lançados à mão. */
  movimentos: Movimento[];
  categorias: Categoria[];
  gastos: Gasto[];
  /** `null` quando quem vê não é o administrador. */
  assistentes: PagamentoAAssistente[] | null;
};

export type ContasDoMes = {
  mes: string;
  bruto: number;
  iva: number;
  /** A parte dos profissionais que entrou com os pagamentos do mês. */
  parteDosProfissionais: number;
  /** O que saiu da CLYON para os profissionais neste mês (transferências e levantamentos). */
  pagoAosProfissionais: number;
  receita: { taxas: number; lancadas: number; total: number };
  gastos: { recorrentes: number; ocasionais: number; lancadas: number; eupago: number; total: number; linhas: Gasto[] };
  assistentes: number | null;
  lucro: number;
  porOnde: Record<Canal, Soma>;
  /** Do bruto: o que os profissionais pagaram à CLYON (a parte dela de trabalhos pagos em mão). */
  pagoPelosProfissionais: Soma;
  naoEntrou: { emMao: Soma; acertos: Soma };
  semConta: Soma;
  entradas: EntradaDaPlataforma[];
  pagamentosAosAssistentes: PagamentoAAssistente[];
};

/**
 * O NÚCLEO DAS CONTAS — as entradas e os movimentos que caem nos dias de
 * `dentro`. É o mesmo para o mês das Finanças e para o intervalo do Início
 * (d56): só muda a pergunta «este dia conta?» e a forma de contar os gastos.
 */
function entradasEMovimentos(d: DadosDasContas, dentro: (dia: string) => boolean) {
  const doPeriodo = d.entradas.filter((e) => dentro(e.dia));
  const porOnde = Object.fromEntries(CANAIS.map((c) => [c, vazia()])) as Record<Canal, Soma>;
  const pagoPelosProfissionais = vazia();
  const emMao = vazia();
  const acertos = vazia();
  const semConta = vazia();
  let bruto = 0;
  let iva = 0;
  let taxas = 0;
  let parteDosProfissionais = 0;
  let eupago = 0;
  for (const e of doPeriodo) {
    eupago += e.comissaoEupago;
    if (!e.entraNaClyon) {
      juntar(e.natureza === "em_mao" ? emMao : acertos, e.valor);
      continue;
    }
    bruto += e.valor;
    iva += e.iva;
    taxas += e.receita;
    parteDosProfissionais += e.profissional;
    juntar(porOnde[canalDoMetodo(e.metodo)], e.valor);
    if (e.daParteDaClyon) juntar(pagoPelosProfissionais, e.valor);
    if (e.semConta) juntar(semConta, e.valor);
  }

  const sistema = new Set(d.categorias.filter((c) => c.sistema).map((c) => c.id));
  let pagoAosProfissionais = 0;
  let despesasLancadas = 0;
  let receitasLancadas = 0;
  for (const m of d.movimentos) {
    if (!contaParaOSaldo(m) || !dentro(m.dia) || m.tipo === "transferencia") continue;
    if (m.automatico) {
      if (m.automatico.de === "pago_ao_profissional" || m.automatico.de === "levantamento") pagoAosProfissionais += m.valor;
      continue;
    }
    // O que se lançou à mão numa categoria da plataforma já vem sozinho: não conta duas vezes.
    if (m.categoriaId != null && sistema.has(m.categoriaId)) continue;
    if (m.tipo === "despesa") despesasLancadas += m.valor;
    else receitasLancadas += m.valor;
  }
  return {
    doPeriodo,
    porOnde,
    pagoPelosProfissionais,
    emMao,
    acertos,
    semConta,
    bruto,
    iva,
    taxas,
    parteDosProfissionais,
    eupago,
    pagoAosProfissionais,
    despesasLancadas,
    receitasLancadas,
  };
}

export function contasDoMes(d: DadosDasContas, mes: string): ContasDoMes {
  const n = entradasEMovimentos(d, (dia) => mesDoDia(dia) === mes);
  const { porOnde, pagoPelosProfissionais, emMao, acertos, semConta, bruto, iva, taxas, parteDosProfissionais, eupago } = n;
  const { pagoAosProfissionais, despesasLancadas, receitasLancadas } = n;
  const doMes = n.doPeriodo;

  const g = gastosDoMes(d.gastos, mes);
  const gastosTotal = aosCentimos(g.total + despesasLancadas + eupago);
  const receitaTotal = aosCentimos(taxas + receitasLancadas);
  const pagamentosAosAssistentes = (d.assistentes ?? []).filter((a) => mesDoDia(a.dia) === mes);
  const assistentes = d.assistentes ? aosCentimos(pagamentosAosAssistentes.reduce((s, a) => s + a.valor, 0)) : null;

  return {
    mes,
    bruto: aosCentimos(bruto),
    iva: aosCentimos(iva),
    parteDosProfissionais: aosCentimos(parteDosProfissionais),
    pagoAosProfissionais: aosCentimos(pagoAosProfissionais),
    receita: { taxas: aosCentimos(taxas), lancadas: aosCentimos(receitasLancadas), total: receitaTotal },
    gastos: {
      recorrentes: g.recorrentes,
      ocasionais: g.ocasionais,
      lancadas: aosCentimos(despesasLancadas),
      eupago: aosCentimos(eupago),
      total: gastosTotal,
      linhas: g.linhas,
    },
    assistentes,
    lucro: aosCentimos(receitaTotal - gastosTotal - (assistentes ?? 0)),
    porOnde,
    pagoPelosProfissionais,
    naoEntrou: { emMao, acertos },
    semConta,
    entradas: doMes,
    pagamentosAosAssistentes,
  };
}

// ─── O lucro de um intervalo de dias (d56, Início) ───────────────────────────

/** Quantos dias de calendário vão de `de` a `ate`, os dois contados (0 se `ate` vier antes). */
export function diasEntre(de: string, ate: string): number {
  const t = (x: string) => Date.parse(`${x}T00:00:00Z`);
  return Math.max(0, Math.round((t(ate) - t(de)) / 86_400_000) + 1);
}

/** É desta conta da sócia? Pelo id quando os dois o têm; senão pelo nome. */
function eDaSocia(a: PagamentoAAssistente, periodos: PeriodoDaSocia[]): boolean {
  return periodos.some((p) =>
    p.assistenteId != null && a.assistenteId != null ? p.assistenteId === a.assistenteId : p.nome === a.nome,
  );
}

/**
 * A PARTE DA SÓCIA NUM INTERVALO DE DIAS — d56, 17-11-2026.
 *
 * A comissão de cada período (a mesma de `parteDaSociaNoMes`) espalha-se
 * pelos dias dele: os dias todos, num período fechado; do início até hoje,
 * no período em curso (é o que já ganhou até hoje). Num mês feito de
 * períodos inteiros dá o mesmo que `parteDaSociaNoMes`.
 */
export function parteDaSociaNoIntervalo(periodos: PeriodoDaSocia[], de: string, ate: string, hoje: string): number {
  let s = 0;
  for (const p of periodos) {
    const fim = p.estado === "em_curso" && hoje < p.fim ? hoje : p.fim;
    const dias = diasEntre(p.inicio, fim);
    if (dias <= 0) continue;
    const sobre = diasEntre(p.inicio > de ? p.inicio : de, fim < ate ? fim : ate);
    if (sobre > 0) s += (p.comissao * sobre) / dias;
  }
  return aosCentimos(s);
}

export type LucroDoIntervalo = {
  de: string;
  ate: string;
  dias: number;
  receita: number;
  gastos: number;
  /** Os assistentes pagos no intervalo, SEM a sócia (essa conta-se à parte). `null` para quem não é o administrador. */
  assistentes: number | null;
  /** receita − gastos − assistentes: o lucro antes da parte da sócia. */
  lucro: number;
  /** `null` quando não se sabe (quem vê não é o administrador, ou não há sócia). */
  socia: number | null;
  lucroDepoisDaSocia: number | null;
  mediaPorDia: number;
  mediaPorDiaDepoisDaSocia: number | null;
};

export type OpcoesDoIntervalo = {
  /** O dia de hoje em Lisboa (para o período da sócia em curso). */
  hoje: string;
  /**
   * «por_dia» — um recorrente conta o valor do mês ÷ os dias desse mês, em
   * cada dia (hoje e a semana, sem o pico do dia da fatura); «mes_inteiro» —
   * conta o mês inteiro em cada mês que o intervalo toca (o mês e o ano, com
   * o mesmo número das Finanças).
   */
  recorrentes: "por_dia" | "mes_inteiro";
  socia: PeriodoDaSocia[] | null;
};

/**
 * O LUCRO DE UM INTERVALO DE DIAS — d56, 17-11-2026: a conta da d21
 * (receita = taxas sem IVA + receitas à mão; gastos = recorrentes +
 * ocasionais + despesas à mão + comissões do euPago; lucro = receita −
 * gastos − assistentes), pelo mesmo núcleo de `contasDoMes`, num intervalo
 * `de`–`ate` (dias de Lisboa, os dois contados). Os ocasionais contam no dia
 * deles. A sócia conta à parte: os pagamentos a ela não entram nos
 * assistentes, e o «depois da sócia» tira a parte dela do intervalo.
 */
export function lucroNoIntervalo(d: DadosDasContas, de: string, ate: string, o: OpcoesDoIntervalo): LucroDoIntervalo {
  const dentro = (dia: string) => dia >= de && dia <= ate;
  const n = entradasEMovimentos(d, dentro);
  const g = gastosNoIntervalo(d.gastos, de, ate, o.recorrentes);
  const gastos = aosCentimos(g.total + n.despesasLancadas + n.eupago);
  const receita = aosCentimos(n.taxas + n.receitasLancadas);
  const periodos = o.socia ?? [];
  const assistentes = d.assistentes
    ? aosCentimos(d.assistentes.filter((a) => dentro(a.dia) && !eDaSocia(a, periodos)).reduce((s, a) => s + a.valor, 0))
    : null;
  const lucro = aosCentimos(receita - gastos - (assistentes ?? 0));
  const socia = d.assistentes && periodos.length > 0 ? parteDaSociaNoIntervalo(periodos, de, ate, o.hoje) : null;
  const lucroDepoisDaSocia = socia == null ? null : aosCentimos(lucro - socia);
  const dias = Math.max(1, diasEntre(de, ate));
  return {
    de,
    ate,
    dias,
    receita,
    gastos,
    assistentes,
    lucro,
    socia,
    lucroDepoisDaSocia,
    mediaPorDia: aosCentimos(lucro / dias),
    mediaPorDiaDepoisDaSocia: lucroDepoisDaSocia == null ? null : aosCentimos(lucroDepoisDaSocia / dias),
  };
}

/** As despesas da CLYON num intervalo de dias (d139). */
export type DespesasDoIntervalo = {
  /** Gastos recorrentes e ocasionais das Finanças. */
  gastos: number;
  /** Despesas lançadas à mão nas Transações. */
  lancadas: number;
  /** Comissões do euPago dos pagamentos do intervalo. */
  eupago: number;
  /** Comissões pagas às assistentes e à sócia. `null` para quem não é o administrador. */
  assistentes: number | null;
  total: number;
};

/**
 * AS DESPESAS DE UM INTERVALO — d139, 27-11-2026 (dono): o que se tira ao
 * bruto para dar o líquido do Início. É o lado dos gastos da conta das
 * Finanças (o mesmo núcleo de `contasDoMes`): recorrentes + ocasionais +
 * despesas lançadas à mão + comissões do euPago + comissões pagas às
 * assistentes (a sócia incluída: é o que a gestora já conta como pago).
 * Num mês inteiro, `total` = `gastos.total + assistentes` de `contasDoMes`.
 */
export function despesasNoIntervalo(
  d: DadosDasContas,
  de: string,
  ate: string,
  recorrentes: "por_dia" | "mes_inteiro",
): DespesasDoIntervalo {
  const dentro = (dia: string) => dia >= de && dia <= ate;
  const n = entradasEMovimentos(d, dentro);
  const g = gastosNoIntervalo(d.gastos, de, ate, recorrentes);
  const assistentes = d.assistentes
    ? aosCentimos(d.assistentes.filter((a) => dentro(a.dia)).reduce((s, a) => s + a.valor, 0))
    : null;
  const lancadas = aosCentimos(n.despesasLancadas);
  const eupago = aosCentimos(n.eupago);
  return {
    gastos: g.total,
    lancadas,
    eupago,
    assistentes,
    total: aosCentimos(g.total + lancadas + eupago + (assistentes ?? 0)),
  };
}

/** O balanço de um mês: o que entrou para a CLYON e o que saiu dela. */
export type BalancoDoMes = { mes: string; entradas: number; gastos: number; assistentes: number; balanco: number };

export function balancoDoMes(c: ContasDoMes): BalancoDoMes {
  const assistentes = c.assistentes ?? 0;
  return {
    mes: c.mes,
    entradas: c.receita.total,
    gastos: c.gastos.total,
    assistentes,
    balanco: aosCentimos(c.receita.total - c.gastos.total - assistentes),
  };
}

/** Os últimos `n` meses até `mes`, do mais antigo para o mais recente. */
export function balancoDosUltimosMeses(d: DadosDasContas, mes: string, n = 6): BalancoDoMes[] {
  return Array.from({ length: n }, (_, i) => balancoDoMes(contasDoMes(d, somarMeses(mes, i - (n - 1)))));
}

export type MesDaPrevisao = {
  mes: string;
  /** «real» — já passou; «em_curso» — o mês de hoje, real até hoje; «previsto» — por vir. */
  estado: "real" | "em_curso" | "previsto";
  receita: number;
  gastos: number;
  assistentes: number;
  lucro: number;
};

export type PrevisaoAnual = {
  ano: number;
  meses: MesDaPrevisao[];
  /** A receita média dos três meses completos antes do de hoje — a base da previsão. */
  receitaMedia: number;
  assistentesMedia: number;
  real: { receita: number; gastos: number; assistentes: number; lucro: number };
  previsto: { receita: number; gastos: number; assistentes: number; lucro: number };
  total: { receita: number; gastos: number; assistentes: number; lucro: number };
};

/**
 * A PREVISÃO DO ANO — os meses que já passaram com os valores reais; os que
 * faltam com a receita média dos últimos três meses completos, os gastos
 * recorrentes que nesse mês estão activos e os ocasionais com data marcada
 * nesse mês, e a média do que se pagou aos assistentes nesses três meses.
 * O mês de hoje conta como real (até hoje).
 */
export function previsaoAnual(d: DadosDasContas, ano: number, mesDeHoje: string): PrevisaoAnual {
  const anteriores = [1, 2, 3].map((i) => contasDoMes(d, somarMeses(mesDeHoje, -i)));
  const receitaMedia = aosCentimos(anteriores.reduce((s, c) => s + c.receita.total, 0) / 3);
  const assistentesMedia = aosCentimos(anteriores.reduce((s, c) => s + (c.assistentes ?? 0), 0) / 3);

  const meses: MesDaPrevisao[] = Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
    if (mes <= mesDeHoje) {
      const b = balancoDoMes(contasDoMes(d, mes));
      return {
        mes,
        estado: mes === mesDeHoje ? "em_curso" : "real",
        receita: b.entradas,
        gastos: b.gastos,
        assistentes: b.assistentes,
        lucro: b.balanco,
      };
    }
    const gastos = gastosDoMes(d.gastos, mes).total;
    return {
      mes,
      estado: "previsto",
      receita: receitaMedia,
      gastos,
      assistentes: assistentesMedia,
      lucro: aosCentimos(receitaMedia - gastos - assistentesMedia),
    };
  });

  const somar = (filtro: (m: MesDaPrevisao) => boolean) => {
    const ms = meses.filter(filtro);
    const s = (f: (m: MesDaPrevisao) => number) => aosCentimos(ms.reduce((t, m) => t + f(m), 0));
    return { receita: s((m) => m.receita), gastos: s((m) => m.gastos), assistentes: s((m) => m.assistentes), lucro: s((m) => m.lucro) };
  };
  return {
    ano,
    meses,
    receitaMedia,
    assistentesMedia,
    real: somar((m) => m.estado !== "previsto"),
    previsto: somar((m) => m.estado === "previsto"),
    total: somar(() => true),
  };
}

export type ParteDaSocia =
  | { ha: true; nome: string; percentagem: number; lucro: number; comissao: number; pago: number; porPagar: number; emCurso: number; pendentes: number; periodos: PeriodoDaSocia[] }
  | { ha: false; porque: "sem_acesso" | "sem_socia" | "sem_periodo" };

/**
 * A PARTE DA SÓCIA NUM MÊS — a comissão da conta que ganha sobre todos os
 * trabalhos, como os Assistentes a calculam (a percentagem dela do lucro dos
 * trabalhos concluídos, sem IVA e sem descontar gastos), nos períodos que
 * fecham neste mês — a mesma regra do relatório geral das comissões.
 */
export function parteDaSociaNoMes(periodos: PeriodoDaSocia[] | null, mes: string): ParteDaSocia {
  if (periodos == null) return { ha: false, porque: "sem_acesso" };
  if (periodos.length === 0) return { ha: false, porque: "sem_socia" };
  const doMes = periodos.filter((p) => mesDoDia(p.fim) === mes);
  if (doMes.length === 0) return { ha: false, porque: "sem_periodo" };
  const s = (f: (p: PeriodoDaSocia) => number) => aosCentimos(doMes.reduce((t, p) => t + f(p), 0));
  return {
    ha: true,
    nome: doMes[0].nome,
    percentagem: doMes[0].percentagem,
    lucro: s((p) => p.lucro),
    comissao: s((p) => p.comissao),
    pago: s((p) => (p.estado === "pago" ? p.comissao : 0)),
    porPagar: s((p) => (p.estado === "por_pagar" ? p.comissao : 0)),
    emCurso: s((p) => (p.estado === "em_curso" ? p.comissao : 0)),
    pendentes: doMes.reduce((t, p) => t + p.pendentes, 0),
    periodos: doMes,
  };
}
