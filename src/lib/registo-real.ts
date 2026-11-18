import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";

/**
 * O QUE ACONTECEU, À PARTE DO QUE SE PLANEOU — d67 (CEO e dono, 18-11-2026).
 *
 * O #591 (Trabalho CLYON, mudança) estava marcado para 16/11 às 13:00 e foi
 * feito a 17/11 das 13:00 às 19:00; o cartão só aceitava um momento e a folha
 * final tinha «Horas» escritas à mão, à parte. Agora, por dia (com a d64 cada
 * dia tem o seu): o INÍCIO REAL, o FIM REAL e a PAUSA TOTAL (um só valor —
 * «duas pausas de 30 min = 1 h»). Horas feitas = fim − início − pausa,
 * calculadas, em hora de Lisboa (com a mudança de hora a contar).
 *
 * O PLANO é `dataAgendada` / os dias da d64; o REAL é isto. Feito o trabalho,
 * a Agenda mostra o bloco real; «atrasado» só enquanto não há início registado
 * e o plano já passou. Uma fonte: `simulatorOrders.registoRealJson`, escrito
 * pela folha final ou pelo «Registo real» do backoffice (admin e assistentes).
 *
 * PURO: a leitura, as contas e as frases. A base em `registo-real-na-base.ts`.
 */

export type DiaReal = {
  /** AAAA-MM-DD, Lisboa. */
  dia: string;
  /** Instantes (ISO). */
  inicio: string;
  fim: string;
  /** A pausa total do dia, em minutos. */
  pausaMin: number;
};

export const MAXIMO_DE_DIAS_REAIS = 14;
/** Um dia de trabalho com mais do que isto é um engano a escrever. */
export const MAXIMO_DE_HORAS_NUM_DIA = 18;

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^(\d{1,2})[:h.](\d{2})$/;

/** «13:00», «13h00», «13.00», «13» → «13:00». Null se não se lê. */
export function horaEscrita(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim().toLowerCase().replace(/\s/g, "");
  if (!t) return null;
  const m = HORA.exec(t) ?? (/^(\d{1,2})h?$/.exec(t) ? ([t, t.replace("h", ""), "00"] as unknown as RegExpExecArray) : null);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(min) || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** «1 h», «60», «1:00», «1h30», «90 min», «0» → minutos. Vazio → 0. Lixo → NaN. */
export function pausaEmMinutos(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : Number.NaN;
  const t = String(v).trim().toLowerCase().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[:h](\d{2})$/.exec(t))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = /^(\d+(?:\.\d+)?)h(?:oras?)?$/.exec(t))) return Math.round(Number(m[1]) * 60);
  if ((m = /^(\d+)(?:m|min|minutos?)?$/.exec(t))) return Number(m[1]);
  return Number.NaN;
}

export type LeituraDoDiaReal = { ok: true; dia: DiaReal } | { ok: false; erro: string };

/**
 * Um dia, do formulário: `{ dia: "AAAA-MM-DD", inicio: "13:00", fim: "19:00",
 * pausa: "1 h" }` — ou já gravado (com os instantes ISO). O fim antes do
 * início passa a meia-noite (o fim é no dia seguinte).
 */
export function lerDiaReal(v: unknown): LeituraDoDiaReal {
  if (!v || typeof v !== "object") return { ok: false, erro: "Dia sem dados." };
  const o = v as Record<string, unknown>;
  const pausaMin = pausaEmMinutos(o.pausa ?? o.pausaMin);
  if (!Number.isFinite(pausaMin) || pausaMin < 0) return { ok: false, erro: "A pausa não é válida (ex.: 30 min · 1 h · 1:30)." };
  let inicio: Date | null = null;
  let fim: Date | null = null;
  const comFuso = (s: unknown) => typeof s === "string" && /T\d{2}:\d{2}/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  if (comFuso(o.inicio) && comFuso(o.fim)) {
    inicio = new Date(String(o.inicio));
    fim = new Date(String(o.fim));
  } else {
    const dia = typeof o.dia === "string" ? o.dia.trim() : "";
    if (!DIA.test(dia)) return { ok: false, erro: "Indique o dia." };
    const hi = horaEscrita(o.inicio);
    const hf = horaEscrita(o.fim);
    if (!hi) return { ok: false, erro: "Indique a hora de início (ex.: 13:00)." };
    if (!hf) return { ok: false, erro: "Indique a hora de fim (ex.: 19:00)." };
    inicio = instanteEmLisboa(`${dia}T${hi}`);
    const [a, m, d] = dia.split("-").map(Number);
    const seguinte = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
    fim = instanteEmLisboa(`${hf > hi ? dia : seguinte}T${hf}`);
  }
  if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return { ok: false, erro: "As horas não são válidas." };
  const minutos = (fim.getTime() - inicio.getTime()) / 60_000;
  if (minutos <= 0) return { ok: false, erro: "O fim tem de ser depois do início." };
  if (minutos > MAXIMO_DE_HORAS_NUM_DIA * 60) return { ok: false, erro: `Mais de ${MAXIMO_DE_HORAS_NUM_DIA} horas num dia? Confirme as horas.` };
  if (pausaMin >= minutos) return { ok: false, erro: "A pausa é maior do que o tempo do dia." };
  return { ok: true, dia: { dia: diaEmLisboa(inicio), inicio: inicio.toISOString(), fim: fim.toISOString(), pausaMin } };
}

