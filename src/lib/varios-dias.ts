import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";

/**
 * UM TRABALHO EM VÁRIOS DIAS — d64 (CEO e dono, 18-11-2026).
 *
 * Um trabalho de 6 cargas feito em 3 dias (16, 17 e 18/11, 2 cargas por dia)
 * aparecia na Agenda só no dia 16 — e «atrasado» no dia 17. Um pedido passa a
 * poder ter uma LISTA de dias, cada um com a hora de início (hora de Lisboa) e,
 * opcional, as cargas previstas; o profissional regista as cargas feitas em
 * cada dia. Um só pedido, um só pagamento, uma só fatura.
 *
 * COMPATÍVEL COM UM DIA SÓ: o dia principal continua a ser o PRIMEIRO, e é
 * esse que fica em `dataAgendada` (e na `dataCombinada` de quem tem o
 * trabalho) — tudo o que lê essas colunas continua a ler o mesmo. A lista vive
 * em `simulatorOrders.diasDoTrabalhoJson`, nula com um dia só.
 *
 * O que conta a partir do ÚLTIMO dia: o «atrasado» (só depois do último dia
 * sem estar dado por feito), e o «está feito» do profissional (só no último).
 *
 * PURO: as contas e as frases. A base está em `db.ts` (`diasDoPedido`,
 * `gravarDiasDoPedido`, `gravarCargasDoDia`).
 */

/** Um dia do trabalho. `dia` é o dia civil de Lisboa (AAAA-MM-DD) — a chave. */
export type DiaDoTrabalho = {
  dia: string;
  /** O instante do início (ISO). Às 00:00 de Lisboa quer dizer «só o dia». */
  inicio: string;
  cargasPrevistas?: number | null;
  /** Registadas pelo profissional, no fim de cada dia. */
  cargasFeitas?: number | null;
};

/** No máximo — uma lista maior é um engano a escrever, não um trabalho. */
export const MAXIMO_DE_DIAS = 14;

const DIA = /^\d{4}-\d{2}-\d{2}$/;

const cargas = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 99 ? Math.round(n * 10) / 10 : null;
};

/**
 * Um dia, do que vier (da base ou de um formulário): o instante, ou
 * «AAAA-MM-DDTHH:MM» em hora de Lisboa, ou só «AAAA-MM-DD». Null se não se lê.
 */
export function lerUmDia(v: unknown): DiaDoTrabalho | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const cru = typeof o.inicio === "string" ? o.inicio.trim() : typeof o.dia === "string" ? o.dia.trim() : "";
  if (!cru) return null;
  let instante: Date | null;
  if (DIA.test(cru)) instante = instanteEmLisboa(`${cru}T00:00`);
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(cru)) instante = instanteEmLisboa(cru.slice(0, 16));
  else {
    const d = new Date(cru);
    instante = Number.isNaN(d.getTime()) ? null : d;
  }
  if (!instante || Number.isNaN(instante.getTime())) return null;
  return {
    dia: diaEmLisboa(instante),
    inicio: instante.toISOString(),
    cargasPrevistas: cargas(o.cargasPrevistas),
    cargasFeitas: cargas(o.cargasFeitas),
  };
}

/**
 * A lista arrumada: lida, por ordem, um registo por dia de Lisboa (o último
 * escrito ganha), no máximo `MAXIMO_DE_DIAS`.
 */
export function arrumarDias(lista: unknown): DiaDoTrabalho[] {
  if (!Array.isArray(lista)) return [];
  const porDia = new Map<string, DiaDoTrabalho>();
  for (const v of lista) {
    const d = lerUmDia(v);
    if (d) porDia.set(d.dia, d);
  }
  return [...porDia.values()].sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, MAXIMO_DE_DIAS);
}

/** O que está na base (texto JSON) — `[]` sem lista, ou com uma estragada. */
export function diasDeJson(json: string | null | undefined): DiaDoTrabalho[] {
  if (!json || typeof json !== "string") return [];
  try {
    return arrumarDias(JSON.parse(json));
  } catch {
    return [];
  }
}

/** O que se grava: nulo com um dia só (ou nenhum) — um dia é o `dataAgendada` de sempre. */
export function diasParaGravar(dias: DiaDoTrabalho[]): string | null {
  const l = arrumarDias(dias);
  return l.length > 1 ? JSON.stringify(l) : null;
}

/**
 * OS DIAS DE UM TRABALHO, com o primeiro a mandar: a data combinada (ou a do
 * cliente) é o dia 1; os outros vêm da lista. Sem lista, um dia só (ou nenhum).
 */
