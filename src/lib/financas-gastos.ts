import { aosCentimos, diaValido, lerEuros, mesDoDia, VALOR_MAXIMO, type Categoria } from "./financas";
import { somarDiasAoDia } from "./hora-de-lisboa";

/**
 * OS GASTOS DA CLYON — 07-11-2026 (d21, dono).
 *
 * *«Ter a opção de colocar os gastos manualmente […] todos os valores por mês
 * em euros. Todos devem poder ser editados, e até suspensos ou eliminados, e
 * criar novos. […] Esses são valores recorrentes, mas também haverá valores
 * ocasionais […] Na hora de criar, esses valores devem ter a opção de escolher
 * se são recorrentes ou ocasionais.»*
 *
 *   · RECORRENTE — conta em cada mês, desde o mês de início, menos nos meses
 *     em que esteve suspenso. As suspensões guardam-se como pausas
 *     (`{ de, ate }`, meses `YYYY-MM`, `ate` exclusivo e nulo enquanto dura):
 *     reactivar não reescreve os meses em que esteve parado.
 *   · OCASIONAL — conta só no mês do dia marcado. Suspenso, não conta.
 *
 * Os valores são os do negócio e vivem SÓ na base: nada de valores reais aqui,
 * nos testes ou nos commits (o repositório é público). Puro — sem base, sem
 * relógio: quem chama diz o mês de hoje, em Lisboa.
 */

export type TipoDeGasto = "recorrente" | "ocasional";

/** Um intervalo de meses em que um gasto não conta: de `de` (inclusive) até `ate` (exclusive). */
export type Pausa = { de: string; ate: string | null };

export type Gasto = {
  id: number;
  nome: string;
  /** Em euros, sempre positivo. Num recorrente, o de cada mês. */
  valor: number;
  categoriaId: number | null;
  tipo: TipoDeGasto;
  /** Recorrente: o primeiro mês em que conta (`YYYY-MM`). */
  inicio: string | null;
  /** Ocasional: o dia (`YYYY-MM-DD`). */
  dia: string | null;
  /**
   * Recorrente: o dia do mês em que é debitado (1–31; num mês mais curto, o
   * último dia). Opcional — d129b, 26-11-2026, dono. Nulo = não se sabe.
   */
  diaDoDebito?: number | null;
  pausas: Pausa[];
  notas: string | null;
  criadoPor: string | null;
};

export type DadosDoGasto = Omit<Gasto, "id" | "pausas" | "criadoPor">;

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const mesValido = (v: unknown): v is string => typeof v === "string" && MES.test(v);

/** O mês está dentro de uma pausa? */
function emPausa(pausas: Pausa[], mes: string): boolean {
  return pausas.some((p) => p.de <= mes && (p.ate == null || mes < p.ate));
}

/** O gasto conta neste mês? */
export function contaNoMes(g: Gasto, mes: string): boolean {
  if (g.tipo === "ocasional") return g.dia != null && mesDoDia(g.dia) === mes && !emPausa(g.pausas, mes);
  return g.inicio != null && g.inicio <= mes && !emPausa(g.pausas, mes);
}

/** Suspenso neste mês (ou, num ocasional, de todo)? */
export function estaSuspenso(g: Gasto, mes: string): boolean {
  if (g.tipo === "ocasional") return g.pausas.length > 0;
  return emPausa(g.pausas, mes) || g.pausas.some((p) => p.ate == null);
}

/** A pausa por acabar, se houver: «suspenso desde …». */
export function pausaAberta(g: Gasto): Pausa | null {
  return g.pausas.find((p) => p.ate == null) ?? null;
}

/**
 * SUSPENDER a partir de um mês: deixa de contar nesse mês e nos seguintes.
 * Num ocasional, a pausa cobre o mês dele. Já suspenso, fica como está.
 */
export function suspender(g: Gasto, desde: string): Pausa[] {
  if (pausaAberta(g)) return g.pausas;
  const de = g.tipo === "ocasional" && g.dia ? mesDoDia(g.dia) : desde;
  return [...g.pausas, { de, ate: null }];
}

/**
 * REACTIVAR a partir de um mês: volta a contar nesse mês. Os meses parados
 * continuam parados. Num ocasional, volta a contar no mês dele. Se reactivar
 * antes de a pausa ter começado, a pausa desaparece.
 */
