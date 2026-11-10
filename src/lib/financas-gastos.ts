import { aosCentimos, diaValido, lerEuros, mesDoDia, VALOR_MAXIMO, type Categoria } from "./financas";

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

/** O total por mês dos recorrentes que contam neste mês. */
export function totalMensalDosRecorrentes(gastos: Gasto[], mes: string): number {
  return gastosDoMes(gastos, mes).recorrentes;
}

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
  if (c.tipo === "recorrente") {
    if (!mesValido(c.inicio)) return { ok: false, erro: "Escolha o mês em que começa." };
    inicio = c.inicio;
  } else {
    if (!diaValido(c.dia)) return { ok: false, erro: "Escolha o dia." };
    dia = c.dia;
  }
  return {
    ok: true,
    dados: { nome, valor, categoriaId, tipo: c.tipo, inicio, dia, notas: texto(c.notas, 300) || null },
  };
}