/** A lista do formulário: um por dia, por ordem; o primeiro erro, se houver. */
export function lerRegistoReal(lista: unknown): { ok: true; dias: DiaReal[] } | { ok: false; erro: string } {
  if (!Array.isArray(lista)) return { ok: false, erro: "Sem dias." };
  const porDia = new Map<string, DiaReal>();
  for (const [i, v] of lista.entries()) {
    const r = lerDiaReal(v);
    if (!r.ok) return { ok: false, erro: lista.length > 1 ? `Dia ${i + 1}: ${r.erro}` : r.erro };
    porDia.set(r.dia.dia, r.dia);
  }
  const dias = [...porDia.values()].sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, MAXIMO_DE_DIAS_REAIS);
  return dias.length ? { ok: true, dias } : { ok: false, erro: "Sem dias." };
}

/** O que está na base — `[]` sem registo, ou com um estragado. */
export function registoRealDeJson(json: string | null | undefined): DiaReal[] {
  if (!json || typeof json !== "string") return [];
  try {
    const r = lerRegistoReal(JSON.parse(json));
    return r.ok ? r.dias : [];
  } catch {
    return [];
  }
}

/** Horas feitas num dia: fim − início − pausa (em horas, duas casas). */
export function horasDoDia(d: DiaReal): number {
  const min = (new Date(d.fim).getTime() - new Date(d.inicio).getTime()) / 60_000 - d.pausaMin;
  return Math.round((Math.max(0, min) / 60) * 100) / 100;
}

/** As horas feitas no total. */
export function horasFeitas(dias: DiaReal[]): number {
  return Math.round(dias.reduce((s, d) => s + horasDoDia(d), 0) * 100) / 100;
}

/* ── As frases ───────────────────────────────────────────────────────────── */

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** «13h», «13h30». */
function horaCurta(iso: string): string {
  const p = pecasEmLisboa(new Date(iso));
  return p.minuto ? `${p.hora}h${String(p.minuto).padStart(2, "0")}` : `${p.hora}h`;
}

/** «1 h», «30 min», «1 h 30», «sem pausa». */
export function pausaEmPalavras(min: number): string {
  if (!min) return "sem pausa";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min de pausa`;
  return m ? `${h} h ${m} de pausa` : `${h} h de pausa`;
}

/** «5 h», «5,5 h». */
export function horasEmPalavrasCurtas(h: number): string {
  return `${String(Math.round(h * 100) / 100).replace(".", ",")} h`;
}

/**
 * «feito a 17/11, das 13h às 19h, 1 h de pausa → 5 h» — ou, em vários dias,
 * «feito a 16/11, das 9h às 17h, 1 h de pausa → 7 h; a 17/11, … → total 14 h».
 */
export function registoRealEmPalavras(dias: DiaReal[]): string {
  if (dias.length === 0) return "";
  const um = (d: DiaReal) => `a ${ddmm(d.dia)}, das ${horaCurta(d.inicio)} às ${horaCurta(d.fim)}, ${pausaEmPalavras(d.pausaMin)} → ${horasEmPalavrasCurtas(horasDoDia(d))}`;
  if (dias.length === 1) return `feito ${um(dias[0])}`;
  return `feito ${dias.map(um).join("; ")} — total ${horasEmPalavrasCurtas(horasFeitas(dias))}`;
}

/** O bloco real de um dia, para a Agenda: o início e a duração (fim − início), em minutos. */
export function blocoReal(d: DiaReal): { inicio: string; duracaoMin: number } {
  return { inicio: d.inicio, duracaoMin: Math.round((new Date(d.fim).getTime() - new Date(d.inicio).getTime()) / 60_000) };
}

/** Já há início registado? (Tira o «atrasado».) */
export function temInicioRegistado(dias: DiaReal[]): boolean {
  return dias.length > 0;
}
