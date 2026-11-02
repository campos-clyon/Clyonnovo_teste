import { diaEmLisboa, somarDiasAoDia, inicioDoDiaEmLisboa, instanteEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";

/**
 * O PEDIDO QUE CHEGA DA APP DE CLIENTE — o resto da R3 (d8 fase 2, S5,
 * 28-10-2026).
 *
 * A app pede pela mesma porta do simulador (`POST /api/simulador/pedido`),
 * com três coisas a mais: a origem (`origemPedido: "app_cliente"`), o dia que
 * o cliente escolheu (`dataPreferida`, «AAAA-MM-DD») e quantos rascunhos
 * começou antes deste (`rascunhosAntes`, só para a medida do E3).
 *
 * O DIA À ESCOLHA conta-se em Lisboa, a partir de amanhã, seja qual for o fuso
 * do telemóvel. «Hoje» vai pelo `urgency`, como no simulador (d8, 31-10-2026):
 * pedido urgente, sem prometer o dia («sem no próprio dia»).
 */

export const ORIGEM_DA_APP_DE_CLIENTE = "app_cliente";

/** Até onde se pode escolher o dia (o calendário da app mostra 90 dias). */
const DIAS_PARA_A_FRENTE = 365;

export const DIA_A_PARTIR_DE_AMANHA = "Escolha um dia a partir de amanhã.";
/** Pela app só se envia com conta (S14, 29-10-2026; G3). */
export const ENTRE_PARA_ENVIAR = "Entre na CLYON para enviar o pedido.";

/** O dia preferido, se veio: de amanhã em diante, em Lisboa. */
export function lerDataPreferida(
  v: unknown,
  agora: Date = new Date(),
): { ok: true; dia: string | null; inicio: Date | null } | { ok: false; erro: string } {
  if (v === undefined || v === null || v === "") return { ok: true, dia: null, inicio: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  const hoje = diaEmLisboa(agora);
  if (v <= hoje) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  if (v > somarDiasAoDia(hoje, DIAS_PARA_A_FRENTE)) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  return { ok: true, dia: v, inicio: inicioDoDiaEmLisboa(v) };
}

/** A urgência que o motor de preços lê, a partir do dia escolhido. */
export function urgenciaDoDia(dia: string, agora: Date = new Date()): "tomorrow" | "this_week" | "flexible" {
  const hoje = diaEmLisboa(agora);
  if (dia <= somarDiasAoDia(hoje, 1)) return "tomorrow";
  if (dia <= somarDiasAoDia(hoje, 7)) return "this_week";
  return "flexible";
}

/** Quantos rascunhos antes deste: um inteiro de 0 a 50, ou nada. */
export function lerRascunhosAntes(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 50 ? n : null;
}

/*
 * A HORA À ESCOLHA — 02-11-2026 (ordem do CEO com o sim do dono, «o cliente
 * escolhe dia e horário no calendário»). A app manda `horaPreferida` («HH:MM»,
 * hora de Lisboa, das 08:00 às 20:00 de 30 em 30 min) junto com o dia, e o
 * pedido grava o dia e a hora no mesmo `dataAgendada` que o backoffice já
 * mostra («para 03/11, 10:30»). Sem hora fica a meia-noite: «só o dia».
 */
export const HORA_ENTRE_8_E_20 = "Escolha uma hora entre as 8h00 e as 20h00, de 30 em 30 minutos.";
export const HORA_SEM_DIA = "Escolha primeiro o dia.";

/** A hora preferida, se veio: «HH:MM» de 08:00 a 20:00, de 30 em 30 minutos. */
export function lerHoraPreferida(v: unknown): { ok: true; hora: string | null } | { ok: false; erro: string } {
  if (v === undefined || v === null || v === "") return { ok: true, hora: null };
  if (typeof v !== "string" || !/^\d{2}:\d{2}$/.test(v)) return { ok: false, erro: HORA_ENTRE_8_E_20 };
  const [h, m] = v.split(":").map(Number);
  const minutos = h * 60 + m;
  if (m % 30 !== 0 || minutos < 8 * 60 || minutos > 20 * 60) return { ok: false, erro: HORA_ENTRE_8_E_20 };
  return { ok: true, hora: v };
}

/** O instante do dia «AAAA-MM-DD» à hora «HH:MM» de Lisboa — o que vai para `dataAgendada`. */
export function instanteDoDiaEHora(dia: string, hora: string | null): Date {
  if (!hora) return inicioDoDiaEmLisboa(dia);
  return instanteEmLisboa(`${dia}T${hora}`) ?? new Date(Number.NaN);
}

/** A hora de Lisboa de um `dataAgendada` («HH:MM»), ou `null` se for só o dia (meia-noite). */
export function horaDoAgendado(v: Date | null | undefined): string | null {
  if (!v || Number.isNaN(v.getTime())) return null;
  const p = pecasEmLisboa(v);
  if (p.hora === 0 && p.minuto === 0) return null;
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}