export function diasDoTrabalho(t: {
  dataCombinada?: string | Date | null;
  dataAgendada?: string | Date | null;
  diasDoTrabalhoJson?: string | null;
}): DiaDoTrabalho[] {
  const paraData = (v: string | Date | null | undefined) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const primeiro = paraData(t.dataCombinada) ?? paraData(t.dataAgendada);
  const lista = diasDeJson(t.diasDoTrabalhoJson ?? null);
  if (lista.length <= 1) {
    return primeiro ? [{ dia: diaEmLisboa(primeiro), inicio: primeiro.toISOString(), ...(lista[0] ? { cargasPrevistas: lista[0].cargasPrevistas, cargasFeitas: lista[0].cargasFeitas } : {}) }] : lista;
  }
  if (!primeiro) return lista;
  // O primeiro dia é o da data que manda; os outros, os da lista que vêm depois dele.
  const dia1 = diaEmLisboa(primeiro);
  const doDia1 = lista.find((d) => d.dia === dia1) ?? lista[0];
  const resto = lista.filter((d) => d.dia > dia1);
  return [{ ...doDia1, dia: dia1, inicio: primeiro.toISOString() }, ...resto];
}

/** É um trabalho de vários dias? */
export function emVariosDias(dias: DiaDoTrabalho[]): boolean {
  return dias.length > 1;
}

/** O último dia (o instante do início) — ou null sem dias. */
export function ultimoDia(dias: DiaDoTrabalho[]): DiaDoTrabalho | null {
  return dias.length ? dias[dias.length - 1] : null;
}

/** «dia 2 de 3» — ou nada num trabalho de um dia. */
export function diaNDeM(n: number, m: number): string {
  return m > 1 ? `dia ${n} de ${m}` : "";
}

/** O total das cargas feitas (registadas pelo profissional), ou null sem nenhuma. */
export function cargasFeitasNoTotal(dias: DiaDoTrabalho[]): number | null {
  const feitas = dias.map((d) => d.cargasFeitas).filter((c): c is number => typeof c === "number");
  return feitas.length ? Math.round(feitas.reduce((s, c) => s + c, 0) * 10) / 10 : null;
}

/** O total das cargas previstas, ou null sem nenhuma. */
export function cargasPrevistasNoTotal(dias: DiaDoTrabalho[]): number | null {
  const p = dias.map((d) => d.cargasPrevistas).filter((c): c is number => typeof c === "number");
  return p.length ? Math.round(p.reduce((s, c) => s + c, 0) * 10) / 10 : null;
}

/**
 * O PROFISSIONAL SÓ DÁ POR FEITO NO FIM — a partir do dia do último (Lisboa).
 * Um trabalho de um dia dá-se por feito como sempre.
 */
export function podeDarPorFeitoNoDia(dias: DiaDoTrabalho[], agora: Date): boolean {
  const u = ultimoDia(dias);
  if (!u || dias.length <= 1) return true;
  return diaEmLisboa(agora) >= u.dia;
}

/* ── As frases ───────────────────────────────────────────────────────────── */

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function partes(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return { ano: a, mes: m, d, semana: SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()] };
}

const consecutivos = (dias: string[]) =>
  dias.every((d, i) => i === 0 || Date.parse(`${d}T00:00:00Z`) - Date.parse(`${dias[i - 1]}T00:00:00Z`) === 86_400_000);

/**
 * OS DIAS, AO CLIENTE — «de segunda, 16, a quarta, 18 de novembro»; seguidos
 * em meses diferentes, «de segunda, 30 de novembro, a quarta, 2 de dezembro»;
 * soltos, «segunda, 16, quarta, 18 e sexta, 20 de novembro». Um dia só:
 * «segunda, 16 de novembro». Sem dias, vazio.
 */
export function diasPorExtenso(dias: DiaDoTrabalho[] | string[]): string {
  const l = [...new Set((dias as Array<DiaDoTrabalho | string>).map((d) => (typeof d === "string" ? d : d.dia)))].sort();
  if (l.length === 0) return "";
  const p = l.map(partes);
  const comMes = (x: ReturnType<typeof partes>) => `${x.semana}, ${x.d} de ${MESES[x.mes - 1]}`;
  if (l.length === 1) return comMes(p[0]);
  const mesmoMes = p.every((x) => x.mes === p[0].mes && x.ano === p[0].ano);
  if (consecutivos(l) && l.length >= 2) {
    const a = p[0];
    const b = p[p.length - 1];
    return mesmoMes ? `de ${a.semana}, ${a.d}, a ${b.semana}, ${b.d} de ${MESES[b.mes - 1]}` : `de ${comMes(a)}, a ${comMes(b)}`;
  }
  const curtos = p.map((x, i) => {
    const ultimoDoMes = i === p.length - 1 || p[i + 1].mes !== x.mes;
    return ultimoDoMes ? comMes(x) : `${x.semana}, ${x.d}`;
  });
  return `${curtos.slice(0, -1).join(", ")} e ${curtos[curtos.length - 1]}`;
}

/** A hora de início de um dia («09:00»), ou null quando é só o dia (00:00 de Lisboa). */
export function horaDoDia(d: DiaDoTrabalho): string | null {
  const x = pecasEmLisboa(new Date(d.inicio));
  if (x.hora === 0 && x.minuto === 0) return null;
  return `${String(x.hora).padStart(2, "0")}:${String(x.minuto).padStart(2, "0")}`;
}