export function reactivar(g: Gasto, desde: string): Pausa[] {
  if (g.tipo === "ocasional") return [];
  return g.pausas
    .map((p) => (p.ate == null ? { ...p, ate: desde } : p))
    .filter((p) => p.ate == null || p.de < p.ate);
}

export type GastosDoMes = {
  recorrentes: number;
  ocasionais: number;
  total: number;
  linhas: Gasto[];
};

/** O que os gastos pesam num mês. */
export function gastosDoMes(gastos: Gasto[], mes: string): GastosDoMes {
  const linhas = gastos.filter((g) => contaNoMes(g, mes));
  const somar = (t: TipoDeGasto) => aosCentimos(linhas.filter((g) => g.tipo === t).reduce((s, g) => s + g.valor, 0));
  const recorrentes = somar("recorrente");
  const ocasionais = somar("ocasional");
  return { recorrentes, ocasionais, total: aosCentimos(recorrentes + ocasionais), linhas };
}

/** Quantos dias tem o mês `YYYY-MM`. */
export function diasDoMes(mes: string): number {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/**
 * O QUE OS GASTOS PESAM ENTRE DOIS DIAS — d56, 17-11-2026 (Início).
 *
 * Um recorrente é sempre do mês (é o único que a gestora tem). Em «por_dia»
 * conta o valor do mês ÷ os dias desse mês em cada dia do intervalo — o
 * «hoje» e a «semana» não ganham um pico no dia da fatura; em «mes_inteiro»
 * conta o mês inteiro em cada mês que o intervalo toca, como `gastosDoMes`.
 * Um ocasional conta no dia dele. Para um mês inteiro, os dois modos dão
 * o que dá `gastosDoMes`.
 */
export function gastosNoIntervalo(
  gastos: Gasto[],
  de: string,
  ate: string,
  modo: "por_dia" | "mes_inteiro",
): { recorrentes: number; ocasionais: number; total: number } {
  if (ate < de) return { recorrentes: 0, ocasionais: 0, total: 0 };
  let recorrentes = 0;
  let ocasionais = 0;
  const ultimo = mesDoDia(ate);
  for (let mes = mesDoDia(de); mes <= ultimo; ) {
    const n = diasDoMes(mes);
    const primeiro = `${mes}-01`;
    const fim = `${mes}-${String(n).padStart(2, "0")}`;
    const a = de > primeiro ? de : primeiro;
    const b = ate < fim ? ate : fim;
    const sobre = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
    for (const g of gastos) {
      if (g.tipo !== "recorrente" || !contaNoMes(g, mes)) continue;
      recorrentes += modo === "mes_inteiro" ? g.valor : (g.valor * sobre) / n;
    }
    const [ano, m] = mes.split("-").map(Number);
    mes = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  }
  for (const g of gastos) {
    if (g.tipo !== "ocasional" || g.dia == null || g.dia < de || g.dia > ate) continue;
    if (contaNoMes(g, mesDoDia(g.dia))) ocasionais += g.valor;
  }
  return { recorrentes: aosCentimos(recorrentes), ocasionais: aosCentimos(ocasionais), total: aosCentimos(recorrentes + ocasionais) };
}

/** O total por mês dos recorrentes que contam neste mês. */
export function totalMensalDosRecorrentes(gastos: Gasto[], mes: string): number {
  return gastosDoMes(gastos, mes).recorrentes;
}

/**
 * O DIA DO DÉBITO — 26-11-2026 (dono): *«Tem de ter também o dia exacto em que
 * vai ser debitado, para sabermos quando vai ser debitado cada um.»*
 *
 * Um recorrente pode dizer o dia do mês em que sai da conta (1–31). Num mês
 * que não tem esse dia (31 em Abril, 30 em Fevereiro), é o último dia do mês.
 * Tudo em dias de calendário de Lisboa: quem chama dá o `hoje` de Lisboa.
 */
export const diaDoDebitoValido = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31;

/** O dia (`YYYY-MM-DD`) em que um débito ao dia `diaDoDebito` cai no mês `YYYY-MM`. */
export function debitoNoMes(diaDoDebito: number, mes: string): string {
  const d = Math.min(diaDoDebito, diasDoMes(mes));
  return `${mes}-${String(d).padStart(2, "0")}`;
}

const mesSeguinte = (mes: string): string => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};

/**
 * Os débitos de um recorrente entre dois dias (inclusive), por ordem. Só os
 * meses em que o gasto conta: em pausa, ou antes do mês de início, não há
 * débito. Sem dia do débito, ou ocasional, nenhum.
 */
export function debitosEntre(g: Gasto, de: string, ate: string): string[] {
  if (g.tipo !== "recorrente" || !diaDoDebitoValido(g.diaDoDebito) || g.inicio == null || ate < de) return [];
  const out: string[] = [];
  for (let mes = mesDoDia(de); mes <= mesDoDia(ate); mes = mesSeguinte(mes)) {
    const dia = debitoNoMes(g.diaDoDebito, mes);
    if (dia >= de && dia <= ate && contaNoMes(g, mes)) out.push(dia);
  }
  return out;
}

/**
 * O PRÓXIMO DÉBITO de um recorrente, a contar de hoje (hoje incluído): o
 * primeiro mês, nos próximos três anos, em que conta. Suspenso sem data para
 * voltar, só os débitos de antes da pausa — depois, nulo.
 */
export function proximoDebito(g: Gasto, hoje: string): string | null {
  if (g.tipo !== "recorrente") return null;
  return debitosEntre(g, hoje, somarDiasAoDia(hoje, 3 * 366))[0] ?? null;
}

export type DebitoPrevisto = { dia: string; gasto: Gasto };

/** Os débitos dos recorrentes de hoje a `dias` dias (inclusive), por dia, e o total. */
export function proximosDebitos(gastos: Gasto[], hoje: string, dias = 30): { debitos: DebitoPrevisto[]; total: number } {
  const ate = somarDiasAoDia(hoje, dias);
  const debitos = gastos
    .flatMap((g) => debitosEntre(g, hoje, ate).map((dia) => ({ dia, gasto: g })))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.gasto.nome.localeCompare(b.gasto.nome, "pt"));
  return { debitos, total: aosCentimos(debitos.reduce((s, d) => s + d.gasto.valor, 0)) };
}

/** «2026-12-25» → «25/12/2026». */
export const diaEmNumeros = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

/** As pausas guardadas na base, lidas com desconfiança. */
export function pausasDoJson(json: unknown): Pausa[] {
  if (typeof json !== "string" || !json) return [];
  try {
    const lista = JSON.parse(json);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((p) => p && mesValido(p.de) && (p.ate == null || mesValido(p.ate)))
      .map((p) => ({ de: p.de as string, ate: (p.ate as string | null) ?? null }));
  } catch {
    return [];
  }
}

const texto = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** O que veio do formulário, conferido. O tipo é obrigatório: recorrente ou ocasional. */
export function lerGasto(
  corpo: unknown,
  categorias: Categoria[],
): { ok: true; dados: DadosDoGasto } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(c.nome, 80);
  if (!nome) return { ok: false, erro: "Dê um nome ao gasto." };
  const valor = lerEuros(c.valor);
  if (valor == null || valor <= 0) return { ok: false, erro: "Escreva o valor, maior do que zero." };
  if (valor > VALOR_MAXIMO) return { ok: false, erro: "Esse valor é grande demais. Confirme os zeros." };
  if (c.tipo !== "recorrente" && c.tipo !== "ocasional") {
    return { ok: false, erro: "Escolha se é recorrente (todos os meses) ou ocasional (uma vez)." };
  }
  let categoriaId: number | null = null;
  if (c.categoriaId != null && c.categoriaId !== "") {
    categoriaId = Number(c.categoriaId);
    const cat = categorias.find((x) => x.id === categoriaId);
    if (!cat || cat.tipo !== "despesa") return { ok: false, erro: "Escolha uma categoria de despesas." };
  }
  let inicio: string | null = null;
  let dia: string | null = null;
  let diaDoDebito: number | null = null;
  if (c.tipo === "recorrente") {
    if (!mesValido(c.inicio)) return { ok: false, erro: "Escolha o mês em que começa." };
    inicio = c.inicio;
    // Opcional: vazio fica sem dia.
    if (c.diaDoDebito != null && c.diaDoDebito !== "") {
      const n = Number(c.diaDoDebito);
      if (!diaDoDebitoValido(n)) return { ok: false, erro: "O dia do débito vai de 1 a 31 (ou deixe vazio)." };
      diaDoDebito = n;
    }
  } else {
    if (!diaValido(c.dia)) return { ok: false, erro: "Escolha o dia." };
    dia = c.dia;
  }
  return {
    ok: true,
    dados: { nome, valor, categoriaId, tipo: c.tipo, inicio, dia, diaDoDebito, notas: texto(c.notas, 300) || null },
  };
}
